import { useEffect, useRef, useState, useLayoutEffect } from 'react';
import { prepareWithSegments, layoutWithLines, walkLineRanges } from '@chenglou/pretext';
import { cn } from '@/lib/utils';

interface BalancedTextProps {
  text: string;
  className?: string;
  maxLines?: number;
}

export function BalancedText({ text, className, maxLines }: BalancedTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [renderedLines, setLines] = useState<{text: string, width: number}[]>([]);
  const [styles, setStyles] = useState<{ lineHeight: string }>({ lineHeight: 'normal' });

  useLayoutEffect(() => {
    if (!containerRef.current || !text) return;
    const el = containerRef.current;
    
    // We need an unconstrained width first to get the font properly, but we can read from the parent container
    const update = () => {
      const computed = window.getComputedStyle(el);
      const font = computed.font || `${computed.fontWeight} ${computed.fontSize}/${computed.lineHeight} ${computed.fontFamily}`;
      
      const paddingX = parseFloat(computed.paddingLeft) + parseFloat(computed.paddingRight);
      const containerWidth = el.clientWidth - paddingX;
      
      if (containerWidth <= 0) return;

      const prepared = prepareWithSegments(text, font);
      
      // Calculate parsed line height
      const parsedLineHeight = computed.lineHeight === 'normal' 
        ? parseFloat(computed.fontSize) * 1.2 
        : parseFloat(computed.lineHeight);

      // We want to find a nice wrap width that balances the lines so there are no huge orphans
      // and we want it to fit inside containerWidth.
      // We can do a binary search or just take the layout from pretext directly.
      let { lines } = layoutWithLines(prepared, containerWidth, parsedLineHeight);
      
      // Filter out empty lines just in case
      let finalLines = lines.map(line => ({ text: line.text, width: line.width }));

      // If text breaks mid-word, we might want to scale font down or just use truncation.
      // But for now, we render the EXACT lines layout provided.
      if (maxLines && finalLines.length > maxLines) {
        finalLines = finalLines.slice(0, maxLines);
        if (finalLines.length > 0) {
           finalLines[finalLines.length - 1].text += '...';
        }
      }

      setLines(finalLines);
      setStyles({ lineHeight: computed.lineHeight });
    };

    const observer = new ResizeObserver(update);
    observer.observe(el);
    update();

    return () => observer.disconnect();
  }, [text, maxLines]);

  return (
    <div ref={containerRef} className={cn('min-w-0 flex-1', className)}>
      {renderedLines.length > 0 ? (
        renderedLines.map((line, idx) => (
          <div key={idx} style={{ lineHeight: styles.lineHeight, whiteSpace: 'pre', overflow: 'hidden' }}>
            {line.text.trim() || ' '}
          </div>
        ))
      ) : (
        <span className="opacity-0">{text}</span>
      )}
    </div>
  );
}
