import { useTheme } from 'next-themes';
import { Toaster as Sonner, toast } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * Single site-wide Sonner toaster styled for Sovereign Folio.
 * Both `import { toast } from 'sonner'` and `useToast()` route here.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { resolvedTheme = 'dark' } = useTheme();

  return (
    <Sonner
      theme={(resolvedTheme === 'light' ? 'light' : 'dark') as ToasterProps['theme']}
      className="toaster group font-mono"
      closeButton
      toastOptions={{
        classNames: {
          toast:
            'group toast !rounded-2xl !border !border-border/80 !bg-popover/95 !text-popover-foreground !shadow-xl backdrop-blur-md font-mono',
          title: '!text-xs !font-semibold !text-foreground',
          description: '!text-xs !text-muted-foreground',
          actionButton:
            '!rounded-full !bg-primary !px-3 !py-1 !text-xs !font-medium !text-primary-foreground',
          cancelButton:
            '!rounded-full !bg-muted !px-3 !py-1 !text-xs !text-muted-foreground',
          closeButton:
            '!border-border/70 !bg-background/90 !text-muted-foreground hover:!text-foreground',
          error: '!border-destructive/60',
          success: '!border-[hsl(var(--positive)/0.6)]',
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
