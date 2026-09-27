import { ArrowRight, Copy, Ellipsis, Pencil, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { useDeletePost } from "@/lib/queries";
import type { Post } from "@/lib/types";
import { cn, copyText, fullDate, postUrl, recipeIntro, timeAgo } from "@/lib/utils";
import { useComposer } from "../composer/context";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { Menu } from "../ui/misc";
import { Comments } from "./Comments";
import { MediaGallery } from "./MediaGallery";
import { PostActions } from "./PostActions";
import { RecipeMeta } from "./RecipeMeta";

const LONG_TEXT = 420;

export function PostHeader({ post, showReason }: { post: Post; showReason?: boolean }) {
  const composer = useComposer();
  const remove = useDeletePost();
  const [confirming, setConfirming] = useState(false);

  const menu = [
    {
      label: "Copy link",
      icon: Copy,
      onSelect: async () => {
        if (await copyText(new URL(postUrl(post.id), location.origin).toString())) toast.success("Link copied");
      },
    },
    ...(post.is_owner
      ? [
          { label: "Edit post", icon: Pencil, onSelect: () => composer.open({ post }) },
          { label: "Delete post", icon: Trash2, onSelect: () => setConfirming(true), danger: true },
        ]
      : []),
  ];

  return (
    <header className="flex items-start gap-3 px-4 pt-4">
      <Link to={`/u/${post.author.username}`} className="shrink-0" aria-hidden tabIndex={-1}>
        <Avatar user={post.author} />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-1.5 text-sm">
          <Link to={`/u/${post.author.username}`} className="font-semibold text-ink hover:underline">
            {post.author.full_name}
          </Link>
          <span className="text-ink-3">@{post.author.username}</span>
          <span className="text-ink-3" aria-hidden>·</span>
          <Link to={postUrl(post.id)} className="text-ink-3 hover:underline">
            <time dateTime={post.created_at} title={fullDate(post.created_at)}>
              {timeAgo(post.created_at)}
            </time>
          </Link>
          {post.updated_at && <span className="text-xs text-ink-3">(edited)</span>}
        </div>
        {showReason && post.reason && (
          <p className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-brand">
            <Sparkles className="size-3" aria-hidden />
            {post.reason}
          </p>
        )}
      </div>
      <Menu label="Post options" trigger={<Ellipsis className="size-5" />} items={menu} />
      <Dialog open={confirming} onClose={() => setConfirming(false)} title="Delete this post?">
        <div className="space-y-5 p-5">
          <p className="text-sm text-ink-2">It will be removed for everyone, along with its comments and likes.</p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={remove.isPending}
              onClick={() => remove.mutate(post, { onSuccess: () => setConfirming(false) })}
            >
              Delete
            </Button>
          </div>
        </div>
      </Dialog>
    </header>
  );
}

export function PostCard({ post, showReason }: { post: Post; showReason?: boolean }) {
  const [showComments, setShowComments] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const intro = recipeIntro(post.body, post.is_recipe);
  const isLong = intro.length > LONG_TEXT;
  const text = isLong && !expanded ? `${intro.slice(0, LONG_TEXT).trimEnd()}…` : intro;
  const preview = post.ingredients.slice(0, 6);

  return (
    <article className="card animate-fade-up overflow-hidden" aria-labelledby={`post-${post.id}-title`}>
      <PostHeader post={post} showReason={showReason} />

      <div className="space-y-2.5 px-4 pb-3 pt-2.5">
        {post.is_recipe && post.title && (
          <h2 id={`post-${post.id}-title`} className="font-display text-xl font-semibold leading-snug tracking-tight">
            <Link to={postUrl(post.id)} className="hover:text-brand">
              {post.title}
            </Link>
          </h2>
        )}
        {post.is_recipe && <RecipeMeta post={post} />}
        {text && (
          <p
            id={post.is_recipe ? undefined : `post-${post.id}-title`}
            className="whitespace-pre-line break-words text-[15px] leading-relaxed text-ink-2"
          >
            {text}
            {isLong && (
              <button
                type="button"
                onClick={() => setExpanded((e) => !e)}
                className="ml-1 font-semibold text-ink hover:underline"
              >
                {expanded ? "Show less" : "Read more"}
              </button>
            )}
          </p>
        )}
      </div>

      <MediaGallery images={post.images} videos={post.videos} alt={post.title || "Post photo"} />

      {post.is_recipe && (
        <div className="mx-4 mt-3 rounded-xl bg-subtle/70 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-3">
            {post.ingredients.length} ingredients
          </p>
          <div className="flex flex-wrap gap-1.5">
            {preview.map((item) => (
              <span key={item} className="rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-ink-2 ring-1 ring-line">
                {item}
              </span>
            ))}
            {post.ingredients.length > preview.length && (
              <span className="px-1 py-1 text-xs font-medium text-ink-3">
                +{post.ingredients.length - preview.length} more
              </span>
            )}
          </div>
          <Link
            to={postUrl(post.id)}
            className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline"
          >
            Full recipe & cook mode <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      )}

      {post.tags.length > 0 && (
        <div className={cn("flex flex-wrap gap-x-2 gap-y-1 px-4", post.is_recipe || post.images.length ? "pt-3" : "")}>
          {post.tags.map((tag) => (
            <Link key={tag} to={`/tags/${tag}`} className="text-sm font-medium text-brand hover:underline">
              #{tag}
            </Link>
          ))}
        </div>
      )}

      <PostActions post={post} onComment={() => setShowComments((s) => !s)} />
      {showComments && <Comments post={post} autoFocus />}
    </article>
  );
}

export function PostCardSkeleton() {
  return (
    <div className="card space-y-4 p-4" aria-hidden>
      <div className="flex items-center gap-3">
        <div className="skeleton size-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-3.5 w-40" />
          <div className="skeleton h-3 w-24" />
        </div>
      </div>
      <div className="skeleton h-5 w-2/3" />
      <div className="space-y-2">
        <div className="skeleton h-3.5 w-full" />
        <div className="skeleton h-3.5 w-5/6" />
      </div>
      <div className="skeleton aspect-[3/2] w-full rounded-xl" />
    </div>
  );
}
