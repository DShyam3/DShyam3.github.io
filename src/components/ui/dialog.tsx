import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { dismissOnRelease, ignoreOverlayPointerDown } from "./dismiss-on-release";

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

/**
 * The backdrop, and the thing you tap to dismiss. See `dismissOnRelease` for
 * why it closes on release rather than press.
 */
const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, onTouchEnd, ...props }, ref) => (
  <DialogPrimitive.Close asChild>
    <DialogPrimitive.Overlay
      ref={ref}
      className={cn(
        "dialog-overlay fixed inset-0 z-50 bg-black/45 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className,
      )}
      {...dismissOnRelease(onTouchEnd)}
      {...props}
    />
  </DialogPrimitive.Close>
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, onPointerDownOutside, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    {/* The width is capped by the viewport as well as by whatever max-w the
        caller asks for. A dialog that asks for lg:max-w-5xl gets exactly
        1024px, which is exactly an iPad in portrait, so it sat edge to edge
        with no page visible either side. Phones keep a gutter too (see
        `.glass-dialog` in src/theme/responsive.css), so the corners stay
        rounded at every width, at the phone radius `.surface-card` uses. */}
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "glass-dialog focus:outline-none max-h-[calc(100dvh-2rem)] overflow-hidden fixed left-[50%] top-[50%] z-50 grid w-full sm:w-[calc(100%-3rem)] max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] rounded-[1.25rem] sm:rounded-3xl",
        className,
      )}
      onPointerDownOutside={ignoreOverlayPointerDown(onPointerDownOutside)}
      {...props}
    >
      {/* minmax(0, 1fr), not the implicit auto column: an auto column grows to
          fit its widest child, and on a phone the EDC builder's widened to
          861px inside a 343px dialog, running its header under the close
          button and off the edge. */}
      <div className="dialog-body min-h-0 overflow-y-auto grid grid-cols-[minmax(0,1fr)] gap-4">{children}</div>
      {/* 2.75rem square, 0.5rem in from the corner, so text keeps 3.75rem
          clear of the right edge until it is below the button. DialogHeader's
          pr-10 does that inside the default p-6. A header that sets its own
          padding (the p-0 dialogs) replaces pr-10, and needs pr-16 instead. */}
      <DialogPrimitive.Close className="absolute right-2 top-2 h-11 w-11 flex items-center justify-center rounded-full bg-background/90 p-1.5 opacity-75 ring-offset-background transition-[opacity,background-color] hover:opacity-100 hover:bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none shadow-sm">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 pr-10 text-center sm:text-left", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
