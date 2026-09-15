import { Tv } from 'lucide-react';
import { DotMatrixText } from '@/components/dot-matrix/DotMatrixText';
import type { UpNextRailItem } from '@/features/watchlist/useUpNext';
import { providerSearchUrl } from '@/features/watchlist/provider-links';
import { hasPlatformLogo, PlatformLogo } from '@/features/watchlist/components/PlatformLogo';

interface UpNextRailProps {
  /** Held at page level (REHAUL_PLAN.md 8.C-bis) so the same rendered rows
   *  can also build the News page's cross-section dedup sets, instead of the
   *  rail re-running `selectUpNextRail` on its own fetch. */
  items: UpNextRailItem[];
  /** Opens the detail dialog for this show -- held at page level so News can
   *  share one dialog across every rail. */
  onSelect: (tvShowId: number) => void;
}

/**
 * The one feature that justifies a watchlist home page (REHAUL_PLAN.md 8.A,
 * narrowed in 8.C): every show either mid-season ("Continue") or freshly
 * aired within the last fortnight ("New"), in one rail. A show finished long
 * ago, or one you have never opened, stays out of it -- see
 * `selectUpNextRail` in watchlist-utils.ts for the rule.
 *
 * Cards are short and horizontal (REHAUL_PLAN.md 8.C-bis): a small poster
 * thumb, the title, the next episode, and a link to watch it -- the whole
 * card is a button that opens that show's detail dialog, except the watch
 * link, which stops the click from reaching it.
 */
export function UpNextRail({ items, onSelect }: UpNextRailProps) {
  if (items.length === 0) return null;

  return (
    <section className="min-w-0 space-y-3">
      <DotMatrixText text="WATCH NEXT" size="xs" />
      {/* A plain wrapper, not the scroller, takes `space-y-3`'s margin-top
       *  (its compiled selector outweighs a plain `-my-*` on the same
       *  element). `py-8`/`-my-8` on the scroller below give its hover lift,
       *  focus ring and shadow room to paint without being clipped by the
       *  `overflow-y: auto` that `overflow-x-auto` forces -- see the longer
       *  version of this comment on `NewsRow` in WatchlistNews.tsx, which
       *  this rail mirrors. */}
      <div>
        <div
          className="flex gap-3 overflow-x-auto py-8 -my-8"
          tabIndex={0}
          role="region"
          aria-label="Watch next"
        >
          {items.map((item) => {
            // A search page on the provider's own site, not a deep link --
            // see provider-links.ts.
            const watchUrl = providerSearchUrl(item.platform, item.title);

            return (
              <button
                key={item.tv_show_id}
                type="button"
                onClick={() => onSelect(item.tv_show_id)}
                // Grow to share the row, down to 13rem before scrolling: three
                // cards fit a 768px tablet without a scrollbar, a phone still
                // scrolls with the next card peeking, and a wide screen caps
                // each at 18rem rather than stretching one card across it.
                className="item-card flex min-w-[13rem] max-w-[18rem] flex-1 basis-0 gap-2.5 p-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <div className="aspect-[2/3] w-14 shrink-0 overflow-hidden rounded bg-muted lg:w-16">
                  {item.poster ? (
                    <img
                      src={item.poster}
                      alt={item.title}
                      className="h-full w-full object-contain"
                      loading="lazy"
                    />
                  ) : (
                    <div className="missing-art flex h-full w-full items-center justify-center">
                      <Tv className="h-4 w-4" />
                    </div>
                  )}
                </div>

                <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
                  <h3 className="card-title line-clamp-2 font-serif text-sm font-medium leading-tight">
                    {item.title}
                  </h3>

                  <p className="line-clamp-1 text-xs text-muted-foreground">
                    S{item.season_number}E{item.episode_number}
                    {item.episode_title && ` · ${item.episode_title}`}
                  </p>

                  {watchUrl ? (
                    <a
                      href={watchUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Watch on ${item.platform}`}
                      className="w-fit"
                    >
                      {hasPlatformLogo(item.platform) ? (
                        <PlatformLogo platform={item.platform} size={14} />
                      ) : (
                        <span className="text-xs font-medium text-foreground underline-offset-2 hover:underline">
                          {item.platform}
                        </span>
                      )}
                    </a>
                  ) : (
                    <span className="w-fit text-xs text-muted-foreground">{item.platform}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
