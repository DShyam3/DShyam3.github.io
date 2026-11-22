import * as React from 'react';
import { toast as sonnerToast } from 'sonner';

export type ToastActionElement = React.ReactElement;

export interface ToastProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  variant?: 'default' | 'destructive';
  duration?: number;
  className?: string;
}

type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
};

type Toast = Omit<ToasterToast, 'id'>;

/**
 * Adapter that routes all `useToast()` / `toast({ title, description, variant })`
 * calls through the single site-wide Sonner `<Toaster />` instance.
 */
function toast({ title, description, variant, action, duration }: Toast) {
  const message = title ?? description ?? '';
  const body = title && description ? description : undefined;
  const options = {
    description: body,
    duration,
    ...(action ? { action } : {}),
  };

  const rawId =
    variant === 'destructive'
      ? sonnerToast.error(message, options)
      : sonnerToast(message, options);

  const id = String(rawId);

  return {
    id,
    dismiss: () => sonnerToast.dismiss(rawId),
    update: (next: ToasterToast) => {
      const nextMessage = next.title ?? next.description ?? message;
      const nextBody = next.title && next.description ? next.description : undefined;
      if (next.variant === 'destructive') {
        sonnerToast.error(nextMessage, { id: rawId, description: nextBody });
      } else {
        sonnerToast(nextMessage, { id: rawId, description: nextBody });
      }
    },
  };
}

function useToast() {
  return {
    toasts: [] as ToasterToast[],
    toast,
    dismiss: (toastId?: string) => sonnerToast.dismiss(toastId),
  };
}

export { useToast, toast };
