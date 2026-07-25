import { useDotMatrix } from '@/contexts/DotMatrixContext';
import { DotMatrixGlyph } from './DotMatrixGlyph';
import './DotMatrixText.css';

interface DotMatrixIconProps {
  icon: string;
  className?: string;
  size?: 'md' | 'lg';
}

const DOT_PITCH = {
  md: { dot: 2, gap: 1 },
  lg: { dot: 3, gap: 2 },
};

export const DotMatrixIcon = ({ icon, className = '', size = 'md' }: DotMatrixIconProps) => {
  const { data, loading } = useDotMatrix();

  if (loading || !data) return null;

  const { iconPatterns } = data;
  const pattern = iconPatterns[icon] || iconPatterns.plus;
  const { dot, gap } = DOT_PITCH[size];

  return (
    <div className={`dot-matrix-icon ${className}`}>
      <DotMatrixGlyph pattern={pattern} dot={dot} gap={gap} />
    </div>
  );
};
