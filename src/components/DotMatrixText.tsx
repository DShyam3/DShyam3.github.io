import { charPatterns } from '@/lib/dot-matrix';
import './DotMatrixText.css';

const DotMatrixChar = ({ char }: { char: string }) => {
  const pattern =
    charPatterns[char] || charPatterns[char.toUpperCase()] || charPatterns[' '];

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
  const sizeClass =
    size === 'lg'
      ? 'dot-matrix-text-lg'
      : size === 'sm'
        ? 'dot-matrix-text-sm'
        : size === 'xs'
          ? 'dot-matrix-text-xs'
          : '';

  const words = text.toUpperCase().split(' ');

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
            <DotMatrixChar key={`${wordIndex}-${charIndex}`} char={char} />
          ))}
          {wordIndex < words.length - 1 && <DotMatrixChar char=" " />}
        </div>
      ))}
    </div>
  );
};
