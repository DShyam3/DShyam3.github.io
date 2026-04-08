import { useEffect, useRef, useState } from 'react';
import { prepareWithSegments, layoutWithLines, clearCache } from '@chenglou/pretext';
import { cn } from '@/lib/utils';

interface PretextLayoutProps {
  text: string;
  className?: string;
}

export function PretextLayout({ text, className }: PretextLayoutProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<string[]>([text]); // default to original text
  const [lineHeight, setLineHeight] = useState('normal');

  useEffect(() => {
    if (!containerRef.current || !text) return;

    const el = containerRef.current;
    
    const updateLayout = () => {
      const styles = window.getComputedStyle(el);
      const font = styles.font || `${styles.fontWeight} ${styles.fontSize}/${styles.lineHeight} ${styles.fontFamily}`;
      const paddingX = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
      const containerWidth = el.clientWidth - paddingX;
      
      const parsedLineHeight = styles.lineHeight === 'normal' 
        ? parseFloat(styles.fontSize) * 1.2 
        : parseFloat(styles.lineHeight);
        
      if (containerWidth <= 0) return;

      try {
        const prepared = prepareWithSegments(text, font);
        const layout = layoutWithLines(prepared, containerWidth, parsedLineHeight);
        setLines(layout.lines.map(l => l.text));
        setLineHeight(styles.lineHeight);
      } catch (err) {
        console.error("Pretext layout error:", err);
      }
    };

    const observer = new ResizeObserver(() => {
      updateLayout();
    });

    observer.observe(el);
    updateLayout();

    return () => {
      observer.disconnect();
    };
  }, [text]);

  return (
    <div ref={containerRef} className={cn('overflow-hidden', className)}>
      {lines.map((line, idx) => (
        <div key={idx} style={{ lineHeight, whiteSpace: 'pre' }}>
          {line.trim() || ' '}
        </div>
      ))}
    </div>
  );
}
