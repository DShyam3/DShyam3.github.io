import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { DotMatrixIcon } from './DotMatrixIcon';
import { markManualOverride } from '@/hooks/useTimeBasedTheme';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const handleToggle = () => {
    markManualOverride();
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <Button variant="ghost" size="icon" onClick={handleToggle} className="w-9 h-9 relative">
      <div className="rotate-0 scale-100 opacity-100 blur-0 transition-[transform,opacity,filter] duration-300 [transition-timing-function:cubic-bezier(0.2,0,0,1)] dark:-rotate-90 dark:scale-[0.25] dark:opacity-0 dark:blur-[4px]">
        <DotMatrixIcon icon="sun" />
      </div>
      <div className="absolute rotate-90 scale-[0.25] opacity-0 blur-[4px] transition-[transform,opacity,filter] duration-300 [transition-timing-function:cubic-bezier(0.2,0,0,1)] dark:rotate-0 dark:scale-100 dark:opacity-100 dark:blur-0">
        <DotMatrixIcon icon="moon" />
      </div>
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
