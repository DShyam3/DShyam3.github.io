/**
 * Whether the assistant exists for this visitor, and which model it uses.
 *
 * One question to the Edge Function per session, and only for an
 * administrator. With no key set -- or no function deployed -- the answer is
 * no provider, and nothing renders: the site is exactly the site without it.
 *
 * Kept apart from `assistant-client.ts` because this file ships in the entry
 * chunk; the panel and everything it reads stay lazy.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { LlmProtocol } from '@/lib/assistant/protocol';

/** A provider the Edge Function has a key for. Never a URL: the function resolves the id. */
export interface AssistantProvider {
  id: string;
  label: string;
  protocol: LlmProtocol;
  model: string;
}

const isProvider = (value: unknown): value is AssistantProvider => {
  if (!value || typeof value !== 'object') return false;
  const p = value as Record<string, unknown>;
  return typeof p.id === 'string'
    && typeof p.label === 'string'
    && (p.protocol === 'openai' || p.protocol === 'anthropic')
    && typeof p.model === 'string';
};

/** Never rejects: a failed probe is the same answer as no key. */
async function fetchAssistantProviders(): Promise<AssistantProvider[]> {
  try {
    const { data, error } = await supabase.functions.invoke('assistant', { body: { action: 'providers' } });
    if (error) return [];
    const list = (data as { providers?: unknown } | null)?.providers;
    return Array.isArray(list) ? list.filter(isProvider) : [];
  } catch {
    return [];
  }
}

/** The first configured provider, or null when there is none or `enabled` is false. */
export function useAssistantProvider(enabled: boolean): AssistantProvider | null {
  const { data } = useQuery({
    queryKey: ['assistant-providers'],
    queryFn: fetchAssistantProviders,
    enabled,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });
  return enabled ? data?.[0] ?? null : null;
}
