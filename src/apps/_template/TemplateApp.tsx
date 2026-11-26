import { DotMatrixText } from '@/components/dot-matrix/DotMatrixText';

/**
 * Starter template for a portable drop-in app.
 *
 * Copy this folder (e.g. `src/apps/my-app/MyApp.tsx`), build your UI inside,
 * and register it with one `definePortableApp({ ... })` entry in
 * `src/apps/portable.tsx`.
 *
 * The suite automatically wraps your component in `<AppShell>` (Header,
 * Sidebar page list, scrollable middle card, and Footer), mounts its route,
 * adds it to the sidebar / mobile switcher / ⌘K palette, and sets its browser
 * tab title and accent colour.
 */
export default function TemplateApp() {
  return (
    <div className="space-y-6 py-4">
      <header className="space-y-2">
        <DotMatrixText text="TEMPLATE APP" size="lg" className="text-foreground" />
        <p className="text-sm text-muted-foreground max-w-2xl">
          Replace this component with your own page. It automatically inherits the
          shared Header, Apps sidebar, middle scrollable frame, and Footer.
        </p>
      </header>

      <section className="rounded-2xl border border-border/60 bg-card/60 p-5">
        <p className="text-sm text-foreground">
          Drop your content, cards, or interactive controls here.
        </p>
      </section>
    </div>
  );
}
