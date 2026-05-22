"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type SheetContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const SheetContext = React.createContext<SheetContextValue | null>(null);

function useSheet() {
  const ctx = React.useContext(SheetContext);
  if (!ctx) throw new Error("Sheet components must be used within Sheet");
  return ctx;
}

function Sheet({
  open: controlledOpen,
  onOpenChange,
  children,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;

  return (
    <SheetContext.Provider value={{ open, setOpen }}>
      {children}
    </SheetContext.Provider>
  );
}

function SheetTrigger({
  children,
}: {
  children: React.ReactElement<{ onClick?: (e: React.MouseEvent) => void }>;
}) {
  const { setOpen } = useSheet();
  const child = children;
  return React.cloneElement(child, {
    onClick: (e: React.MouseEvent) => {
      child.props.onClick?.(e);
      setOpen(true);
    },
  });
}

function SheetContent({
  side = "left",
  className,
  children,
  title,
}: {
  side?: "left" | "right";
  className?: string;
  children: React.ReactNode;
  title?: string;
}) {
  const { open, setOpen } = useSheet();

  React.useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/60"
        onClick={() => setOpen(false)}
        aria-hidden
      />
      <div
        className={cn(
          "absolute top-0 flex h-full w-72 max-w-[85vw] flex-col border bg-sidebar text-sidebar-foreground shadow-xl",
          side === "left" ? "left-0" : "right-0",
          className
        )}
      >
        <div className="flex items-center justify-between border-b border-sidebar-border p-4">
          {title ? (
            <span className="font-semibold">{title}</span>
          ) : (
            <span />
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setOpen(false)}
            aria-label="Fechar menu"
          >
            <X />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">{children}</div>
      </div>
    </div>
  );
}

export { Sheet, SheetTrigger, SheetContent, useSheet };
