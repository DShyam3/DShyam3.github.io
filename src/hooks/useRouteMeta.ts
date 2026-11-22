import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { canonicalUrlFor, resolveRouteMeta } from '@/config/route-meta';

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function removeMeta(attr: 'name' | 'property', key: string) {
  document.head.querySelector(`meta[${attr}="${key}"]`)?.remove();
}

function upsertCanonical(href: string) {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
}

/**
 * Keeps document title, meta description, canonical link, Open Graph URL/title/description,
 * and robots directives in sync with the active React Router pathname.
 */
export function useRouteMeta() {
  const { pathname } = useLocation();

  useEffect(() => {
    const meta = resolveRouteMeta(pathname);
    const canonical = canonicalUrlFor(meta.path);

    document.title = meta.title;
    upsertMeta('name', 'description', meta.description);
    upsertMeta('property', 'og:title', meta.title);
    upsertMeta('property', 'og:description', meta.description);
    upsertMeta('property', 'og:url', canonical);
    upsertCanonical(canonical);

    if (meta.noindex) {
      upsertMeta('name', 'robots', 'noindex, nofollow');
    } else {
      removeMeta('name', 'robots');
    }
  }, [pathname]);
}
