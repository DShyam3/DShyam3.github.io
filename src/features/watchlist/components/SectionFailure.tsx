import type { ReactNode } from 'react';

/** A section whose data did not load. Same place and weight as the empty
 *  line, so a failure never reads as "nothing to show". */
export function SectionFailure({ children }: { children: ReactNode }) {
  return <p className="px-2 py-3 text-xs text-muted-foreground">{children}</p>;
}
