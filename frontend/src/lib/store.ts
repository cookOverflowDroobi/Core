import { useSyncExternalStore } from "react";

/** A small localStorage-backed store that stays in sync across components and tabs. */
export function createStore<T>(key: string, initial: T) {
  let state: T = read();
  const listeners = new Set<() => void>();

  function read(): T {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  }

  function set(next: T | ((prev: T) => T)) {
    state = typeof next === "function" ? (next as (prev: T) => T)(state) : next;
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      /* storage full or unavailable: keep the in-memory state */
    }
    listeners.forEach((listener) => listener());
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    const onStorage = (event: StorageEvent) => {
      if (event.key === key) {
        state = read();
        listener();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  }

  return {
    get: () => state,
    set,
    subscribe,
    use: () => useSyncExternalStore(subscribe, () => state, () => initial),
  };
}
