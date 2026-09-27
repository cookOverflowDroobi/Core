export interface DetectedTimer {
  label: string;
  seconds: number;
}

const DURATION =
  /(\d+(?:\.\d+)?)(?:\s*(?:-|–|to)\s*(\d+(?:\.\d+)?))?\s*(hours?|hrs?|minutes?|mins?|seconds?|secs?)\b/gi;

const UNIT_SECONDS: Record<string, number> = { h: 3600, m: 60, s: 1 };

/** Find cooking durations in a recipe step: "Simmer for 10-15 minutes" -> [{label: "10–15 min", seconds: 600}]. */
export function findTimers(text: string): DetectedTimer[] {
  const found: DetectedTimer[] = [];
  for (const match of text.matchAll(DURATION)) {
    const [, from, to, unitWord] = match;
    const unit = unitWord.toLowerCase()[0];
    const seconds = Math.round(parseFloat(from) * UNIT_SECONDS[unit]);
    if (!seconds || seconds > 48 * 3600) continue;
    const short = unit === "h" ? "h" : unit === "m" ? "min" : "sec";
    found.push({ label: to ? `${from}–${to} ${short}` : `${from} ${short}`, seconds });
  }
  return found;
}

/** 90 -> "1:30", 3725 -> "1:02:05" */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}
