import { useState } from 'react';
import { cn } from '@/lib/utils';
import { resolveMerchant } from '@/lib/finance';
import { bundledMerchantLogo } from '../merchant-logo-assets';

/**
 * The mark beside a transaction, in falling order of fidelity:
 *
 *   1. a brand mark bundled with the build (route B);
 *   2. a logo cached in our own storage (route C);
 *   3. a monogram -- initials on a colour derived from the merchant (route A).
 *
 * Only the third always exists, so it is the one that carries the design.
 * Colour is a pure function of the merchant name, which is what makes a list
 * scannable: Tesco is the same green-ish tile on every row, every device and
 * every reload, without a lookup table deciding so.
 *
 * A row with no merchant -- anything typed by hand -- keeps the older
 * category tile, tinted by direction. That is not a downgrade: nobody told us
 * who was paid, and inventing a brand identity for "rent" would be a lie the
 * eye reads as fact.
 */
export function MerchantAvatar({
  merchant,
  category,
  isIncome,
  cachedLogo,
  className,
}: {
  merchant?: string | null;
  category?: string;
  isIncome: boolean;
  /** Public URL from `useMerchantLogos`, when the cache holds this merchant. */
  cachedLogo?: string;
  className?: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);

  const base = cn(
    'h-8 w-8 rounded-xl shrink-0 flex items-center justify-center overflow-hidden',
    'font-bold text-xs uppercase shadow-sm border',
    className,
  );

  if (!merchant?.trim()) {
    return (
      <div
        aria-hidden
        className={cn(
          base,
          isIncome
            ? 'bg-positive/10 text-positive border-positive/20'
            : 'bg-destructive/10 text-destructive border-destructive/20',
        )}
      >
        {category ? category.charAt(0) : 'T'}
      </div>
    );
  }

  const { label, initials, hue, slug } = resolveMerchant(merchant);
  const logo = bundledMerchantLogo(slug) ?? cachedLogo;

  if (logo && !imageFailed) {
    return (
      <div className={cn(base, 'bg-background border-border/60 p-1')}>
        <img
          src={logo}
          alt={label}
          className="h-full w-full object-contain"
          loading="lazy"
          decoding="async"
          // A cached logo can go stale -- an object deleted from the bucket,
          // a bundled file renamed -- and a broken-image glyph is worse than
          // the monogram it replaced.
          onError={() => setImageFailed(true)}
        />
      </div>
    );
  }

  // `--monogram-lightness` flips with the theme (src/index.css), so one hue
  // reads on both grounds without the component knowing which is showing.
  const ink = `hsl(${hue} 62% var(--monogram-lightness))`;
  return (
    <div
      aria-hidden
      title={label}
      className={base}
      style={{
        backgroundColor: `hsl(${hue} 62% var(--monogram-lightness) / 0.18)`,
        borderColor: `hsl(${hue} 62% var(--monogram-lightness) / 0.35)`,
        color: ink,
      }}
    >
      {initials}
    </div>
  );
}
