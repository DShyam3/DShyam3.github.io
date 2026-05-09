import { useEffect, useState } from 'react';
import { useDotMatrix } from '@/contexts/DotMatrixContext';

import './DotMatrixClock.css';

const DotMatrixPattern = ({ char, patterns }: { char: string, patterns: Record<string, number[][]> }) => {
  const pattern = patterns[char] || patterns['0'];

  return (
    <>
      {pattern.map((row, rowIndex) => (
        <div key={rowIndex} className="dot-matrix-row">
          {row.map((dot, colIndex) => (
            <div key={colIndex} className={`dot-matrix-dot ${dot ? 'active' : ''}`} />
          ))}
        </div>
      ))}
    </>
  );
};

const DotMatrixDigit = ({
  char,
  prevChar,
  isFlipping,
  patterns,
}: {
  char: string;
  prevChar: string;
  isFlipping: boolean;
  patterns: Record<string, number[][]>;
}) => {
  return (
    <div className={`dot-matrix-digit-wrapper ${isFlipping ? 'flipping' : ''}`}>
      <div className="dot-matrix-digit dot-matrix-digit-front">
        <DotMatrixPattern char={isFlipping ? prevChar : char} patterns={patterns} />
      </div>
      <div className="dot-matrix-digit dot-matrix-digit-back">
        <DotMatrixPattern char={char} patterns={patterns} />
      </div>
    </div>
  );
};

export const DotMatrixClock = () => {
  const { data, loading } = useDotMatrix();
  const [time, setTime] = useState('');
  const [prevTime, setPrevTime] = useState('');
  const [flippingIndices, setFlippingIndices] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (loading || !data) return;
    const updateTime = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      const newTime = `${hours}:${minutes}:${seconds}`;

      if (time !== newTime) {
        // Find which digits changed
        const changed = new Set<number>();
        for (let i = 0; i < newTime.length; i++) {
          if (time[i] !== newTime[i]) {
            changed.add(i);
          }
        }

        if (changed.size > 0) {
          setPrevTime(time);
          setFlippingIndices(changed);

          // Update the time after a brief delay to allow the flip to start
          setTimeout(() => {
            setTime(newTime);
          }, 50);

          // Clear flipping state after animation completes
          setTimeout(() => setFlippingIndices(new Set()), 600);
        } else {
          setTime(newTime);
        }
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, [time, loading, data]);

  if (loading || !data) return null;
  const { charPatterns } = data;

  return (
    <div className="dot-matrix-clock">
      {time.split('').map((char, index) => (
        <DotMatrixDigit
          key={index}
          char={char}
          prevChar={prevTime[index] || char}
          isFlipping={flippingIndices.has(index)}
          patterns={charPatterns}
        />
      ))}
    </div>
  );
};
