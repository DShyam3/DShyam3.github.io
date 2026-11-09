import { PrivacyDialog } from '@/components/shared/PrivacyDialog';
import { DotMatrixClock } from '@/components/dot-matrix/DotMatrixClock';
import { DotMatrixText } from '@/components/dot-matrix/DotMatrixText';
import { SITE } from '@/config/site';

export function Footer() {
    const location = <DotMatrixText text={SITE.location} size="xs" wrap={false} />;

    return (
        <footer className="app-footer py-4 md:py-5 border-t border-border/50">
            <div className="flex flex-nowrap items-center justify-between gap-3 md:gap-4 text-xs text-muted-foreground">
                <div className="shrink-0"><PrivacyDialog /></div>
                {/* One row at every width. On a phone the place and clock sit at
                    the right edge; from md they centre between the edge labels. */}
                <div className="flex flex-nowrap items-center justify-end gap-3 md:flex-1 md:justify-center md:gap-4">
                    {SITE.analytics.umamiDashboardUrl ? (
                        <a
                            href={SITE.analytics.umamiDashboardUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:opacity-70 transition-opacity flex items-center"
                        >
                            {location}
                        </a>
                    ) : (
                        location
                    )}
                    <DotMatrixClock />
                </div>
                <div className="hidden md:flex shrink-0 flex-col lg:flex-row items-end lg:items-center gap-x-3.5 text-right">
                    <DotMatrixText text="Designed by" size="xs" wrap={false} />
                    <DotMatrixText text={SITE.name} size="xs" wrap={false} />
                </div>
            </div>
        </footer>
    );
}
