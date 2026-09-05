import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

/**
 * Content-Security-Policy is injected as a <meta> tag because GitHub Pages
 * cannot serve custom response headers. Build-only: the dev server needs inline
 * scripts and eval for the react-refresh preamble and HMR.
 *
 * Note: `frame-ancestors` is ignored in a <meta> CSP — clickjacking is handled
 * by src/lib/frame-guard.ts instead.
 */
const cspPlugin = (supabaseUrl: string | undefined): Plugin => {
  const supabaseOrigins = supabaseUrl
    ? [supabaseUrl, supabaseUrl.replace(/^https:/, "wss:")]
    : [];

  const policy = [
    "default-src 'self'",
    "script-src 'self' https://cloud.umami.is",
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
      "https://cloud.umami.is",
      "https://gateway.umami.is",
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

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");

  return {
    base: "/",
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [react(), cspPlugin(env.VITE_SUPABASE_URL)].filter(Boolean),
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
