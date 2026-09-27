import { Plus, X } from "lucide-react";
import { type ClipboardEvent, type KeyboardEvent, useId, useState } from "react";
import { cn } from "@/lib/utils";

interface ChipInputProps {
  values: string[];
  onChange: (values: string[]) => void;
  suggestions?: string[];
  onQueryChange?: (query: string) => void;
  placeholder?: string;
  max?: number;
  id?: string;
  prefix?: string;
  className?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
}

const split = (text: string) => text.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);

/** Type and press Enter/comma to add chips; suggestions work like a combobox. */
export function ChipInput({
  values,
  onChange,
  suggestions = [],
  onQueryChange,
  placeholder,
  max = 50,
  id,
  prefix,
  className,
  ...aria
}: ChipInputProps) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);
  const [focused, setFocused] = useState(false);

  const lower = new Set(values.map((v) => v.toLowerCase()));
  const options = suggestions.filter((s) => !lower.has(s.toLowerCase())).slice(0, 8);
  const showOptions = focused && query.trim().length > 0 && options.length > 0;

  const setText = (text: string) => {
    setQuery(text);
    setActive(-1);
    onQueryChange?.(text);
  };

  const add = (items: string[]) => {
    const next = [...values];
    for (const item of items) {
      const clean = item.replace(/^#/, "").trim();
      if (clean && next.length < max && !next.some((v) => v.toLowerCase() === clean.toLowerCase())) next.push(clean);
    }
    if (next.length !== values.length) onChange(next);
    setText("");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" && showOptions) {
      event.preventDefault();
      setActive((i) => (i + 1) % options.length);
    } else if (event.key === "ArrowUp" && showOptions) {
      event.preventDefault();
      setActive((i) => (i <= 0 ? options.length - 1 : i - 1));
    } else if (event.key === "Enter" || event.key === "," || (event.key === "Tab" && query.trim())) {
      if (!query.trim() && event.key !== ",") return;
      event.preventDefault();
      add([showOptions && active >= 0 ? options[active] : query]);
    } else if (event.key === "Backspace" && !query && values.length) {
      onChange(values.slice(0, -1));
    } else if (event.key === "Escape") {
      setText("");
    }
  };

  const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData("text");
    if (/[,\n]/.test(text)) {
      event.preventDefault();
      add(split(text));
    }
  };

  return (
    <div className={cn("relative", className)}>
      <div
        className={cn(
          "flex min-h-11 flex-wrap items-center gap-1.5 rounded-xl border border-line bg-surface px-2 py-1.5 transition-colors",
          focused && "border-brand ring-4 ring-brand/15",
        )}
      >
        {values.map((value) => (
          <span
            key={value}
            className="inline-flex animate-fade-up items-center gap-1 rounded-full bg-brand-soft py-1 pl-3 pr-1 text-sm font-medium text-brand"
          >
            {prefix}
            {value}
            <button
              type="button"
              onClick={() => onChange(values.filter((v) => v !== value))}
              className="rounded-full p-0.5 hover:bg-brand/15"
              aria-label={`Remove ${value}`}
            >
              <X className="size-3.5" />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={query}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            if (query.trim()) add([query]);
          }}
          placeholder={values.length ? "" : placeholder}
          className="min-w-32 flex-1 bg-transparent px-1.5 py-1 text-sm text-ink placeholder:text-ink-3 focus:outline-none"
          role="combobox"
          aria-expanded={showOptions}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          {...aria}
        />
      </div>
      {showOptions && (
        <ul id={listId} role="listbox" className="card absolute inset-x-0 top-full z-20 mt-1 animate-fade-up p-1.5 shadow-pop">
          {options.map((option, i) => (
            <li
              key={option}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                add([option]);
              }}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm",
                i === active ? "bg-subtle text-ink" : "text-ink-2 hover:bg-subtle",
              )}
            >
              <Plus className="size-3.5 text-ink-3" aria-hidden />
              {option}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
