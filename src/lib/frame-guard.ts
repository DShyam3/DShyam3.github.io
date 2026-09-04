/**
 * Clickjacking mitigation.
 *
 * GitHub Pages does not let us set response headers, so `X-Frame-Options` and
 * CSP `frame-ancestors` are unavailable (`frame-ancestors` is ignored when a CSP
 * is delivered via a <meta> tag). This script-based fallback breaks the site out
 * of any cross-origin frame it is loaded into.
 */
export function installFrameGuard() {
  if (window.self === window.top) return;

  let sameOrigin = false;
  try {
    sameOrigin = window.top?.location.origin === window.location.origin;
  } catch {
    // Cross-origin parent: accessing location throws.
    sameOrigin = false;
  }

  if (sameOrigin) return;

  // Hide content first in case the navigation below is blocked by the framer.
  document.documentElement.style.display = "none";
  window.top!.location.href = window.location.href;
}
