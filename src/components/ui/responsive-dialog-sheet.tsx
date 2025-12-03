import * as React from "react";
import { useIsMobileBreakpoint } from "@/hooks/useBreakpoint";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

interface ResponsiveDialogSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  /** Desktop width for sheet */
  desktopWidth?: string;
  /** Mobile variant: "drawer" (bottom sheet) or "fullscreen" */
  mobileVariant?: "drawer" | "fullscreen";
  className?: string;
}

export function ResponsiveDialogSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  desktopWidth = "600px",
  mobileVariant = "drawer",
  className,
}: ResponsiveDialogSheetProps) {
  const isMobile = useIsMobileBreakpoint();

  // Mobile: Bottom Sheet (Drawer) or Fullscreen Dialog
  if (isMobile) {
    if (mobileVariant === "drawer") {
      return (
        <Drawer open={open} onOpenChange={onOpenChange}>
          <DrawerContent className={cn("max-h-[90vh]", className)}>
            {(title || description) && (
              <DrawerHeader className="text-left">
                {title && <DrawerTitle>{title}</DrawerTitle>}
                {description && (
                  <DrawerDescription>{description}</DrawerDescription>
                )}
              </DrawerHeader>
            )}
            <div className="overflow-y-auto px-4 pb-4">{children}</div>
          </DrawerContent>
        </Drawer>
      );
    }

    // Fullscreen Dialog for mobile
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={cn(
            "w-full h-full max-w-none max-h-none rounded-none sm:rounded-none",
            className
          )}
        >
          {(title || description) && (
            <DialogHeader>
              {title && <DialogTitle>{title}</DialogTitle>}
              {description && (
                <DialogDescription>{description}</DialogDescription>
              )}
            </DialogHeader>
          )}
          <div className="flex-1 overflow-y-auto">{children}</div>
        </DialogContent>
      </Dialog>
    );
  }

  // Desktop: Side Sheet
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn("overflow-y-auto", className)}
        style={{ width: desktopWidth, maxWidth: "100vw" }}
      >
        {(title || description) && (
          <SheetHeader>
            {title && <SheetTitle>{title}</SheetTitle>}
            {description && (
              <SheetDescription>{description}</SheetDescription>
            )}
          </SheetHeader>
        )}
        <div className="mt-4">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
