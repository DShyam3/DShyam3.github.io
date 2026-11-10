import { lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Skeleton } from '@/components/ui/skeleton';

// The chart library is the heavy part, and only this page draws with it
// outside Finance, so it loads when the page does.
const YearInHours = lazy(() =>
  import('@/features/thoughts/YearInHours').then((module) => ({ default: module.YearInHours })),
);

const YearInHoursPage = () => (
  <AppShell title="Thoughts" subtitle="A year in hours">
    <div className="px-4 md:px-0 py-3 space-y-4">
      <Link
        to="/thoughts"
        className="inline-flex min-h-11 items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        All thoughts
      </Link>
      <Suspense fallback={<Skeleton className="h-96 rounded-lg" />}>
        <YearInHours />
      </Suspense>
    </div>
  </AppShell>
);

export default YearInHoursPage;
