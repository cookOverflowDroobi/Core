import { type RefObject, useEffect, useRef, useState } from "react";

export function useDocumentTitle(title: string | undefined) {
  useEffect(() => {
    document.title = title ? `${title} · cookOverflow` : "cookOverflow";
  }, [title]);
}

export function useDebounce<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

/** Calls `onVisible` whenever the element scrolls into view (used for infinite scroll). */
export function useOnVisible<T extends Element>(onVisible: () => void, enabled = true): RefObject<T | null> {
  const ref = useRef<T>(null);
  const callback = useRef(onVisible);
  callback.current = onVisible;

  useEffect(() => {
    const node = ref.current;
    if (!node || !enabled) return;
    const observer = new IntersectionObserver(
      (entries) => entries.some((e) => e.isIntersecting) && callback.current(),
      { rootMargin: "600px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled]);

  return ref;
}

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
}

/**
 * Global keyboard shortcut. `combo` is a key like "n" or "mod+k" (mod = Ctrl/Cmd).
 * Plain keys are ignored while the user is typing in a field.
 */
export function useHotkey(combo: string, handler: (event: KeyboardEvent) => void, enabled = true) {
  const callback = useRef(handler);
  callback.current = handler;

  useEffect(() => {
    if (!enabled) return;
    const parts = combo.toLowerCase().split("+");
    const key = parts[parts.length - 1];
    const needsMod = parts.includes("mod");
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== key) return;
      const mod = event.ctrlKey || event.metaKey;
      if (needsMod !== mod || event.altKey) return;
      if (!needsMod && isTyping(event.target)) return;
      event.preventDefault();
      callback.current(event);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [combo, enabled]);
}

/** Keep the screen awake while cooking (where the Wake Lock API is available). */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const request = async () => {
      try {
        const sentinel = await navigator.wakeLock.request("screen");
        if (cancelled) await sentinel.release();
        else lock = sentinel;
      } catch {
        /* denied (e.g. battery saver) or unsupported: cooking still works */
      }
    };
    request();
    const onVisible = () => document.visibilityState === "visible" && request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release().catch(() => undefined);
    };
  }, [active]);
}
