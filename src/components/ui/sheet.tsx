import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

export function Sheet({
  modal = false,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root modal={modal} {...props} />;
}
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

export const SheetContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    side?: "left" | "right" | "bottom";
  }
>(({ className, children, side = "right", onCloseAutoFocus, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-background/80" />
    <DialogPrimitive.Content
      ref={ref}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        onCloseAutoFocus?.(event);
      }}
      className={cn(
        "fixed z-50 flex flex-col rounded-none border-border bg-surface shadow-none",
        "pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]",
        "pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)]",
        side === "right" &&
          "inset-y-0 right-0 h-full w-full max-w-none border-0 lg:w-80 lg:border-l",
        side === "left" &&
          "inset-y-0 left-0 h-full w-full max-w-none border-0 lg:w-64 lg:border-r",
        side === "bottom" && "inset-x-0 bottom-0 h-full w-full border-t",
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute top-[max(0.75rem,env(safe-area-inset-top,0px))] right-[max(0.75rem,env(safe-area-inset-right,0px))] flex size-11 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground">
        <X className="size-4" />
        <span className="sr-only">Zavrieť</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
SheetContent.displayName = "SheetContent";

export function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("border-b border-border px-4 py-3", className)} {...props} />;
}
export function SheetTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn("text-sm font-medium tracking-wide", className)} {...props} />;
}
