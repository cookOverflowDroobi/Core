import { createStore } from "./store";

export type ThemePreference = "system" | "light" | "dark";

export const themeStore = createStore<ThemePreference>("theme-preference", "system");

const media = () => window.matchMedia("(prefers-color-scheme: dark)");

export function resolvedTheme(pref: ThemePreference = themeStore.get()): "light" | "dark" {
  return pref === "system" ? (media().matches ? "dark" : "light") : pref;
}

function apply() {
  const pref = themeStore.get();
  document.documentElement.classList.toggle("dark", resolvedTheme(pref) === "dark");
  // index.html reads this key before first paint.
  localStorage.setItem("theme", pref);
}

export function setTheme(pref: ThemePreference) {
  themeStore.set(pref);
  apply();
}

export function initTheme() {
  apply();
  media().addEventListener("change", apply);
}
