import { Bookmark, Heart, MessageCircle, Share2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useReaction } from "@/lib/queries";
import type { Post } from "@/lib/types";
import { cn, copyText, formatCount, postUrl } from "@/lib/utils";

export async function sharePost(post: Post) {
  const url = new URL(postUrl(post.id), window.location.origin).toString();
  const title = post.title || `${post.author.full_name} on cookOverflow`;
  if (navigator.share) {
    try {
      await navigator.share({ title, url });
      return;
    } catch {
      /* cancelled: fall back to copying */
    }
  }
  if (await copyText(url)) toast.success("Link copied");
}

const action =
  "inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-ink-2 transition-colors hover:bg-subtle";

export function PostActions({ post, onComment }: { post: Post; onComment?: () => void }) {
  const like = useReaction("like");
  const save = useReaction("save");
  const [burst, setBurst] = useState(0);

  return (
    <div className="flex items-center gap-1 px-2 py-1.5">
      <button
        type="button"
        onClick={() => {
          if (!post.liked) setBurst((n) => n + 1);
          like.mutate({ post, on: !post.liked });
        }}
        className={cn(action, post.liked && "text-danger hover:bg-danger-soft")}
        aria-pressed={post.liked}
        aria-label={post.liked ? "Unlike" : "Like"}
      >
        <Heart key={burst} className={cn("size-5", post.liked && "animate-pop fill-current")} aria-hidden />
        <span className="tabular-nums">{formatCount(post.likes_count)}</span>
      </button>
      <button type="button" onClick={onComment} className={action} aria-label={`Comments (${post.comments_count})`}>
        <MessageCircle className="size-5" aria-hidden />
        <span className="tabular-nums">{formatCount(post.comments_count)}</span>
      </button>
      <div className="ml-auto flex items-center">
        <button type="button" onClick={() => sharePost(post)} className={action} aria-label="Share">
          <Share2 className="size-5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => {
            save.mutate({ post, on: !post.saved });
            toast.success(post.saved ? "Removed from saved" : "Saved to your collection");
          }}
          className={cn(action, post.saved && "text-brand")}
          aria-pressed={post.saved}
          aria-label={post.saved ? "Remove from saved" : "Save"}
        >
          <Bookmark className={cn("size-5", post.saved && "fill-current")} aria-hidden />
        </button>
      </div>
    </div>
  );
}
