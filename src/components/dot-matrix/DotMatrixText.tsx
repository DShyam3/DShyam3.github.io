import { useDotMatrix } from '@/contexts/DotMatrixContext';

import './DotMatrixText.css';

const DotMatrixChar = ({ char, patterns }: { char: string, patterns: Record<string, number[][]> }) => {
  const pattern =
    patterns[char] || patterns[char.toUpperCase()] || patterns[' '];

  return (
    <div className="dot-matrix-char">
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

interface DotMatrixTextProps {
  text: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  wrap?: boolean;
}

export const DotMatrixText = ({
  text,
  size = 'md',
  className = '',
  wrap = true,
}: DotMatrixTextProps) => {
  const { data, loading } = useDotMatrix();

  const sizeClass =
    size === 'lg'
      ? 'dot-matrix-text-lg'
      : size === 'sm'
        ? 'dot-matrix-text-sm'
        : size === 'xs'
          ? 'dot-matrix-text-xs'
          : '';

  const words = text.toUpperCase().split(' ');

  if (loading || !data) return null;

  const { charPatterns } = data;

  return (
    <div
      className={`dot-matrix-text ${sizeClass} ${className}`}
      style={{
        flexWrap: wrap ? 'wrap' : 'nowrap',
        rowGap: '0.75rem',
      }}
    >
      {words.map((word, wordIndex) => (
        <div key={wordIndex} style={{ display: 'flex', gap: 'inherit', flexShrink: 0 }}>
          {word.split('').map((char, charIndex) => (
            <DotMatrixChar key={`${wordIndex}-${charIndex}`} char={char} patterns={charPatterns} />
          ))}
          {wordIndex < words.length - 1 && <DotMatrixChar char=" " patterns={charPatterns} />}
        </div>
      ))}
    </div>
  );
};
