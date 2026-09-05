import { useEffect, useRef, useState } from 'react';

import './DotMatrixClock.css';

/**
 * One character of the clock, mounted twice: the face you see and the face
 * waiting behind it. Flipping swaps them.
 */
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
    <span className={`dot-matrix-digit-wrapper ${isFlipping ? 'flipping' : ''}`}>
      <span className="dot-matrix-digit dot-matrix-digit-front">
        {isFlipping ? prevChar : char}
      </span>
      <span className="dot-matrix-digit dot-matrix-digit-back">{char}</span>
    </span>
  );
};

/**
 * The footer clock.
 *
 * The digits are Doto, the same face as the words either side of them, and
 * not the hand-drawn dot grid this used to build out of `charPatterns`. That
 * grid could only be sized in whole pixels -- a dot is a div, and a
 * fractional one smears under its own border-radius -- so it could not follow
 * the text as the footer face and the root size grew, and it read as a blur
 * beside crisp glyphs. A font has no such problem: it is the same glyphs at
 * whatever size it is set to.
 */
export const DotMatrixClock = () => {
  const [time, setTime] = useState('');
  const [prevTime, setPrevTime] = useState('');
  const [flippingIndices, setFlippingIndices] = useState<Set<number>>(new Set());
  // Tracks the latest displayed time for comparisons inside the interval
  // callback without making the effect depend on `time` state -- depending
  // on it meant setTime() (fired every second) re-ran the effect and tore
  // down/recreated the interval every second, drifting the tick cadence.
  const timeRef = useRef('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      const newTime = `${hours}:${minutes}:${seconds}`;
      const previousTime = timeRef.current;

      if (previousTime !== newTime) {
        // Find which digits changed
        const changed = new Set<number>();
        for (let i = 0; i < newTime.length; i++) {
          if (previousTime[i] !== newTime[i]) {
            changed.add(i);
          }
        }

        if (changed.size > 0) {
          setPrevTime(previousTime);
          setFlippingIndices(changed);

          // Update the time after a brief delay to allow the flip to start
          setTimeout(() => {
            timeRef.current = newTime;
            setTime(newTime);
          }, 50);

          // Clear flipping state after animation completes
          setTimeout(() => setFlippingIndices(new Set()), 600);
        } else {
          timeRef.current = newTime;
          setTime(newTime);
        }
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <span className="dot-matrix-clock dot-matrix-text dot-matrix-text-xs">
      {time.split('').map((char, index) => (
        <DotMatrixDigit
          key={index}
          char={char}
          prevChar={prevTime[index] || char}
          isFlipping={flippingIndices.has(index)}
        />
      ))}
    </span>
  );
};
