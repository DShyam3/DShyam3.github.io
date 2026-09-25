import { useId, useState } from 'react';
import { ArrowUpRight, ShieldCheck, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { DotMatrixText } from '@/components/dot-matrix/DotMatrixText';
import { SITE } from '@/config/site';
import './PrivacyDialog.css';

type Tab = 'privacy' | 'credits';

const TABS: { id: Tab; label: string; icon: typeof ShieldCheck }[] = [
  { id: 'privacy', label: 'Privacy', icon: ShieldCheck },
  { id: 'credits', label: 'Credits', icon: Sparkles },
];

const INSPIRATION_LINKS = [
  { name: 'Opening Page', url: 'https://martingauer.com', author: 'Martin Gauer' },
  { name: 'Inventory', url: 'https://goods.jackcohen.com/?category=Wishlist', author: 'Jack Cohen' },
  { name: 'Links', url: 'https://www.linklowdown.com/category/mac-app', author: 'Linklowdown' },
];

/**
 * Label above value on a phone, beside it from 640px up (see the CSS).
 *
 * These sections were paragraphs, which in a dot-matrix face at this size is
 * a wall nobody reads -- and the one thing a privacy notice has to be is
 * read. Broken into facts, the answer to "does this site track me" is two
 * words rather than a sentence buried mid-paragraph.
 *
 * A <dl> because that is what this is: terms and their definitions. Screen
 * readers announce the pairing.
 */
function FactList({ items }: { items: [string, string][] }) {
  return (
    <dl className="privacy-facts">
      {items.map(([term, value]) => (
        <div key={term} className="privacy-fact">
          <dt>
            <DotMatrixText text={term} size="xs" className="privacy-fact-term" />
          </dt>
          <dd>
            <DotMatrixText text={value} size="xs" />
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The footer's copyright mark, and the privacy notice and credits behind it.
 *
 * Built on the shared Dialog rather than its own overlay. The overlay it had
 * rendered in place inside the footer, whose stacking context sits below the
 * header's, so the header painted over the top of the card; and its own
 * tablet breakpoint turned it into a bottom sheet on an iPad in portrait.
 * The shared Dialog portals to the body and brings the site's glass surface,
 * gutters, scrolling body, close button, focus trap and Escape with it.
 */
export function PrivacyDialog() {
  const [activeTab, setActiveTab] = useState<Tab>('privacy');
  const id = useId();
  const year = String(new Date().getFullYear());

  return (
    <Dialog onOpenChange={(open) => open && setActiveTab('privacy')}>
      <DialogTrigger
        className="flex items-center hover:opacity-70 transition-opacity cursor-pointer text-muted-foreground"
        aria-label="Privacy and credits"
      >
        <DotMatrixText text={`© ${year}`} size="xs" wrap={false} />
      </DialogTrigger>

      <DialogContent className="privacy-dialog max-w-2xl">
        <DialogHeader className="text-left">
          <DialogTitle className="sr-only">Privacy and credits</DialogTitle>
          <DialogDescription className="sr-only">
            How this site handles your data, and the work that inspired it.
          </DialogDescription>
          <div role="tablist" aria-label="Privacy and credits" className="flex gap-2">
            {TABS.map(({ id: tab, label, icon: Icon }) => (
              <Button
                key={tab}
                id={`${id}-${tab}-tab`}
                role="tab"
                aria-selected={activeTab === tab}
                aria-controls={`${id}-${tab}-panel`}
                variant={activeTab === tab ? 'secondary' : 'ghost'}
                className="gap-2"
                onClick={() => setActiveTab(tab)}
              >
                <Icon />
                {label}
              </Button>
            ))}
          </div>
        </DialogHeader>

        {activeTab === 'privacy' && (
          <div
            role="tabpanel"
            id={`${id}-privacy-panel`}
            aria-labelledby={`${id}-privacy-tab`}
            className="privacy-panel"
          >
            {/* One list, no section headings: the tab names it, and owner and
                year were already on the button that opened it. Short enough
                to fit a laptop or phone without the body scrolling. */}
            <FactList
              items={[
                ['Cookies', 'None'],
                ['Personal data', 'None collected'],
                [
                  'Analytics',
                  // Stated only when the script is actually injected (vite.config.ts
                  // adds it only for a configured website id).
                  SITE.analytics.umamiWebsiteId
                    ? 'Umami, cookieless. Page, referrer, country. No profile, no tracking across sites.'
                    : 'None.',
                ],
                ['Admin sign-in', 'Stores a session in your browser'],
                [
                  'Copyright',
                  `© ${year} ${SITE.name}. All rights reserved. Content and design are original work.`,
                ],
              ]}
            />
          </div>
        )}

        {activeTab === 'credits' && (
          <div
            role="tabpanel"
            id={`${id}-credits-panel`}
            aria-labelledby={`${id}-credits-tab`}
            className="privacy-panel"
          >
            <DotMatrixText text="Inspired by" size="xs" className="privacy-fact-term" />
            <ul className="privacy-credits grid gap-2">
              {INSPIRATION_LINKS.map((link) => (
                <li key={link.url}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="privacy-credit group flex items-center justify-between gap-4 rounded-2xl border border-border/60 bg-card/50 px-4 py-3 transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="grid gap-1.5 min-w-0">
                      <DotMatrixText text={link.name} size="xs" />
                      <DotMatrixText text={link.author} size="xs" className="privacy-fact-term" />
                    </span>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
