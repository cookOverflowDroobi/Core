import { LoaderCircle } from "lucide-react";
import { type ButtonHTMLAttributes, forwardRef } from "react";
import { Link, type LinkProps } from "react-router";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "danger" | "soft";
type Size = "sm" | "md" | "lg" | "icon" | "icon-sm";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap select-none " +
  "transition-[background-color,color,box-shadow,transform] duration-150 active:scale-[0.97] " +
  "disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2";

const variants: Record<Variant, string> = {
  primary: "bg-brand text-on-brand hover:brightness-110 shadow-sm",
  secondary: "bg-ink text-canvas hover:opacity-90",
  soft: "bg-brand-soft text-brand hover:bg-brand/15",
  outline: "border border-line bg-surface text-ink hover:bg-subtle",
  ghost: "text-ink-2 hover:bg-subtle hover:text-ink",
  danger: "bg-danger text-white hover:brightness-110",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
  icon: "h-10 w-10",
  "icon-sm": "h-8 w-8",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, className, children, disabled, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClass(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

interface ButtonLinkProps extends LinkProps {
  variant?: Variant;
  size?: Size;
}

export function ButtonLink({ variant = "primary", size = "md", className, ...props }: ButtonLinkProps) {
  return <Link className={buttonClass(variant, size, className as string)} {...props} />;
}
