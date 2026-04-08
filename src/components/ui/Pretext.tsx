import { useEffect, useRef, useState, ReactNode } from 'react';
import { prepareWithSegments, layoutWithLines, walkLineRanges } from '@chenglou/pretext';

interface PretextProps {
  text: string;
  className?: string;
  truncateLines?: number;
  suffix?: ReactNode;
}

export function Pretext({ text, className, truncateLines, suffix }: PretextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<string[]>([]);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current || !text) return;

    const el = containerRef.current;
    
    const updateLayout = () => {
      const styles = window.getComputedStyle(el);
      // Construct a strictly valid canvas font string without line-height
      const weight = styles.fontWeight || 'normal';
      const size = styles.fontSize;
      const family = styles.fontFamily;
      const font = `${weight} ${size} ${family}`.trim();
      const paddingX = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
      const containerWidth = el.clientWidth - paddingX;

      if (containerWidth <= 0) return;

      try {
        const prepared = prepareWithSegments(text, font, { whiteSpace: 'normal' });
        
        let parsedLineHeight = parseFloat(styles.lineHeight);
        if (isNaN(parsedLineHeight)) {
          parsedLineHeight = parseFloat(styles.fontSize) * 1.2;
        }

        let low = 0;
        let high = containerWidth;
        
        walkLineRanges(prepared, containerWidth, (line) => {
          if (line.width > low) low = line.width;
        });
        
        const baseLineCount = layoutWithLines(prepared, containerWidth, parsedLineHeight).lineCount;
        let bestWidth = containerWidth;

        while (low <= high && high - low > 1) {
          const mid = (low + high) / 2;
          let currentLineCount = 0;
          walkLineRanges(prepared, mid, () => { currentLineCount++; });
          
          if (currentLineCount <= baseLineCount) {
             bestWidth = mid;
             high = mid;
          } else {
             low = mid;
          }
        }

        const layoutResult = layoutWithLines(prepared, bestWidth, parsedLineHeight);
        let finalLines = layoutResult.lines.map(l => l.text);

        if (truncateLines && finalLines.length > truncateLines) {
           finalLines = finalLines.slice(0, truncateLines);
           finalLines[finalLines.length - 1] = finalLines[finalLines.length - 1].replace(/\s+\S*$/, '') + '...';
        }

        setLines(finalLines);
        setIsReady(true);
      } catch (err) {
         console.error("Pretext error:", err);
         setLines([text]);
         setIsReady(true);
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(updateLayout);
    });

    resizeObserver.observe(el);
    updateLayout();

    return () => resizeObserver.disconnect();
  }, [text, truncateLines]);

  return (
    <div 
      ref={containerRef} 
      className={className} 
      style={{ opacity: isReady ? 1 : 0, transition: 'opacity 0.2s', minWidth: 0, width: '100%' }}
    >
      {isReady ? lines.map((line, idx) => (
        <div key={idx} style={{ whiteSpace: 'pre-wrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {line.trim() || ' '}
          {idx === lines.length - 1 && suffix}
        </div>
      )) : (
        <span>{text}{suffix}</span>
      )}
    </div>
  );
}
