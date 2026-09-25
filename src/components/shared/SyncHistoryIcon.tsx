/**
 * lucide's History icon, with only its arrow turning while a sync runs.
 *
 * Spinning the whole icon turns the clock hands too, which reads as a broken
 * clock rather than work in progress. Same paths as lucide-react's History, so
 * at rest it is indistinguishable from it.
 */

import { cn } from '@/lib/utils';

export function SyncHistoryIcon({ spinning = false, className }: { spinning?: boolean; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('shrink-0', className)}
      aria-hidden
    >
      {/* Rotates about the clock face's centre, not the group's own box. */}
      <g
        className={cn(spinning && 'animate-spin')}
        style={{ transformBox: 'view-box', transformOrigin: '12px 12px' }}
      >
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
      </g>
      <path d="M12 7v5l4 2" />
    </svg>
  );
}
