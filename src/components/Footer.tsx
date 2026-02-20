import { PrivacyDialog } from './PrivacyDialog';
import { DotMatrixClock } from './DotMatrixClock';
import { DotMatrixText } from './DotMatrixText';

export function Footer() {
    return (
        <footer className="py-8 border-t border-border/50 mt-4">
            <div className="px-4 md:px-0 flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-muted-foreground">
                <PrivacyDialog />
                <div className="flex flex-col md:flex-row items-center gap-4">
                    <a
                        href="https://cloud.umami.is/analytics/eu/websites"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:opacity-70 transition-opacity flex items-center"
                    >
                        <DotMatrixText text="Based in London,UK" />
                    </a>
                    <DotMatrixClock />
                </div>
                <div className="flex items-center">
                    <DotMatrixText text="Designed by Dhyan Shyam" />
                </div>
            </div>
        </footer>
    );
}
