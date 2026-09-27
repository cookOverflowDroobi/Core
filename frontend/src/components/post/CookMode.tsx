import { ChefHat, ChevronLeft, ChevronRight, ListChecks, Pause, Play, PartyPopper, RotateCcw, Timer, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useWakeLock } from "@/hooks";
import { findTimers, formatClock } from "@/lib/timers";
import type { Post } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";

interface RunningTimer {
  id: number;
  label: string;
  step: number;
  total: number;
  remaining: number;
  running: boolean;
}

function chime() {
  try {
    const ctx = new AudioContext();
    [0, 0.25, 0.5].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.2, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.2);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.2);
    });
  } catch {
    /* audio unavailable */
  }
  navigator.vibrate?.([200, 100, 200]);
}

export function CookMode({
  post,
  checked,
  onToggle,
  onClose,
}: {
  post: Post;
  checked: Set<number>;
  onToggle: (index: number) => void;
  onClose: () => void;
}) {
  const steps = post.steps;
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [showIngredients, setShowIngredients] = useState(false);
  const [timers, setTimers] = useState<RunningTimer[]>([]);
  const nextId = useRef(1);
  useWakeLock(true);

  const go = useCallback(
    (delta: number) => {
      if (delta > 0 && step === steps.length - 1) setDone(true);
      else setStep((s) => Math.min(steps.length - 1, Math.max(0, s + delta)));
    },
    [step, steps.length],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" || event.key === " ") {
        event.preventDefault();
        go(1);
      } else if (event.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const anyRunning = timers.some((t) => t.running);
  useEffect(() => {
    if (!anyRunning) return;
    let last = Date.now();
    const id = window.setInterval(() => {
      const now = Date.now();
      const elapsed = (now - last) / 1000;
      last = now;
      setTimers((list) =>
        list.map((t) => {
          if (!t.running) return t;
          const remaining = Math.max(0, t.remaining - elapsed);
          if (remaining === 0) {
            chime();
            toast.success(`Timer done: ${t.label} (step ${t.step + 1})`, { duration: 10_000 });
            return { ...t, remaining, running: false };
          }
          return { ...t, remaining };
        }),
      );
    }, 250);
    return () => window.clearInterval(id);
  }, [anyRunning]);

  const startTimer = (label: string, seconds: number) =>
    setTimers((list) => [...list, { id: nextId.current++, label, step, total: seconds, remaining: seconds, running: true }]);

  const detected = findTimers(steps[step] ?? "");
  const progress = done ? 100 : ((step + 1) / steps.length) * 100;

  return (
    <Dialog open onClose={onClose} fullscreen label={`Cook mode: ${post.title}`}>
      <div className="flex h-dvh flex-col bg-canvas">
        <header className="flex items-center gap-3 border-b border-line px-4 py-3 sm:px-8">
          <ChefHat className="size-6 text-brand" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">Cook mode</p>
            <h2 className="truncate font-display text-lg font-semibold">{post.title}</h2>
          </div>
          <Button variant={showIngredients ? "soft" : "outline"} size="sm" onClick={() => setShowIngredients((s) => !s)} aria-pressed={showIngredients}>
            <ListChecks className="size-4" aria-hidden />
            <span className="hidden sm:inline">Ingredients</span>
            <span className="tabular-nums text-ink-3">
              {checked.size}/{post.ingredients.length}
            </span>
          </Button>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-ink-3 hover:bg-subtle hover:text-ink" aria-label="Exit cook mode">
            <X className="size-6" />
          </button>
        </header>
        <div className="h-1 bg-line" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100} aria-label="Recipe progress">
          <div className="h-full bg-brand transition-[width] duration-500" style={{ width: `${progress}%` }} />
        </div>

        <div className="relative flex min-h-0 flex-1">
          <main className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-10 text-center">
            {done ? (
              <div className="animate-fade-up">
                <PartyPopper className="mx-auto size-16 text-brand" aria-hidden />
                <p className="mt-6 font-display text-4xl font-semibold sm:text-5xl">Bon appétit!</p>
                <p className="mt-3 text-ink-2">You made {post.title}. Snap a photo and share how it turned out.</p>
                <div className="mt-8 flex justify-center gap-3">
                  <Button variant="outline" onClick={() => setDone(false)}>
                    Back to steps
                  </Button>
                  <Button onClick={onClose}>Done</Button>
                </div>
              </div>
            ) : (
              <div key={step} className="w-full max-w-3xl animate-fade-up">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand">
                  Step {step + 1} of {steps.length}
                </p>
                <p className="mt-6 font-display text-3xl font-medium leading-snug sm:text-4xl lg:text-5xl">{steps[step]}</p>
                {detected.length > 0 && (
                  <div className="mt-10 flex flex-wrap justify-center gap-3">
                    {detected.map((timer) => (
                      <Button key={timer.label} variant="soft" size="lg" onClick={() => startTimer(timer.label, timer.seconds)}>
                        <Timer className="size-5" aria-hidden /> Start {timer.label} timer
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </main>

          {showIngredients && (
            <aside className="absolute inset-y-0 right-0 w-full max-w-sm animate-fade-up overflow-y-auto border-l border-line bg-surface p-5 shadow-pop sm:static sm:shadow-none" aria-label="Ingredients">
              <h3 className="mb-3 font-semibold">Ingredients</h3>
              <ul className="space-y-1">
                {post.ingredients.map((item, i) => (
                  <li key={item}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-subtle">
                      <input type="checkbox" checked={checked.has(i)} onChange={() => onToggle(i)} className="size-5 accent-[var(--color-brand)]" />
                      <span className={cn("text-[15px]", checked.has(i) && "text-ink-3 line-through")}>{item}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </aside>
          )}
        </div>

        {timers.length > 0 && (
          <div className="flex gap-2 overflow-x-auto border-t border-line px-4 py-2.5 sm:px-8" aria-label="Timers">
            {timers.map((t) => (
              <div
                key={t.id}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5",
                  t.remaining === 0 ? "animate-pulse border-herb bg-herb-soft text-herb" : "border-line bg-surface",
                )}
              >
                <Timer className="size-4" aria-hidden />
                <span className="text-xs text-ink-3">Step {t.step + 1}</span>
                <span className="font-mono text-sm font-semibold tabular-nums" aria-live="off">
                  {t.remaining === 0 ? "Done!" : formatClock(t.remaining)}
                </span>
                {t.remaining > 0 && (
                  <button type="button" onClick={() => setTimers((l) => l.map((x) => (x.id === t.id ? { ...x, running: !x.running } : x)))} className="rounded-full p-1 hover:bg-subtle" aria-label={t.running ? "Pause timer" : "Resume timer"}>
                    {t.running ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                  </button>
                )}
                <button type="button" onClick={() => setTimers((l) => l.map((x) => (x.id === t.id ? { ...x, remaining: x.total, running: false } : x)))} className="rounded-full p-1 hover:bg-subtle" aria-label="Reset timer">
                  <RotateCcw className="size-3.5" />
                </button>
                <button type="button" onClick={() => setTimers((l) => l.filter((x) => x.id !== t.id))} className="rounded-full p-1 hover:bg-subtle" aria-label="Remove timer">
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {!done && (
          <footer className="flex items-center justify-between gap-3 border-t border-line px-4 py-4 sm:px-8">
            <Button variant="outline" size="lg" onClick={() => go(-1)} disabled={step === 0}>
              <ChevronLeft className="size-5" aria-hidden /> Back
            </Button>
            <div className="hidden gap-1.5 sm:flex" aria-hidden>
              {steps.map((_, i) => (
                <button key={i} type="button" tabIndex={-1} onClick={() => setStep(i)} className={cn("h-2 rounded-full transition-all", i === step ? "w-6 bg-brand" : "w-2 bg-line hover:bg-ink-3")} />
              ))}
            </div>
            <Button size="lg" onClick={() => go(1)} data-autofocus>
              {step === steps.length - 1 ? "Finish" : "Next"} <ChevronRight className="size-5" aria-hidden />
            </Button>
          </footer>
        )}
      </div>
    </Dialog>
  );
}
