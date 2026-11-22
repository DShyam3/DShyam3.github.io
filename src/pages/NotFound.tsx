import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { DotMatrixText } from "@/components/dot-matrix/DotMatrixText";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  // Inside the shell like every other route, so the navigation menu is still
  // there as a way out besides the link home. Header already renders the page
  // <h1>, so this display code uses a <p> to keep one <h1> per page.
  return (
    <AppShell title="Not found" subtitle="404">
      <div className="mx-auto flex max-w-md flex-col items-center py-20 text-center">
        <p className="mb-3" aria-hidden="true">
          <DotMatrixText text="404" size="lg" className="text-primary" />
        </p>
        <p className="mb-2 font-mono text-sm text-foreground">
          No page lives at <span className="break-all text-muted-foreground">{location.pathname}</span>
        </p>
        <p className="mb-6 text-sm text-muted-foreground">
          The route may have moved, or the address might be mistyped.
        </p>
        <Link
          to="/"
          className="inline-flex items-center rounded border border-border px-4 py-2 font-mono text-xs uppercase tracking-wider text-foreground transition-colors hover:bg-secondary/70"
        >
          Back to home
        </Link>
      </div>
    </AppShell>
  );
};

export default NotFound;
