import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import SITE from "./src/config/site.json" with { type: "json" };

/**
 * Content-Security-Policy is injected as a <meta> tag because GitHub Pages
 * cannot serve custom response headers. Build-only: the dev server needs inline
 * scripts and eval for the react-refresh preamble and HMR.
 *
 * Note: `frame-ancestors` is ignored in a <meta> CSP — clickjacking is handled
 * by src/lib/frame-guard.ts instead.
 */
const cspPlugin = (supabaseUrl: string | undefined, umamiScriptUrl: string | null): Plugin => {
  const supabaseOrigins = supabaseUrl
    ? [supabaseUrl, supabaseUrl.replace(/^https:/, "wss:")]
    : [];
  // Allowed from wherever the configured script is served, so a self-hosted
  // Umami is not injected and then silently blocked. Umami Cloud's script
  // reports to a separate gateway host, which is added only for that host.
  const umamiOrigin = umamiScriptUrl ? new URL(umamiScriptUrl).origin : null;
  const umamiScriptOrigins = umamiOrigin ? [umamiOrigin] : [];
  const umamiConnectOrigins = umamiOrigin
    ? [umamiOrigin, ...(umamiOrigin === "https://cloud.umami.is" ? ["https://gateway.umami.is"] : [])]
    : [];

  const policy = [
    "default-src 'self'",
    ["script-src 'self'", ...umamiScriptOrigins].join(" "),
    // 'unsafe-inline': Recharts/shadcn chart injects a <style> element and React
    // renders inline style attributes.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    // Images come from Supabase storage, TMDB, flagcdn and Google Books thumbnails,
    // plus arbitrary cover URLs stored in the database.
    "img-src 'self' data: blob: https:",
    [
      "connect-src 'self'",
      ...supabaseOrigins,
      ...umamiConnectOrigins,
      "https://www.googleapis.com",
      "https://api.themoviedb.org",
      "https://www.gov.uk",
    ].join(" "),
    "object-src 'none'",
    "frame-src 'none'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join("; ");

  return {
    name: "inject-csp-meta",
    apply: "build",
    transformIndexHtml() {
      return [
        {
          tag: "meta",
          attrs: { "http-equiv": "Content-Security-Policy", content: policy },
          injectTo: "head-prepend",
        },
      ];
    },
  };
};

/**
 * Fills in the site owner's identity — %SITE_*% tokens in index.html — from
 * src/config/site.json, and adds the Umami script tag when analytics is
 * configured. Runs before Vite's own %VITE_*% env substitution so both kinds
 * of token resolve regardless of order.
 */
/** For values dropped into HTML attributes: a quote in the description
 *  would otherwise end the attribute and break every tag after it. */
const escapeHtmlAttribute = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const sitePlugin = (): Plugin => {
  const { name, siteTitle, tagline, description, url, twitterHandle, analytics } = SITE;
  const tokens: Record<string, string> = {
    SITE_TITLE: siteTitle,
    SITE_DESCRIPTION: description,
    SITE_AUTHOR: name,
    SITE_URL: `${url}/`,
    SITE_OG_IMAGE: `${url}/og-image.png`,
    SITE_OG_IMAGE_ALT: `${name} — ${tagline.toLowerCase()}`,
    SITE_TWITTER_HANDLE: twitterHandle,
  };

  return {
    name: "inject-site-meta",
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        const withTokens = Object.entries(tokens).reduce(
          (acc, [key, value]) => acc.replaceAll(`%${key}%`, escapeHtmlAttribute(value)),
          html,
        );
        if (!analytics.umamiWebsiteId) return withTokens;
        return {
          html: withTokens,
          tags: [
            {
              tag: "script",
              attrs: {
                defer: true,
                src: analytics.umamiScriptUrl,
                "data-website-id": analytics.umamiWebsiteId,
              },
              injectTo: "head",
            },
          ],
        };
      },
    },
  };
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");

  return {
    base: "/",
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [
      react(),
      cspPlugin(env.VITE_SUPABASE_URL, SITE.analytics.umamiWebsiteId ? SITE.analytics.umamiScriptUrl : null),
      sitePlugin(),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "./src"),
      },
    },
    // Vitest reads this config too. Node environment only: the suites here
    // cover pure logic (sync decisions, formatting), which is the part worth
    // testing without a DOM.
    test: {
      include: ["src/**/*.test.ts"],
      environment: "node",
    },
    build: {
      rollupOptions: {
        output: {
          /**
           * Group node_modules into a few stable chunks.
           *
           * Vite's default splitting produced ~20 chunks of 4 kB each -- one
           * per lucide icon, one per Radix primitive -- and a route pulled
           * about twenty of them before it could render. On the dev server
           * that is free; on GitHub Pages it is twenty cold round trips every
           * time you open a section you have not visited yet, which is why
           * navigation felt fine locally and slow in production.
           *
           * Only libraries every page already needs are grouped. Route chunks
           * and route-specific libraries are left alone -- recharts above all,
           * which is reachable only from the finance page and would push
           * ~400 kB onto every other page if it were hoisted.
           */
          manualChunks(id: string) {
            if (!id.includes("node_modules")) return;
            if (id.includes("recharts") || id.includes("/d3-")) return;
            if (id.includes("react-router")) return "vendor-react";
            if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) {
              return "vendor-react";
            }
            if (id.includes("@supabase")) return "vendor-supabase";
            if (id.includes("@tanstack")) return "vendor-query";
            if (
              id.includes("lucide-react") ||
              id.includes("class-variance-authority") ||
              id.includes("clsx") ||
              id.includes("tailwind-merge")
            ) {
              return "vendor-ui";
            }
            // No catch-all bucket. Anything not named above (date-fns,
            // react-day-picker, sonner, ...) is reachable from only some
            // routes, and a catch-all would make the entry chunk eagerly
            // pull it on every page load.
            return undefined;
          },
        },
      },
    },
  };
});
