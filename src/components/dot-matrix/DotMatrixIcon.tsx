import { useDotMatrix } from '@/contexts/DotMatrixContext';
import { DotMatrixGlyph } from './DotMatrixGlyph';
import './DotMatrixText.css';

interface DotMatrixIconProps {
  icon: string;
  className?: string;
  size?: 'md' | 'lg' | 'grid';
}

// `grid` is for the patterns that are a grid of cells rather than a drawing
// -- the menu glyph's 3x3. Round dots at the `md` pitch read as specks beside
// their own label, and enlarging them only turned the specks into bubbles;
// square cells at 3px read as lit pixels of a matrix instead, which is what
// the glyph is meant to be.
const DOT_PITCH = {
  md: { dot: 2, gap: 1, shape: 'round' },
  lg: { dot: 3, gap: 2, shape: 'round' },
  grid: { dot: 3, gap: 3, shape: 'square' },
} as const;

export const DotMatrixIcon = ({ icon, className = '', size = 'md' }: DotMatrixIconProps) => {
  const { data, loading } = useDotMatrix();

  if (loading || !data) return null;

  const { iconPatterns } = data;
  const pattern = iconPatterns[icon] || iconPatterns.plus;
  const { dot, gap, shape } = DOT_PITCH[size];

  return (
    <div className={`dot-matrix-icon ${className}`}>
      <DotMatrixGlyph pattern={pattern} dot={dot} gap={gap} shape={shape} />
    </div>
  );
};
