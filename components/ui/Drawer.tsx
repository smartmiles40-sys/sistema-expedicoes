"use client";
import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Drawer = Dialog.Root;
export const DrawerTrigger = Dialog.Trigger;
export const DrawerClose = Dialog.Close;
export const DrawerPortal = Dialog.Portal;

export const DrawerOverlay = React.forwardRef<
  React.ElementRef<typeof Dialog.Overlay>,
  React.ComponentPropsWithoutRef<typeof Dialog.Overlay>
>(({ className, ...props }, ref) => (
  <Dialog.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
      className,
    )}
    {...props}
  />
));
DrawerOverlay.displayName = "DrawerOverlay";

export interface DrawerContentProps extends React.ComponentPropsWithoutRef<typeof Dialog.Content> {
  side?: "right" | "left";
  width?: string;
}

export const DrawerContent = React.forwardRef<
  React.ElementRef<typeof Dialog.Content>,
  DrawerContentProps
>(({ className, children, side = "right", width = "w-[480px]", ...props }, ref) => {
  // No mobile o drawer ocupa a tela inteira; a largura fixa só vale a partir do sm.
  const widthSm = width
    .split(/\s+/)
    .filter(Boolean)
    .map((c) => (c.startsWith("sm:") ? c : `sm:${c}`))
    .join(" ");
  return (
  <DrawerPortal>
    <DrawerOverlay />
    <Dialog.Content
      ref={ref}
      className={cn(
        "fixed top-0 z-50 h-full bg-background border-border shadow-lg outline-none flex flex-col",
        side === "right" ? "right-0 border-l" : "left-0 border-r",
        "w-full max-w-full",
        widthSm,
        "animate-slide-in-right",
        className,
      )}
      {...props}
    >
      {children}
      <Dialog.Close
        aria-label="Fechar"
        className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="h-5 w-5" />
        <span className="sr-only">Fechar</span>
      </Dialog.Close>
    </Dialog.Content>
  </DrawerPortal>
  );
});
DrawerContent.displayName = "DrawerContent";

export function DrawerHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  // pr-14 reserva espaço pro botão X (canto superior direito) — sem sobreposição.
  return <div className={cn("p-4 pr-14 border-b border-border", className)} {...props} />;
}

export const DrawerTitle = React.forwardRef<
  React.ElementRef<typeof Dialog.Title>,
  React.ComponentPropsWithoutRef<typeof Dialog.Title>
>(({ className, ...props }, ref) => (
  <Dialog.Title ref={ref} className={cn("text-base font-semibold", className)} {...props} />
));
DrawerTitle.displayName = "DrawerTitle";

export const DrawerDescription = React.forwardRef<
  React.ElementRef<typeof Dialog.Description>,
  React.ComponentPropsWithoutRef<typeof Dialog.Description>
>(({ className, ...props }, ref) => (
  <Dialog.Description ref={ref} className={cn("text-xs text-muted-foreground mt-1", className)} {...props} />
));
DrawerDescription.displayName = "DrawerDescription";

export function DrawerBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex-1 overflow-y-auto p-4 space-y-3", className)} {...props} />;
}

export function DrawerFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("p-4 border-t border-border flex items-center justify-end gap-2", className)}
      {...props}
    />
  );
}
