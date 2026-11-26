import { supabase } from '@/integrations/supabase/client';
import type { FormValues } from './types';

/**
 * The name and description from `links-metadata`'s answer, and nothing else
 * in it. Null when the function could not read the page. The text comes from
 * someone else's page: it lands in the form as plain values for the owner to
 * check, and React renders it as text.
 */
export function metadataValues(data: unknown): Partial<FormValues> | null {
  if (!data || typeof data !== 'object' || (data as { ok?: unknown }).ok !== true) return null;
  const { name, description } = data as { name?: unknown; description?: unknown };
  const values: Partial<FormValues> = {};
  if (typeof name === 'string' && name.trim()) values.name = name.trim();
  if (typeof description === 'string' && description.trim()) values.description = description.trim();
  return values;
}

/**
 * Asks the server what the page at `url` calls itself; a browser cannot read
 * another site's page. Throws when the page could not be read.
 */
export async function fetchLinkMetadata(url: string): Promise<Partial<FormValues>> {
  const { data, error } = await supabase.functions.invoke('links-metadata', { body: { url } });
  if (error) throw error;
  const values = metadataValues(data);
  if (!values) throw new Error('The page could not be read');
  return values;
}
