import { useId } from "react";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  const gradient = useId();
  return (
    <svg viewBox="0 0 64 64" className={cn("size-9", className)} aria-hidden>
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f76b1c" />
          <stop offset="1" stopColor="#c8410e" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${gradient})`} />
      <path d="M20 30h24v12a8 8 0 0 1-8 8h-8a8 8 0 0 1-8-8z" fill="#fff" />
      <path d="M16 30h32" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
      <path
        d="M26 14c-2 3 2 5 0 8M32 12c-2 3 2 5 0 8M38 14c-2 3 2 5 0 8"
        stroke="#fff"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
        opacity=".85"
      />
    </svg>
  );
}

export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      {!compact && (
        <span className="font-display text-xl font-semibold tracking-tight">
          cook<span className="text-brand">Overflow</span>
        </span>
      )}
    </span>
  );
}
