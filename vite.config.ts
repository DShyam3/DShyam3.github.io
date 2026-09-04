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
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
