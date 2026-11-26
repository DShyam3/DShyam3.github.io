import { DotMatrixGlyph } from './DotMatrixGlyph';
import './DotMatrixText.css';

export type DotMatrixIconName = 'sun' | 'moon' | 'plus' | 'menu';

interface DotMatrixIconProps {
  icon: DotMatrixIconName;
  className?: string;
  size?: 'md' | 'lg' | 'grid';
}

const DOT_PITCH = {
  md: { dot: 2, gap: 1, shape: 'round' },
  lg: { dot: 3, gap: 2, shape: 'round' },
  grid: { dot: 3, gap: 3, shape: 'square' },
} as const;

const ICON_PATTERNS: Record<DotMatrixIconName, number[][]> = {
  sun: [
    [0, 0, 0, 0, 1, 0, 0, 0, 0],
    [0, 1, 0, 0, 0, 0, 0, 1, 0],
    [0, 0, 0, 1, 1, 1, 0, 0, 0],
    [0, 0, 1, 1, 1, 1, 1, 0, 0],
    [1, 0, 1, 1, 1, 1, 1, 0, 1],
    [0, 0, 1, 1, 1, 1, 1, 0, 0],
    [0, 0, 0, 1, 1, 1, 0, 0, 0],
    [0, 1, 0, 0, 0, 0, 0, 1, 0],
    [0, 0, 0, 0, 1, 0, 0, 0, 0],
  ],
  moon: [
    [0, 0, 0, 1, 1, 1, 0, 0, 0],
    [0, 1, 1, 1, 0, 0, 0, 0, 0],
    [0, 1, 1, 0, 0, 0, 0, 0, 0],
    [1, 1, 1, 0, 0, 0, 0, 0, 0],
    [1, 1, 0, 0, 0, 0, 0, 0, 0],
    [1, 1, 1, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 1, 0, 0, 0, 0, 0],
    [0, 0, 0, 1, 1, 1, 0, 0, 0],
  ],
  plus: [
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 0, 0, 0, 0],
    [0, 1, 1, 1, 1, 1, 1, 1, 0],
    [0, 0, 0, 0, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
  ],
  menu: [
    [1, 1, 1],
    [1, 1, 1],
    [1, 1, 1],
  ],
};

export const DotMatrixIcon = ({ icon, className = '', size = 'md' }: DotMatrixIconProps) => {
  const pattern = ICON_PATTERNS[icon];
  const { dot, gap, shape } = DOT_PITCH[size];

  return (
    <div className={`dot-matrix-icon ${className}`}>
      <DotMatrixGlyph pattern={pattern} dot={dot} gap={gap} shape={shape} />
    </div>
  );
};
