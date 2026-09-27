import { createContext, useContext } from "react";
import type { Post } from "@/lib/types";

export interface ComposerOptions {
  post?: Post;
  mode?: "post" | "recipe";
}

export const ComposerContext = createContext<{ open: (options?: ComposerOptions) => void } | null>(null);

export function useComposer() {
  const context = useContext(ComposerContext);
  if (!context) throw new Error("useComposer must be used inside <ComposerProvider>");
  return context;
}
