import { Bookmark, Hash, Search as SearchIcon, SearchX } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { PostCard } from "@/components/post/PostCard";
import { PostFeed } from "@/components/post/PostFeed";
import { UserRow } from "@/components/user/UserRow";
import { Input } from "@/components/ui/Field";
import { EmptyState, PageHeader, Skeleton } from "@/components/ui/misc";
import { useDebounce, useDocumentTitle } from "@/hooks";
import { usePosts, useSearch } from "@/lib/queries";
import { plural } from "@/lib/utils";

export function Saved() {
  useDocumentTitle("Saved");
  const posts = usePosts("saved");
  return (
    <div>
      <PageHeader title="Saved" icon={Bookmark} description="Recipes and posts you bookmarked." />
      <PostFeed query={posts} empty={{ icon: Bookmark, title: "Nothing saved yet", body: "Tap the bookmark on any post to keep it here for later." }} />
    </div>
  );
}

export function TagPage() {
  const { tag = "" } = useParams();
  useDocumentTitle(`#${tag}`);
  const posts = usePosts("tag", { tag });
  const count = posts.data?.pages[0]?.count;
  return (
    <div>
      <PageHeader
        title={`#${tag}`}
        icon={Hash}
        description={count !== undefined ? plural(count, "post") : "Loading…"}
      />
      <PostFeed query={posts} empty={{ icon: Hash, title: `Nothing tagged #${tag} yet`, body: "Be the first to use this tag." }} />
    </div>
  );
}

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const initial = params.get("q") ?? "";
  const [text, setText] = useState(initial);
  const q = useDebounce(text.trim(), 250);
  const search = useSearch(q);
  useDocumentTitle(q ? `“${q}”` : "Search");

  useEffect(() => {
    setParams(q ? { q } : {}, { replace: true });
  }, [q, setParams]);

  const data = search.data;
  const nothing = data && !data.users.length && !data.posts.length && !data.tags.length;

  return (
    <div>
      <PageHeader title="Search" icon={SearchIcon} />
      <div className="relative mb-6">
        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ink-3" aria-hidden />
        <Input
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Recipes, ingredients, cooks, tags…"
          aria-label="Search"
          autoFocus
          className="h-12 rounded-full pl-12 text-base"
        />
      </div>

      {!q ? (
        <EmptyState icon={SearchIcon} title="Find something delicious">Search by dish, ingredient, cuisine, person or tag.</EmptyState>
      ) : search.isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-40" />
        </div>
      ) : nothing ? (
        <EmptyState icon={SearchX} title={`No results for “${q}”`}>Try a different word, or check the spelling.</EmptyState>
      ) : (
        data && (
          <div className="space-y-8">
            {data.users.length > 0 && (
              <section aria-labelledby="search-people">
                <h2 id="search-people" className="mb-3 font-display text-lg font-semibold">People</h2>
                <ul className="card divide-y divide-line">
                  {data.users.map((user) => (
                    <li key={user.id} className="p-4">
                      <UserRow user={user} />
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {data.tags.length > 0 && (
              <section aria-labelledby="search-tags">
                <h2 id="search-tags" className="mb-3 font-display text-lg font-semibold">Tags</h2>
                <div className="flex flex-wrap gap-2">
                  {data.tags.map((tag) => (
                    <Link key={tag.name} to={`/tags/${tag.name}`} className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm font-medium hover:border-brand hover:text-brand">
                      #{tag.name} <span className="text-ink-3">{tag.count}</span>
                    </Link>
                  ))}
                </div>
              </section>
            )}
            {data.posts.length > 0 && (
              <section aria-labelledby="search-posts" className="space-y-4">
                <h2 id="search-posts" className="font-display text-lg font-semibold">Posts & recipes</h2>
                {data.posts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </section>
            )}
          </div>
        )
      )}
    </div>
  );
}
