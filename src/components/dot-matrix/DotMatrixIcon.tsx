import { useDotMatrix } from '@/contexts/DotMatrixContext';

import './DotMatrixText.css';

interface DotMatrixIconProps {
  icon: string;
  className?: string;
}

export const DotMatrixIcon = ({ icon, className = '' }: DotMatrixIconProps) => {
  const { data, loading } = useDotMatrix();

  if (loading || !data) return null;

  const { iconPatterns } = data;
  const pattern = iconPatterns[icon] || iconPatterns.plus;

  return (
    <div className={`dot-matrix-icon ${className}`}>
      {pattern.map((row, rowIndex) => (
        <div key={rowIndex} className="dot-matrix-row">
          {row.map((dot, colIndex) => (
            <div key={colIndex} className={`dot-matrix-dot ${dot ? 'active' : ''}`} />
          ))}
        </div>
      ))}
    </div>
  );
};
