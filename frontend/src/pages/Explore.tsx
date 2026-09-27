import { ChefHat, Clock, Compass, Flame, Hash, Sparkles } from "lucide-react";
import { Link, useParams } from "react-router";
import { PostFeed } from "@/components/post/PostFeed";
import { PageHeader, Tabs } from "@/components/ui/misc";
import { useDocumentTitle } from "@/hooks";
import { type FeedName, usePosts, useTags } from "@/lib/queries";

const TABS = [
  { to: "/explore", label: "For you", icon: Sparkles, end: true },
  { to: "/explore/trending", label: "Trending", icon: Flame },
  { to: "/explore/latest", label: "Latest", icon: Clock },
  { to: "/explore/recipes", label: "Recipes", icon: ChefHat },
];

const FEEDS: Record<string, FeedName> = { trending: "trending", latest: "latest", recipes: "recipes" };

export default function Explore() {
  const { tab = "" } = useParams();
  const feed: FeedName = FEEDS[tab] ?? "for-you";
  useDocumentTitle("Explore");
  const posts = usePosts(feed);
  const tags = useTags(14);

  return (
    <div>
      <PageHeader title="Explore" icon={Compass} description="Fresh ideas from cooks around the world." />
      <Tabs items={TABS} className="mb-4" />
      {tags.data && (
        <div className="scrollbar-none -mx-4 mb-5 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0" aria-label="Popular tags">
          {tags.data.map((tag) => (
            <Link
              key={tag.name}
              to={`/tags/${tag.name}`}
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink-2 hover:border-brand hover:text-brand"
            >
              <Hash className="size-3.5" aria-hidden />
              {tag.name}
            </Link>
          ))}
        </div>
      )}
      <PostFeed
        query={posts}
        showReason={feed === "for-you"}
        empty={{ icon: Compass, title: "Nothing here yet", body: "Check back soon, the kitchen is warming up." }}
      />
    </div>
  );
}
