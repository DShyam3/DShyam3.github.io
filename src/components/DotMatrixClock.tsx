import { useEffect, useState } from 'react';
import { charPatterns as digitPatterns } from '@/lib/dot-matrix';
import './DotMatrixClock.css';

const DotMatrixPattern = ({ char }: { char: string }) => {
  const pattern = digitPatterns[char] || digitPatterns['0'];

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
}: {
  char: string;
  prevChar: string;
  isFlipping: boolean;
}) => {
  return (
    <div className={`dot-matrix-digit-wrapper ${isFlipping ? 'flipping' : ''}`}>
      <div className="dot-matrix-digit dot-matrix-digit-front">
        <DotMatrixPattern char={isFlipping ? prevChar : char} />
      </div>
      <div className="dot-matrix-digit dot-matrix-digit-back">
        <DotMatrixPattern char={char} />
      </div>
    </div>
  );
};

export const DotMatrixClock = () => {
  const [time, setTime] = useState('');
  const [prevTime, setPrevTime] = useState('');
  const [flippingIndices, setFlippingIndices] = useState<Set<number>>(new Set());

  useEffect(() => {
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
  }, [time]);

  return (
    <div className="dot-matrix-clock">
      {time.split('').map((char, index) => (
        <DotMatrixDigit
          key={index}
          char={char}
          prevChar={prevTime[index] || char}
          isFlipping={flippingIndices.has(index)}
        />
      ))}
    </div>
  );
};
