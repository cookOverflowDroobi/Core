import { SendHorizontal, Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Link } from "react-router";
import { useAddComment, useComments, useCurrentUser, useDeleteComment } from "@/lib/queries";
import type { Post } from "@/lib/types";
import { fullDate, timeAgo } from "@/lib/utils";
import { Avatar } from "../ui/Avatar";
import { Skeleton } from "../ui/misc";

export function Comments({ post, autoFocus }: { post: Post; autoFocus?: boolean }) {
  const me = useCurrentUser();
  const { data: comments, isPending } = useComments(post.id);
  const add = useAddComment(post.id);
  const remove = useDeleteComment(post.id);
  const [text, setText] = useState("");

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    const content = text.trim();
    if (!content || add.isPending) return;
    add.mutate(content, { onSuccess: () => setText("") });
  };

  return (
    <section className="space-y-3 border-t border-line px-4 py-3" aria-label="Comments">
      {isPending ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="flex gap-2.5">
              <Skeleton className="size-8 rounded-full" />
              <Skeleton className="h-12 flex-1 rounded-2xl" />
            </div>
          ))}
        </div>
      ) : comments?.length ? (
        <ul className="space-y-3">
          {comments.map((comment) => (
            <li key={comment.id} className="group flex animate-fade-up gap-2.5">
              <Link to={`/u/${comment.author.username}`} className="shrink-0">
                <Avatar user={comment.author} size="sm" />
              </Link>
              <div className="min-w-0 flex-1">
                <div className="inline-block max-w-full rounded-2xl bg-subtle px-3.5 py-2">
                  <Link to={`/u/${comment.author.username}`} className="text-sm font-semibold hover:underline">
                    {comment.author.full_name}
                  </Link>
                  <p className="whitespace-pre-line break-words text-sm text-ink-2">{comment.content}</p>
                </div>
                <div className="mt-0.5 flex items-center gap-3 px-2 text-xs text-ink-3">
                  <time dateTime={comment.created_at} title={fullDate(comment.created_at)}>
                    {timeAgo(comment.created_at)}
                  </time>
                  {(comment.is_owner || post.is_owner) && (
                    <button
                      type="button"
                      onClick={() => remove.mutate(comment.id)}
                      className="inline-flex items-center gap-1 font-medium opacity-0 transition-opacity hover:text-danger focus:opacity-100 group-hover:opacity-100"
                    >
                      <Trash2 className="size-3" aria-hidden /> Delete
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-3">No comments yet. Be the first to say something nice.</p>
      )}

      <form onSubmit={submit} className="flex items-end gap-2.5">
        <Avatar user={me} size="sm" />
        <div className="flex flex-1 items-end rounded-2xl border border-line bg-surface pr-1.5 focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/15">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            maxLength={1000}
            autoFocus={autoFocus}
            placeholder="Write a comment…"
            id={`comment-box-${post.id}`}
            aria-label="Write a comment"
            className="field-sizing-content max-h-40 min-h-10 flex-1 resize-none bg-transparent px-3.5 py-2.5 text-sm placeholder:text-ink-3 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!text.trim() || add.isPending}
            className="mb-1 rounded-full p-2 text-brand hover:bg-brand-soft disabled:text-ink-3 disabled:hover:bg-transparent"
            aria-label="Post comment"
          >
            <SendHorizontal className="size-4" />
          </button>
        </div>
      </form>
    </section>
  );
}
