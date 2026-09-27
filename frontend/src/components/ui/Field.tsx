import { type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes, forwardRef, useId } from "react";
import { cn } from "@/lib/utils";

export const inputClass =
  "w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-3 " +
  "transition-colors focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15 " +
  "disabled:opacity-60 aria-invalid:border-danger aria-invalid:ring-danger/15";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cn(inputClass, className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(inputClass, "min-h-24 resize-y leading-relaxed", className)} {...props} />;
  },
);

interface FieldProps {
  label: string;
  error?: string;
  hint?: ReactNode;
  className?: string;
  optional?: boolean;
  children: (props: { id: string; "aria-invalid"?: boolean; "aria-describedby"?: string }) => ReactNode;
}

/** Label + control + hint/error, wired up with ids for screen readers. */
export function Field({ label, error, hint, className, optional, children }: FieldProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="flex items-baseline justify-between text-sm font-medium text-ink">
        {label}
        {optional && <span className="text-xs font-normal text-ink-3">Optional</span>}
      </label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {error ? (
        <p id={`${id}-error`} className="text-xs font-medium text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
