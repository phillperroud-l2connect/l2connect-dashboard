"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type DialogContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const DialogContext = React.createContext<DialogContextValue | null>(null);

function useDialog() {
  const ctx = React.useContext(DialogContext);
  if (!ctx) throw new Error("Dialog components must be used within Dialog");
  return ctx;
}

function Dialog({
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
    <DialogContext.Provider value={{ open, setOpen }}>
      {children}
    </DialogContext.Provider>
  );
}

function DialogTrigger({
  children,
  asChild,
}: {
  children: React.ReactElement<{ onClick?: (e: React.MouseEvent) => void }>;
  asChild?: boolean;
}) {
  const { setOpen } = useDialog();
  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement<{
      onClick?: (e: React.MouseEvent) => void;
    }>;
    return React.cloneElement(child, {
      onClick: (e: React.MouseEvent) => {
        child.props.onClick?.(e);
        setOpen(true);
      },
    });
  }
  return (
    <button type="button" onClick={() => setOpen(true)}>
      {children}
    </button>
  );
}

function DialogContent({
  className,
  children,
  title,
}: {
  className?: string;
  children: React.ReactNode;
  title?: string;
}) {
  const { open, setOpen } = useDialog();

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60"
        onClick={() => setOpen(false)}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal
        aria-labelledby={title ? "dialog-title" : undefined}
        className={cn(
          "relative z-10 w-full max-w-lg rounded-xl border bg-card p-6 shadow-lg",
          className
        )}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          {title ? (
            <h2 id="dialog-title" className="text-lg font-semibold">
              {title}
            </h2>
          ) : (
            <span />
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setOpen(false)}
            aria-label="Fechar"
          >
            <X />
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}

export { Dialog, DialogTrigger, DialogContent, useDialog };
