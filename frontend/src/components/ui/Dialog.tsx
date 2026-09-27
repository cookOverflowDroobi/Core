import { X } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  /** Full-bleed content without the default padding and header. */
  bare?: boolean;
  /** Accessible name when there is no visible title. */
  label?: string;
  /** Cover the whole viewport (e.g. cook mode). */
  fullscreen?: boolean;
}

/**
 * Modal built on the native <dialog>: focus trapping, Escape to close and top-layer
 * rendering come from the browser.
 */
export function Dialog({ open, onClose, title, description, children, className, bare, label, fullscreen }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // showModal() focuses the first control; honour an explicit choice instead.
      dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => event.target === ref.current && onClose()}
      aria-labelledby={title ? "dialog-title" : undefined}
      aria-label={title ? undefined : label}
      className={cn(
        fullscreen
          ? "m-0 h-dvh max-h-none w-screen max-w-none bg-canvas p-0 text-ink"
          : "m-auto w-[min(100%-1.5rem,32rem)] max-h-[min(100dvh-2rem,56rem)] overflow-visible bg-transparent p-0 text-ink",
        "open:animate-fade-up",
        className,
      )}
    >
      {open && fullscreen && children}
      {open && !fullscreen && (
        <div className="card flex max-h-[min(100dvh-2rem,56rem)] flex-col overflow-hidden shadow-pop">
          {bare ? (
            children
          ) : (
            <>
              <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
                <div>
                  {title && (
                    <h2 id="dialog-title" className="font-display text-lg font-semibold">
                      {title}
                    </h2>
                  )}
                  {description && <p className="mt-0.5 text-sm text-ink-3">{description}</p>}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="-mr-1 rounded-full p-1.5 text-ink-3 hover:bg-subtle hover:text-ink"
                  aria-label="Close"
                >
                  <X className="size-5" />
                </button>
              </header>
              <div className="overflow-y-auto">{children}</div>
            </>
          )}
        </div>
      )}
    </dialog>
  );
}
