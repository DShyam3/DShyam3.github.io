/**
 * Links that come from stored rows, made safe to put in an `href`.
 *
 * A saved URL is typed text, and an `href` runs whatever scheme it is given:
 * `javascript:` executes on click, `data:` opens arbitrary content. Only an
 * absolute http(s) or mailto URL is a link here; anything else -- a script
 * scheme, a typo, a bare `www.` address -- renders as no link at all.
 */
const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

export const safeHref = (url: string | null | undefined): string | undefined => {
  const trimmed = url?.trim();
  if (!trimmed) return undefined;
  try {
    const parsed = new URL(trimmed);
    return SAFE_PROTOCOLS.has(parsed.protocol) ? parsed.href : undefined;
  } catch {
    return undefined;
  }
};
