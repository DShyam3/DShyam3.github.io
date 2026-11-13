interface FlagStripProps {
  /** ISO 3166-1 alpha-2 codes, in the order to show them. */
  codes: string[];
  /** How many flags at most; the rest are left out. */
  max?: number;
  className?: string;
}

/** A row of small overlapping flags, for a glance at where somewhere covers. Decorative. */
export function FlagStrip({ codes, max = 5, className = '' }: FlagStripProps) {
  if (codes.length === 0) return null;
  return (
    <span className={`flag-strip ${className}`} aria-hidden="true">
      {codes.slice(0, max).map((code) => (
        <img key={code} src={`https://flagcdn.com/w40/${code.toLowerCase()}.png`} alt="" loading="lazy" decoding="async" />
      ))}
    </span>
  );
}
