/**
 * The conversation, kept outside React.
 *
 * Every route renders its own `AppShell`, so the panel unmounts on each
 * navigation. Holding the conversation here lets it survive that, and lets a
 * question asked just before a navigation still land. It lives in memory
 * only: answers carry finance figures, and nothing here is written to
 * localStorage, where they would outlive the session.
 */

import { useSyncExternalStore } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ask } from '@/lib/assistant/conversation';
import { toISODate } from '@/lib/finance/dates';
import { AssistantRequestError, readInventoryRows, readReleaseRows, sendAssistantRequest } from './assistant-client';
import { readFinanceToolContext } from './finance-source';
import { frameQuestion, runSiteTool, SITE_TOOL_SCHEMAS, SYSTEM_PROMPT, type SiteToolReaders } from './site-tools';
import type { AssistantProvider } from './useAssistantProvider';

export interface ChatEntry {
  id: number;
  role: 'user' | 'assistant' | 'notice';
  text: string;
  /** For an answer: what it was read from, in plain words. */
  sources?: string[];
}

interface ChatState {
  providerId: string | null;
  entries: ChatEntry[];
  /** Protocol-shaped messages, sent with the next question. */
  history: unknown[];
  pending: boolean;
}

const EMPTY: ChatState = { providerId: null, entries: [], history: [], pending: false };

let state: ChatState = EMPTY;
let nextId = 1;
/** Bumped by every reset, so an answer still in flight lands nowhere. */
let generation = 0;
const listeners = new Set<() => void>();

const update = (next: Partial<ChatState>) => {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const entry = (role: ChatEntry['role'], text: string, sources?: string[]): ChatEntry => ({
  id: nextId++,
  role,
  text,
  ...(sources && sources.length > 0 ? { sources } : {}),
});

export function useChatState(): ChatState {
  return useSyncExternalStore(subscribe, () => state);
}

export function clearChat(): void {
  generation += 1;
  update({ ...EMPTY, providerId: state.providerId });
}

// Signing out drops the conversation: the launcher disappears with the
// session, but the answers would otherwise stay in memory until a reload.
supabase.auth.onAuthStateChange((event) => {
  if (event !== 'SIGNED_OUT') return;
  generation += 1;
  update({ ...EMPTY });
});

const SOURCE_LABELS: Record<string, string> = {
  get_position: 'Finance position',
  run_spend_scenario: 'Spend scenario',
  get_alerts: 'Finance alerts',
  get_goals: 'Goals',
  get_cash_flow: 'Cash flow',
  search_inventory: 'Inventory',
  get_releases: 'Watchlist',
};

/**
 * Output allowed per model call. The default model always thinks, and its
 * thinking counts against this, so it is set for a short answer plus room to
 * think rather than for the answer alone. The Edge Function caps it again.
 */
const MAX_REPLY_TOKENS = 8192;

const readersFor = (page: string): SiteToolReaders => ({
  finance: readFinanceToolContext,
  inventory: readInventoryRows,
  releases: readReleaseRows,
  today: () => new Date(),
  onFinancePage: page === '/finance' || page.startsWith('/finance/'),
});

/** Asks one question. Ignored while another is in flight. */
export async function askQuestion(provider: AssistantProvider, question: string, page: string): Promise<void> {
  const text = question.trim();
  if (!text || state.pending) return;
  if (state.providerId !== provider.id) update({ ...EMPTY, providerId: provider.id });

  update({ entries: [...state.entries, entry('user', text)], pending: true });
  const historyBefore = state.history;
  const readers = readersFor(page);
  const asked = generation;
  // Every write below goes through this, so a reset mid-question wins.
  const settle = (next: Partial<ChatState>) => {
    if (generation === asked) update(next);
  };

  try {
    const result = await ask({
      protocol: provider.protocol,
      model: provider.model,
      system: SYSTEM_PROMPT,
      tools: SITE_TOOL_SCHEMAS,
      history: historyBefore,
      question: frameQuestion(text, {
        today: toISODate(new Date()),
        page,
        financeLoaded: readFinanceToolContext() !== null,
      }),
      send: body => sendAssistantRequest(provider.id, body),
      runTool: call => runSiteTool(call, readers),
      maxTokens: MAX_REPLY_TOKENS,
    });
    const sources = [...new Set(result.toolsUsed.map(name => SOURCE_LABELS[name] ?? name))];

    if (result.incomplete || result.stoppedEarly || result.text.trim() === '') {
      // None of these turns is kept: a cut-off one may hold a call with no
      // result, and one that ended on tool results would put the next
      // question after a call the model never answered. A cut-off answer is
      // not shown either -- it can stop in the middle of a figure.
      settle({
        entries: [...state.entries, entry('notice', result.incomplete
          ? 'The answer was cut off before it finished. Try a narrower question.'
          : result.stoppedEarly
            ? 'The assistant ran out of steps before answering. Try a narrower question.'
            : 'No answer came back. Try asking again.', sources)],
        history: result.restarted ? [] : historyBefore,
      });
      return;
    }
    settle({
      entries: [
        ...state.entries,
        ...(result.restarted
          ? [entry('notice', 'This conversation got long, so that question started a fresh one. Earlier questions are not remembered.')]
          : []),
        entry('assistant', result.text.trim(), sources),
      ],
      history: result.history,
    });
  } catch (error) {
    // A rate limit is about time, not this conversation, so the history
    // stays. Any other failure may be the history itself -- one the provider
    // refuses, or one grown past the function's cap -- and resending it would
    // fail the same way on every question, so the next one starts fresh.
    const rateLimited = error instanceof AssistantRequestError && error.rateLimited;
    settle({
      entries: [...state.entries, entry('notice', rateLimited
        ? (error as AssistantRequestError).message
        : 'The assistant could not answer just now. Your next question starts a fresh conversation.')],
      ...(rateLimited ? {} : { history: [] }),
    });
  } finally {
    settle({ pending: false });
  }
}
