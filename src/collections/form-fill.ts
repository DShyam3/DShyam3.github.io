import type { FormValues } from './types';

/**
 * Merges a slower fill into the form: a link's name and description read from
 * its page, say. The values an earlier fill put in (`earlier`) belong to the
 * page it read, so this answer replaces them, and a field it has no value for
 * goes back to empty -- pass `{}` when the read failed. A field the owner
 * typed in is never touched. Nothing is merged once `field` no longer holds
 * `source`, the value the fill was asked for: the answer is about a page the
 * form is no longer pointing at.
 *
 * Returns the values (`current` itself when nothing changes) and `owned`, the
 * values the fill now holds, which are this call's `earlier` next time.
 */
export function mergeFill(
  current: FormValues,
  filled: Partial<FormValues>,
  earlier: Partial<FormValues>,
  field: string,
  source: string,
): { values: FormValues; owned: Partial<FormValues> } {
  if ((current[field] ?? '').trim() !== source) return { values: current, owned: earlier };
  let values = current;
  const owned: Partial<FormValues> = {};
  for (const name of new Set([...Object.keys(earlier), ...Object.keys(filled)])) {
    if (name === field) continue;
    const value = filled[name] ?? '';
    const present = current[name] ?? '';
    // Typed by the owner: theirs, whatever the page says.
    if (present.trim() && present !== earlier[name]) continue;
    if (value) owned[name] = value;
    if (present === value) continue;
    if (values === current) values = { ...current };
    values[name] = value;
  }
  return { values, owned };
}
