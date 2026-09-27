import { CookingPot, ListChecks, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { Logo } from "@/components/Logo";
import { useDocumentTitle } from "@/hooks";
import { useStats } from "@/lib/queries";
import { formatCount } from "@/lib/utils";

const FEATURES = [
  { icon: CookingPot, title: "What can I cook?", body: "Type what's in your fridge and get recipes ranked by what you already have." },
  { icon: ListChecks, title: "Cook mode", body: "Step-by-step view with built-in timers that keeps your screen awake." },
  { icon: Sparkles, title: "Made for you", body: "A feed that learns the cuisines and ingredients you love." },
];

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children: ReactNode }) {
  useDocumentTitle(title);
  const { data: stats } = useStats();

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-[#1f140d] p-12 text-white lg:flex lg:flex-col">
        <div
          aria-hidden
          className="absolute -right-32 -top-32 size-[32rem] rounded-full bg-[radial-gradient(circle,#f26b1d_0%,transparent_65%)] opacity-60"
        />
        <div
          aria-hidden
          className="absolute -bottom-40 -left-24 size-[28rem] rounded-full bg-[radial-gradient(circle,#c8410e_0%,transparent_65%)] opacity-50"
        />
        <Link to="/" className="relative">
          <Logo className="[&_span]:text-white" />
        </Link>
        <div className="relative mt-auto max-w-lg">
          <h2 className="font-display text-5xl font-semibold leading-[1.05] tracking-tight">
            Cook what you have.
            <br />
            <span className="text-[#ffb27a]">Share what you love.</span>
          </h2>
          <ul className="mt-10 space-y-5">
            {FEATURES.map(({ icon: Icon, title: featureTitle, body }) => (
              <li key={featureTitle} className="flex gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/10 ring-1 ring-white/15">
                  <Icon className="size-5 text-[#ffb27a]" aria-hidden />
                </span>
                <span>
                  <span className="block font-semibold">{featureTitle}</span>
                  <span className="block text-sm text-white/70">{body}</span>
                </span>
              </li>
            ))}
          </ul>
          {stats && (
            <dl className="mt-12 grid grid-cols-3 gap-6 border-t border-white/15 pt-8">
              {[
                ["Home cooks", stats.cooks],
                ["Recipes", stats.recipes],
                ["Cuisines", stats.cuisines],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs uppercase tracking-wider text-white/60">{label}</dt>
                  <dd className="mt-1 font-display text-3xl font-semibold">{formatCount(Number(value))}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </aside>

      <main className="flex flex-col px-5 py-8 sm:px-10">
        <Link to="/" className="mb-10 lg:hidden">
          <Logo />
        </Link>
        <div className="mx-auto my-auto w-full max-w-sm animate-fade-up">
          <h1 className="font-display text-3xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-ink-2">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  );
}

export function passwordStrength(password: string): { score: 0 | 1 | 2 | 3 | 4; label: string } {
  if (!password) return { score: 0, label: "" };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score++;
  if (password.length < 8) score = Math.min(score, 1);
  const labels = ["Too short", "Weak", "Okay", "Good", "Strong"];
  return { score: score as 0 | 1 | 2 | 3 | 4, label: labels[score] };
}

export function StrengthMeter({ password }: { password: string }) {
  const { score, label } = passwordStrength(password);
  if (!password) return null;
  const colours = ["bg-danger", "bg-danger", "bg-gold", "bg-herb", "bg-herb"];
  return (
    <div className="flex items-center gap-2" aria-live="polite">
      <div className="flex flex-1 gap-1">
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={`h-1 flex-1 rounded-full ${i <= score ? colours[score] : "bg-line"}`} />
        ))}
      </div>
      <span className="w-16 text-right text-xs text-ink-3">{label}</span>
    </div>
  );
}
