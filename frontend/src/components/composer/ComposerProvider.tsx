import { type ReactNode, useMemo, useState } from "react";
import { useHotkey } from "@/hooks";
import { Composer } from "./Composer";
import { ComposerContext, type ComposerOptions } from "./context";

export function ComposerProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ComposerOptions | null>(null);
  const value = useMemo(() => ({ open: (next: ComposerOptions = {}) => setOptions(next) }), []);

  // "n" anywhere (outside text fields) starts a new post.
  useHotkey("n", () => setOptions({}), options === null);

  return (
    <ComposerContext.Provider value={value}>
      {children}
      {options && <Composer options={options} onClose={() => setOptions(null)} />}
    </ComposerContext.Provider>
  );
}
