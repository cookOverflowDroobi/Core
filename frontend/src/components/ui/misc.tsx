import { LoaderCircle, type LucideIcon } from "lucide-react";
import { type KeyboardEvent as ReactKeyboardEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { NavLink } from "react-router";
import { cn } from "@/lib/utils";

export function Spinner({ className, label = "Loading" }: { className?: string; label?: string }) {
  return (
    <span role="status" className={cn("inline-flex items-center justify-center text-ink-3", className)}>
      <LoaderCircle className="size-5 animate-spin" aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden />;
}

export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-14 text-center", className)}>
      <div className="mb-4 grid size-16 place-items-center rounded-2xl bg-brand-soft text-brand">
        <Icon className="size-8" aria-hidden />
      </div>
      <h3 className="font-display text-xl font-semibold">{title}</h3>
      {children && <div className="mt-2 max-w-sm text-sm text-ink-2">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Chip({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "brand" | "herb" | "muted";
  className?: string;
}) {
  const tones = {
    neutral: "bg-subtle text-ink-2",
    brand: "bg-brand-soft text-brand",
    herb: "bg-herb-soft text-herb",
    muted: "border border-dashed border-line text-ink-3",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium", tones[tone], className)}>
      {children}
    </span>
  );
}

export function PageHeader({
  title,
  description,
  icon: Icon,
  actions,
}: {
  title: string;
  description?: ReactNode;
  icon?: LucideIcon;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-5 flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="flex items-center gap-2.5 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          {Icon && <Icon className="size-7 text-brand" aria-hidden />}
          {title}
        </h1>
        {description && <p className="mt-1 text-sm text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </header>
  );
}

export interface TabItem {
  to: string;
  label: string;
  icon?: LucideIcon;
  end?: boolean;
}

/** Route-driven tabs (each tab is a link, so tabs are shareable and work with back/forward). */
export function Tabs({ items, className }: { items: TabItem[]; className?: string }) {
  return (
    <nav className={cn("scrollbar-none -mx-1 flex gap-1 overflow-x-auto px-1", className)} aria-label="Sections">
      {items.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          replace
          className={({ isActive }) =>
            cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
              isActive ? "bg-ink text-canvas" : "text-ink-2 hover:bg-subtle hover:text-ink",
            )
          }
        >
          {Icon && <Icon className="size-4" aria-hidden />}
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

interface MenuItem {
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
  danger?: boolean;
}

/** Small dropdown menu with keyboard support. */
export function Menu({ trigger, items, label }: { trigger: ReactNode; items: MenuItem[]; label: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !root.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    root.current?.querySelector<HTMLButtonElement>("[role=menuitem]")?.focus();
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const onKeyDown = (event: ReactKeyboardEvent) => {
    if (!["ArrowDown", "ArrowUp"].includes(event.key)) return;
    event.preventDefault();
    const buttons = [...(root.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]") ?? [])];
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === "ArrowDown" ? index + 1 : index - 1;
    buttons[(next + buttons.length) % buttons.length]?.focus();
  };

  return (
    <div ref={root} className="relative" onKeyDown={onKeyDown}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="rounded-full p-2 text-ink-3 hover:bg-subtle hover:text-ink"
      >
        {trigger}
      </button>
      {open && (
        <div role="menu" className="card absolute right-0 z-30 mt-1 min-w-44 animate-fade-up p-1.5 shadow-pop">
          {items.map(({ label: itemLabel, icon: Icon, onSelect, danger }) => (
            <button
              key={itemLabel}
              role="menuitem"
              type="button"
              onClick={() => {
                setOpen(false);
                onSelect();
              }}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium hover:bg-subtle focus:bg-subtle focus:outline-none",
                danger ? "text-danger" : "text-ink",
              )}
            >
              {Icon && <Icon className="size-4" aria-hidden />}
              {itemLabel}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
