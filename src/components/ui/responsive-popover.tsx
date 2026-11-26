import type { ReactElement, ReactNode } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useIsMobile } from '@/hooks/use-mobile';

interface ResponsivePopoverProps {
  /** The button that opens it, rendered as the trigger (`asChild`). */
  trigger: ReactElement;
  /** Heading inside the panel. */
  title: string;
  /** Accessible name of the panel. Defaults to the title. */
  label?: string;
  /** Gap between the children. */
  spacing?: 'space-y-3' | 'space-y-4';
  children: ReactNode;
}

/**
 * A small panel opened from a toolbar button: a bottom drawer on a phone,
 * where a popover would be cramped and hard to dismiss, and a popover
 * anchored to the button elsewhere. Scrolls inside itself when it is taller
 * than the room it has.
 */
export function ResponsivePopover({
  trigger,
  title,
  label = title,
  spacing = 'space-y-3',
  children,
}: ResponsivePopoverProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer>
        <DrawerTrigger asChild>{trigger}</DrawerTrigger>
        <DrawerContent aria-label={label}>
          <DrawerHeader className="text-left">
            <DrawerTitle>{title}</DrawerTitle>
          </DrawerHeader>
          <div className={`app-scroll overflow-y-auto px-4 pb-6 ${spacing}`}>{children}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="end"
        collisionPadding={12}
        className={`w-80 max-w-[calc(100vw-24px)] overflow-y-auto overscroll-contain ${spacing}`}
        style={{ maxHeight: 'min(480px, var(--radix-popover-content-available-height))' }}
        aria-label={label}
      >
        <h3 className="font-medium">{title}</h3>
        {children}
      </PopoverContent>
    </Popover>
  );
}
