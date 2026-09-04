import { PrivacyDialog } from '@/components/shared/PrivacyDialog';
import { DotMatrixClock } from '@/components/dot-matrix/DotMatrixClock';
import { DotMatrixText } from '@/components/dot-matrix/DotMatrixText';

export function Footer() {
    return (
        <footer className="app-footer py-4 md:py-5 border-t border-border/50">
            <div className="px-4 md:px-0 flex flex-col md:flex-row items-center justify-between gap-3 md:gap-6 text-xs text-muted-foreground">
                <PrivacyDialog />
                <div className="flex flex-col md:flex-row items-center gap-4">
                    <a
                        href="https://cloud.umami.is/analytics/eu/websites"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:opacity-70 transition-opacity flex items-center"
                    >
                        <DotMatrixText text="Based in London,UK" size="xs" />
                    </a>
                    <DotMatrixClock />
                </div>
                <div className="flex items-center gap-4">
                    <DotMatrixText text="Designed by Dhyan Shyam" size="xs" />
                </div>
            </div>
        </footer>
    );
}

