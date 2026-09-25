import { PrivacyDialog } from '@/components/shared/PrivacyDialog';
import { DotMatrixClock } from '@/components/dot-matrix/DotMatrixClock';
import { DotMatrixText } from '@/components/dot-matrix/DotMatrixText';
import { SITE } from '@/config/site';

export function Footer() {
    const location = <DotMatrixText text={SITE.location} size="xs" wrap={false} />;

    return (
        <footer className="app-footer py-4 md:py-5 border-t border-border/50">
            <div className="px-4 md:px-0 flex flex-wrap md:flex-nowrap items-center justify-center sm:justify-between gap-3 md:gap-4 text-xs text-muted-foreground">
                <div className="shrink-0"><PrivacyDialog /></div>
                {/* Balance the space between the edge labels, including their unequal widths. */}
                <div className="flex flex-wrap md:flex-nowrap md:flex-1 justify-center items-center gap-4">
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
