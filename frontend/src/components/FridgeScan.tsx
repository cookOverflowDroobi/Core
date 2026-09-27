import { Camera, Check, Plus } from "lucide-react";
import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { errorMessage } from "@/lib/api";
import { useScanFridge } from "@/lib/queries";
import type { ScanItem, ScanResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

/** "Scan your fridge": photos in, a list of ingredients the user ticks before they join the search. */
export function FridgeScan({
  have,
  onAdd,
  maxImages = 3,
}: {
  have: string[];
  onAdd: (names: string[]) => void;
  maxImages?: number;
}) {
  const scan = useScanFridge();
  const input = useRef<HTMLInputElement>(null);

  const pick = (files: FileList | null) => {
    const photos = Array.from(files ?? []).slice(0, maxImages);
    if (photos.length) scan.mutate(photos);
    if (input.current) input.current.value = ""; // so picking the same photo again still fires
  };

  if (scan.data) {
    return (
      <ScanReview
        result={scan.data}
        have={have}
        onAdd={(names) => {
          onAdd(names);
          scan.reset();
        }}
        onDiscard={scan.reset}
      />
    );
  }

  return (
    <div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        hidden
        data-testid="fridge-photos"
        onChange={(e) => pick(e.target.files)}
      />
      <Button variant="outline" size="sm" className="w-full" loading={scan.isPending} onClick={() => input.current?.click()}>
        {!scan.isPending && <Camera className="size-4" aria-hidden />}
        {scan.isPending ? "Reading your photos…" : "Scan your fridge"}
      </Button>
      {scan.isError && (
        <p role="alert" className="mt-2 text-xs text-danger">
          {errorMessage(scan.error)}
        </p>
      )}
      <p className="mt-1.5 text-xs text-ink-3">
        Up to {maxImages} photos. Google's Gemini reads them; cookOverflow doesn't keep them.
      </p>
    </div>
  );
}

function describe(item: ScanItem) {
  const how = item.source === "label" ? "read from a label" : item.source === "inferred" ? "a guess" : "seen in the photo";
  return `${Math.round(item.confidence * 100)}% sure, ${how}`;
}

/** Confident finds start ticked; guesses start unticked so nothing uncertain slips into the search. */
export function ScanReview({
  result,
  have,
  onAdd,
  onDiscard,
}: {
  result: ScanResponse;
  have: string[];
  onAdd: (names: string[]) => void;
  onDiscard: () => void;
}) {
  const titleId = useId();
  const already = new Set(have.map((name) => name.trim().toLowerCase()));
  const found = result.proposed.filter((item) => !already.has(item.name));
  const [picked, setPicked] = useState(() => new Set(found.filter((item) => !item.needs_confirm).map((item) => item.name)));

  const toggle = (name: string) =>
    setPicked((previous) => {
      const next = new Set(previous);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  return (
    <div role="group" aria-labelledby={titleId} className="rounded-xl border border-line p-3">
      <p id={titleId} className="text-sm font-semibold">
        {found.length ? `Found ${found.length} ingredient${found.length === 1 ? "" : "s"}` : "Nothing new found"}
      </p>
      <p className="text-xs text-ink-3">
        {found.length
          ? "Tick what's really there. Dashed ones are guesses."
          : "Try a closer, brighter photo, or type your ingredients."}
      </p>

      {found.length > 0 && (
        <ul className="mt-2.5 flex flex-wrap gap-1.5">
          {found.map((item) => {
            const on = picked.has(item.name);
            return (
              <li key={item.name}>
                <button
                  type="button"
                  aria-pressed={on}
                  title={describe(item)}
                  onClick={() => toggle(item.name)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium",
                    on
                      ? "border-herb bg-herb-soft text-herb"
                      : "border-dashed border-line text-ink-3 hover:border-brand hover:text-brand",
                  )}
                >
                  {on ? <Check className="size-3" aria-hidden /> : <Plus className="size-3" aria-hidden />}
                  {item.name}
                  {(item.state === "leftover" || item.state === "cooked") && (
                    <span className="font-normal opacity-75">({item.state})</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {result.warnings.length > 0 && <p className="mt-2 text-xs text-ink-3">{result.warnings.join(" ")}</p>}

      <div className="mt-3 flex gap-2">
        {found.length > 0 && (
          <Button
            size="sm"
            disabled={picked.size === 0}
            onClick={() => onAdd(found.filter((item) => picked.has(item.name)).map((item) => item.name))}
          >
            Add {picked.size}
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onDiscard}>
          {found.length ? "Discard" : "Close"}
        </Button>
      </div>
    </div>
  );
}
