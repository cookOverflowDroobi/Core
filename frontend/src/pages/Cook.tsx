import { useQuery } from "@tanstack/react-query";
import { Check, CookingPot, Plus, SearchX, ShoppingBasket } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { ChipInput } from "@/components/ChipInput";
import { FridgeScan } from "@/components/FridgeScan";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { useDebounce, useDocumentTitle } from "@/hooks";
import { api, errorMessage } from "@/lib/api";
import { useCook, useScanStatus } from "@/lib/queries";
import { addToShoppingList } from "@/lib/shopping";
import type { CookResult } from "@/lib/types";
import { cn, minutesLabel, titleCase } from "@/lib/utils";

const splitList = (text: string) => text.split(",").map((s) => s.trim()).filter(Boolean);

const STARTERS = [
  ["rice", "chicken", "onion"],
  ["eggs", "tomato", "garlic"],
  ["pasta", "cheese", "garlic"],
  ["lentils", "onion", "cumin"],
];

export default function Cook() {
  useDocumentTitle("What can I cook?");
  const [params, setParams] = useSearchParams();
  const raw = params.get("i") ?? "";
  const ingredients = useMemo(() => splitList(raw), [raw]);
  const staples = params.get("staples") !== "0";
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 200);
  const debouncedRaw = useDebounce(raw, 250);
  const debouncedIngredients = useMemo(() => splitList(debouncedRaw), [debouncedRaw]);

  const cook = useCook(debouncedIngredients, staples);
  const scanStatus = useScanStatus();
  const popular = useQuery({
    queryKey: ["ingredients", ""],
    queryFn: () => api<{ name: string }[]>("/ingredients/", { query: { limit: 16 } }),
    staleTime: 10 * 60_000,
  });
  const suggestions = useQuery({
    queryKey: ["ingredients", debouncedQuery],
    queryFn: () => api<{ name: string }[]>("/ingredients/", { query: { q: debouncedQuery, limit: 8 } }),
    enabled: debouncedQuery.trim().length > 0,
    staleTime: 60_000,
  });

  const update = (next: string[], nextStaples = staples) => {
    const search = new URLSearchParams();
    if (next.length) search.set("i", next.join(","));
    if (!nextStaples) search.set("staples", "0");
    setParams(search, { replace: true });
  };

  const have = new Set(ingredients.map((i) => i.toLowerCase()));
  const addAll = (names: string[]) => update([...ingredients, ...names.filter((name) => !have.has(name))].slice(0, 30));
  const quickAdd = (popular.data ?? []).map((p) => p.name).filter((name) => !have.has(name)).slice(0, 12);
  const results = cook.data?.results ?? [];
  const perfect = results.filter((r) => r.missing.length === 0).length;

  return (
    <div className="lg:grid lg:grid-cols-[22rem_1fr] lg:items-start lg:gap-8">
      <section className="lg:sticky lg:top-6" aria-labelledby="cook-title">
        <div className="relative overflow-hidden rounded-3xl bg-[#1f140d] p-6 text-white">
          <div aria-hidden className="absolute -right-16 -top-20 size-64 rounded-full bg-[radial-gradient(circle,#f26b1d_0%,transparent_65%)] opacity-70" />
          <CookingPot className="relative size-9 text-[#ffb27a]" aria-hidden />
          <h1 id="cook-title" className="relative mt-3 font-display text-3xl font-semibold leading-tight">
            What can I cook?
          </h1>
          <p className="relative mt-2 text-sm text-white/75">
            Add what's in your fridge. We'll rank every recipe by how much of it you can already make.
          </p>
        </div>

        <div className="card mt-4 space-y-4 p-4">
          <div>
            <label htmlFor="cook-ingredients" className="mb-1.5 block text-sm font-semibold">
              Your ingredients
            </label>
            <ChipInput
              id="cook-ingredients"
              values={ingredients}
              onChange={(next) => update(next)}
              suggestions={suggestions.data?.map((s) => s.name) ?? []}
              onQueryChange={setQuery}
              placeholder="Type an ingredient, press Enter"
              max={30}
            />
          </div>

          {scanStatus.data?.enabled && (
            <FridgeScan have={ingredients} onAdd={addAll} maxImages={scanStatus.data.max_images} />
          )}

          {quickAdd.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-3">Popular</p>
              <div className="flex flex-wrap gap-1.5">
                {quickAdd.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => update([...ingredients, name])}
                    className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-xs font-medium text-ink-2 hover:border-brand hover:text-brand"
                  >
                    <Plus className="size-3" aria-hidden />
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-subtle p-3">
            <input
              type="checkbox"
              checked={staples}
              onChange={(e) => update(ingredients, e.target.checked)}
              className="mt-0.5 size-4 accent-[var(--color-brand)]"
            />
            <span className="text-sm">
              <span className="font-semibold">I have the basics</span>
              <span className="block text-xs text-ink-3">Salt, oil, olive oil, sugar, water and black pepper.</span>
            </span>
          </label>

          {ingredients.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => update([])}>
              Clear all
            </Button>
          )}
        </div>
      </section>

      <section className="mt-6 lg:mt-0" aria-live="polite" aria-busy={cook.isFetching}>
        {!ingredients.length ? (
          <div className="card">
            <EmptyState icon={CookingPot} title="Start with what you have" className="py-16">
              <p>Try one of these to see how it works:</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {STARTERS.map((set) => (
                  <Button key={set.join()} variant="outline" size="sm" onClick={() => update(set)}>
                    {set.join(" + ")}
                  </Button>
                ))}
              </div>
            </EmptyState>
          </div>
        ) : cook.isPending ? (
          <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-80 rounded-2xl" />
            ))}
          </div>
        ) : cook.isError ? (
          <div className="card">
            <EmptyState icon={SearchX} title="Couldn't match recipes">{errorMessage(cook.error)}</EmptyState>
          </div>
        ) : results.length === 0 ? (
          <div className="card">
            <EmptyState icon={SearchX} title="No recipes use those yet">
              Try adding a few more common ingredients, or turn on “I have the basics”.
            </EmptyState>
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm text-ink-2">
              <strong className="text-ink">{cook.data!.count}</strong> recipes use your ingredients
              {perfect > 0 && (
                <>
                  {" · "}
                  <strong className="text-herb">{perfect} you can make right now</strong>
                </>
              )}
            </p>
            <ul className={cn("grid gap-4 sm:grid-cols-2 2xl:grid-cols-3", cook.isFetching && "opacity-70 transition-opacity")}>
              {results.map((result) => (
                <li key={result.post.id}>
                  <MatchCard result={result} />
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}

function MatchRing({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const tone = pct === 100 ? "text-herb" : pct >= 60 ? "text-brand" : "text-gold";
  return (
    <div className="relative grid size-14 place-items-center rounded-full bg-surface/95 shadow-card backdrop-blur" title={`${pct}% match`}>
      <svg viewBox="0 0 48 48" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="24" cy="24" r={radius} fill="none" stroke="var(--color-line)" strokeWidth="4" />
        <circle
          cx="24"
          cy="24"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - score)}
          className={cn(tone, "transition-[stroke-dashoffset] duration-700")}
        />
      </svg>
      <span className={cn("relative text-xs font-bold", tone)}>{pct}%</span>
    </div>
  );
}

function MatchCard({ result }: { result: CookResult }) {
  const { post, matched, missing, score } = result;
  const navigate = useNavigate();
  const image = post.images[0]?.url;

  const addMissing = () => {
    const added = addToShoppingList(missing, { id: post.id, title: post.title });
    toast.success(added ? `Added ${added} item${added === 1 ? "" : "s"} to your shopping list` : "Already on your list", {
      action: { label: "View list", onClick: () => navigate("/shopping") },
    });
  };

  return (
    <article className="card flex h-full animate-fade-up flex-col overflow-hidden">
      <Link to={`/posts/${post.id}`} className="group relative block aspect-[16/10] overflow-hidden bg-subtle">
        {image ? (
          <img src={image} alt="" loading="lazy" className="size-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="grid size-full place-items-center bg-linear-to-br from-brand-soft to-subtle">
            <CookingPot className="size-10 text-brand" aria-hidden />
          </div>
        )}
        <div className="absolute right-3 top-3">
          <MatchRing score={score} />
        </div>
        {missing.length === 0 && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-herb px-2.5 py-1 text-xs font-bold text-white">
            <Check className="size-3.5" aria-hidden /> Ready to cook
          </span>
        )}
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <h2 className="font-display text-lg font-semibold leading-snug">
          <Link to={`/posts/${post.id}`} className="hover:text-brand">
            {post.title || "Untitled recipe"}
          </Link>
        </h2>
        <div className="mt-1 flex items-center gap-2 text-xs text-ink-3">
          <Avatar user={post.author} size="xs" />
          <span className="truncate">{post.author.full_name}</span>
          {post.cook_time && <span>· {minutesLabel(post.cook_time)}</span>}
          {post.cuisine && <span>· {titleCase(post.cuisine)}</span>}
        </div>
        <p className="mt-3 text-xs font-semibold text-ink-2">
          You have {matched.length} of {post.ingredients.length}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {matched.map((item) => (
            <span key={item} className="rounded-full bg-herb-soft px-2 py-0.5 text-xs font-medium text-herb">
              {item}
            </span>
          ))}
          {missing.map((item) => (
            <span key={item} className="rounded-full border border-dashed border-line px-2 py-0.5 text-xs text-ink-3">
              {item}
            </span>
          ))}
        </div>
        {missing.length > 0 && (
          <div className="mt-auto pt-4">
            <Button variant="soft" size="sm" onClick={addMissing}>
              <ShoppingBasket className="size-4" aria-hidden />
              Add {missing.length} missing to list
            </Button>
          </div>
        )}
      </div>
    </article>
  );
}
