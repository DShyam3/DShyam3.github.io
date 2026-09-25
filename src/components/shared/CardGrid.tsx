import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { CARD_GRID } from '@/theme/layout';

interface CardGridProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/** Width-driven cards retain their text and proportions at every viewport height. */
export function CardGrid({ children, className, style }: CardGridProps) {
  return <div className={cn(CARD_GRID, className)} style={style}>{children}</div>;
}
