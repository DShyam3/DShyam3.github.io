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

const SAFE_IMAGE_DATA_URI = /^data:image\/(?:png|jpeg|jpg|webp|gif|avif|svg\+xml)[;,]/i;

/**
 * Image sources allowed in collection forms: http(s), site-relative `/...`
 * storage paths, or image data URIs (e.g. inline SVG favicons). Blocks
 * `javascript:`, `data:text/html`, and arbitrary schemes.
 */
export const safeImageSrc = (url: string | null | undefined): string | undefined => {
  const trimmed = url?.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed;
  if (SAFE_IMAGE_DATA_URI.test(trimmed)) return trimmed;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : undefined;
  } catch {
    return undefined;
  }
};
