/** PostgREST errors during the short rollout before the facts migration lands. */
export function missingCategoryColumns(message: string): boolean {
  return /(?:genre_ids|original_language|origin_country)/.test(message) &&
    /(?:does not exist|could not find)/i.test(message);
}
