import type { InfiniteData, UseInfiniteQueryResult } from "@tanstack/react-query";
import { CircleAlert, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useOnVisible } from "@/hooks";
import { errorMessage } from "@/lib/api";
import type { Paginated, Post } from "@/lib/types";
import { Button } from "../ui/Button";
import { EmptyState, Spinner } from "../ui/misc";
import { PostCard, PostCardSkeleton } from "./PostCard";

interface PostFeedProps {
  query: UseInfiniteQueryResult<InfiniteData<Paginated<Post>>>;
  empty: { icon: LucideIcon; title: string; body?: ReactNode; action?: ReactNode };
  showReason?: boolean;
}

export function PostFeed({ query, empty, showReason }: PostFeedProps) {
  const { data, isPending, isError, error, refetch, hasNextPage, fetchNextPage, isFetchingNextPage } = query;
  const sentinel = useOnVisible<HTMLDivElement>(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, !!hasNextPage);

  if (isPending) {
    return (
      <div className="space-y-4" aria-busy>
        <PostCardSkeleton />
        <PostCardSkeleton />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="card">
        <EmptyState
          icon={CircleAlert}
          title="Couldn't load posts"
          action={<Button onClick={() => refetch()}>Try again</Button>}
        >
          {errorMessage(error)}
        </EmptyState>
      </div>
    );
  }

  const posts = data.pages.flatMap((page) => page.results);
  if (!posts.length) {
    return (
      <div className="card">
        <EmptyState icon={empty.icon} title={empty.title} action={empty.action}>
          {empty.body}
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} showReason={showReason} />
      ))}
      <div ref={sentinel} className="flex justify-center py-4">
        {isFetchingNextPage ? (
          <Spinner label="Loading more posts" />
        ) : hasNextPage ? (
          <Button variant="outline" onClick={() => fetchNextPage()}>
            Load more
          </Button>
        ) : (
          <p className="text-sm text-ink-3">You're all caught up.</p>
        )}
      </div>
    </div>
  );
}
