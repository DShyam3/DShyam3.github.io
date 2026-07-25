import { DotMatrixGlyph } from './DotMatrixGlyph';
import heroGlyphs from '@/data/hero-glyphs.json';
import './DotMatrixText.css';

type HeroGlyphName = keyof typeof heroGlyphs;

interface DotMatrixHeroGlyphProps {
  glyph: HeroGlyphName;
  className?: string;
  size?: 'md' | 'lg';
}

// 25x25 "hero" tier for standalone display moments (status glyphs, feature
// icons, one-off badges) -- distinct from the small 9x9 iconPatterns in
// dot-matrix.json used for inline UI (social links, theme toggle). Dots need
// to stay >=1.5px to read as dots rather than blur, so at this resolution a
// glyph renders around 60-98px square; not a drop-in replacement for small
// icon slots. See scripts/generate-hero-glyphs.py to add more.
const DOT_PITCH = {
  md: { dot: 1.6, gap: 0.9 },
  lg: { dot: 2.5, gap: 1.5 },
};

export const DotMatrixHeroGlyph = ({ glyph, className = '', size = 'md' }: DotMatrixHeroGlyphProps) => {
  const pattern = heroGlyphs[glyph];
  const { dot, gap } = DOT_PITCH[size];

  if (!pattern) return null;

  return (
    <div className={`dot-matrix-icon ${className}`}>
      <DotMatrixGlyph pattern={pattern} dot={dot} gap={gap} />
    </div>
  );
};
