import { CookingPot, Hash, Search, TrendingUp, Users } from "lucide-react";
import { Link } from "react-router";
import { useSuggestions, useTags } from "@/lib/queries";
import { UserRow } from "../user/UserRow";
import { Skeleton } from "../ui/misc";

export function RightRail({ onSearch }: { onSearch: () => void }) {
  const suggestions = useSuggestions(4);
  const tags = useTags(12);

  return (
    <aside className="sticky top-0 hidden h-dvh w-80 shrink-0 space-y-4 overflow-y-auto py-6 pr-6 xl:block" aria-label="Discover">
      <button
        type="button"
        onClick={onSearch}
        className="flex w-full items-center gap-3 rounded-full border border-line bg-surface px-4 py-2.5 text-sm text-ink-3 hover:border-ink-3"
      >
        <Search className="size-4" aria-hidden />
        Search recipes, cooks, tags
      </button>

      <Link
        to="/cook"
        className="block overflow-hidden rounded-2xl bg-linear-to-br from-[#f26b1d] to-[#b83a0b] p-5 text-white shadow-card transition hover:brightness-105"
      >
        <CookingPot className="mb-3 size-8" aria-hidden />
        <p className="font-display text-xl font-semibold leading-tight">What can I cook tonight?</p>
        <p className="mt-1 text-sm text-white/85">Tell us what's in your fridge and we'll match recipes.</p>
      </Link>

      <section className="card p-4" aria-labelledby="rail-follow">
        <h2 id="rail-follow" className="mb-3 flex items-center gap-2 font-semibold">
          <Users className="size-4 text-brand" aria-hidden /> Who to follow
        </h2>
        {suggestions.isPending ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : suggestions.data?.length ? (
          <ul className="space-y-3">
            {suggestions.data.map((user) => (
              <li key={user.id}>
                <UserRow user={user} compact />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-3">You follow everyone. Impressive.</p>
        )}
      </section>

      <section className="card p-4" aria-labelledby="rail-tags">
        <h2 id="rail-tags" className="mb-3 flex items-center gap-2 font-semibold">
          <TrendingUp className="size-4 text-brand" aria-hidden /> Popular tags
        </h2>
        <div className="flex flex-wrap gap-1.5">
          {tags.data?.map((tag) => (
            <Link
              key={tag.name}
              to={`/tags/${tag.name}`}
              className="inline-flex items-center gap-1 rounded-full bg-subtle px-3 py-1.5 text-sm font-medium text-ink-2 hover:bg-brand-soft hover:text-brand"
            >
              <Hash className="size-3.5" aria-hidden />
              {tag.name}
              <span className="text-xs text-ink-3">{tag.count}</span>
            </Link>
          ))}
        </div>
      </section>

      <footer className="flex flex-wrap gap-x-3 gap-y-1 px-2 text-xs text-ink-3">
        <a href="/api/docs/" className="hover:underline">API docs</a>
        <a href="/legacy/" className="hover:underline">Classic site</a>
        <span>Press <kbd className="font-semibold">N</kbd> to post · <kbd className="font-semibold">Ctrl K</kbd> to search</span>
        <span>© {new Date().getFullYear()} cookOverflow</span>
      </footer>
    </aside>
  );
}
