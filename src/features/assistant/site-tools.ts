/**
 * Every tool the site assistant can call, and the one place a call is routed.
 *
 * Each tool keeps its schema and executor beside the data it reads -- finance
 * in `lib/finance/tools.ts`, inventory and releases in this folder -- and this
 * file only lists them and dispatches. All of them read; none writes. A tool
 * that changed a row would make a model's mistake a data loss rather than a
 * wrong sentence, which is the line 7.6 is drawn on.
 *
 * Pure: the readers are passed in, so the routing and its failure modes are
 * tested without a network.
 */

import type { LlmToolCall, ToolSchema } from '@/lib/assistant/protocol';
import { executeTool as executeFinanceTool, TOOL_SCHEMAS as FINANCE_TOOL_SCHEMAS, type FinanceToolContext } from '@/lib/finance/tools';
import { SEARCH_INVENTORY_SCHEMA, searchInventory, type InventoryToolRow } from './inventory-tool';
import { GET_RELEASES_SCHEMA, getReleases, parseReleaseArgs, type ReleaseArgs, type ReleaseReadRow } from './releases-tool';

export const SITE_TOOL_SCHEMAS: readonly ToolSchema[] = [
  ...FINANCE_TOOL_SCHEMAS,
  SEARCH_INVENTORY_SCHEMA,
  GET_RELEASES_SCHEMA,
];

const FINANCE_TOOL_NAMES = new Set<string>(FINANCE_TOOL_SCHEMAS.map(tool => tool.name));

/** What the tools read through. Each reader may reject; the call then reports a failed read. */
export interface SiteToolReaders {
  /** The finance context, when the Finance page has it loaded; null anywhere else. */
  finance: () => FinanceToolContext | null;
  inventory: () => Promise<readonly InventoryToolRow[]>;
  releases: (args: ReleaseArgs) => Promise<readonly ReleaseReadRow[]>;
  today: () => Date;
}

/**
 * Finance is read where it is loaded rather than loaded again here. The
 * Finance page owns a provider with twenty-odd tables and their save paths;
 * a second copy mounted for the assistant would race the first.
 */
export const FINANCE_NOT_LOADED =
  'Finance data is only loaded on the Finance page. Ask the owner to open Finance and ask again.';

export async function runSiteTool(call: LlmToolCall, readers: SiteToolReaders): Promise<unknown> {
  if (FINANCE_TOOL_NAMES.has(call.name)) {
    const finance = readers.finance();
    if (!finance) return { tool: call.name, error: FINANCE_NOT_LOADED };
    return executeFinanceTool(call.name, call.args, finance);
  }

  switch (call.name) {
    case 'search_inventory':
      try {
        return searchInventory(call.args, await readers.inventory());
      } catch {
        return { tool: call.name, error: 'the inventory could not be read just now' };
      }

    case 'get_releases': {
      const today = readers.today();
      const args = parseReleaseArgs(call.args, today);
      if ('error' in args) return { tool: call.name, error: args.error };
      try {
        return getReleases(args, await readers.releases(args), today);
      } catch {
        return { tool: call.name, error: 'the watchlist could not be read just now' };
      }
    }

    default:
      return { tool: call.name, error: `unknown tool: ${call.name}` };
  }
}

/**
 * The standing instructions, identical on every request.
 *
 * Nothing that changes between questions goes here -- not the date, not the
 * page. A provider ties a model's thinking to the exact system prompt it was
 * produced under, and an edited one invalidates the conversation so far.
 * What changes rides on each question instead (`frameQuestion`).
 *
 * The arithmetic rule is spelled out because it is the one a model breaks
 * most naturally: asked for a total, it adds.
 */
export const SYSTEM_PROMPT = [
  'You answer questions about the owner\'s own website: their finances, their inventory, and the films and shows on their watchlist.',
  'Each question starts with a bracketed note of the date, the page it was asked from, and whether finance data is loaded. Finance data loads only on the Finance page; when it is not loaded, tell the owner to open Finance and ask there.',
  'Use the tools for every fact. Never compute: do not add, subtract, average or estimate figures yourself. Quote the totals the tools return, and if a question needs a figure no tool gives, say which figures you have instead.',
  'Money is in pounds sterling. Keep answers short and plain. Say when a result is partial, capped or flagged as possibly including transfers.',
  'You cannot change anything on the site; every tool only reads.',
].join('\n');

export interface QuestionContext {
  /** YYYY-MM-DD, local. */
  today: string;
  /** The path the question was asked from, e.g. /finance. */
  page: string;
  financeLoaded: boolean;
}

/** The question as sent: a one-line note of where and when, then the words typed. */
export function frameQuestion(question: string, { today, page, financeLoaded }: QuestionContext): string {
  return `[Today is ${today}. Asked from ${page}. Finance data ${financeLoaded ? 'is' : 'is not'} loaded.]\n\n${question}`;
}
