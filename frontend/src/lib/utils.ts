import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Compact relative time: "just now", "5m", "3h", "2d", then "Sep 3" (or "Sep 3, 2024"). */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const date = new Date(iso);
  const seconds = Math.max(0, Math.round((now - date.getTime()) / 1000));
  if (seconds < 45) return "just now";
  if (seconds < HOUR) return `${Math.max(1, Math.round(seconds / MINUTE))}m`;
  if (seconds < DAY) return `${Math.round(seconds / HOUR)}h`;
  if (seconds < 7 * DAY) return `${Math.round(seconds / DAY)}d`;
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) });
}

export function fullDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** "Today", "Yesterday", "Monday" (this week) or "Sep 3, 2026". */
export function dayLabel(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((start(now) - start(date)) / (DAY * 1000));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days > 1 && days < 7) return date.toLocaleDateString(undefined, { weekday: "long" });
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0).replace(/\.0$/, "")}k`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
}

export function plural(n: number, word: string, pluralWord = `${word}s`): string {
  return `${formatCount(n)} ${n === 1 ? word : pluralWord}`;
}

export function minutesLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function titleCase(text: string): string {
  return text.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Recipes written in the old plain-text format repeat their ingredients and steps in the body.
 * When the post has structured recipe data, show only the intro paragraph.
 */
export function recipeIntro(body: string, isRecipe: boolean): string {
  if (!isRecipe) return body.trim();
  return body.split(/\n\s*(?:ingredients|steps)\s*:/i)[0].trim();
}

export function postUrl(id: number): string {
  return `/posts/${id}`;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
