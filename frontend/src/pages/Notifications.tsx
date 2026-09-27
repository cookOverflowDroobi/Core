import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, Heart, MessageCircle, UserPlus, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { Link } from "react-router";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { EmptyState, PageHeader, Skeleton, Spinner } from "@/components/ui/misc";
import { useDocumentTitle, useOnVisible } from "@/hooks";
import { api } from "@/lib/api";
import { keys, useNotifications } from "@/lib/queries";
import type { Notification } from "@/lib/types";
import { cn, dayLabel, fullDate, timeAgo } from "@/lib/utils";

const TYPES = {
  like: { icon: Heart, tone: "bg-danger text-white", text: "liked your post" },
  comment: { icon: MessageCircle, tone: "bg-sky-500 text-white", text: "commented on your post" },
  follow: { icon: UserPlus, tone: "bg-herb text-white", text: "started following you" },
  other: { icon: Bell, tone: "bg-ink-3 text-white", text: "interacted with you" },
} as const;

export default function Notifications() {
  useDocumentTitle("Notifications");
  const qc = useQueryClient();
  const query = useNotifications();
  const sentinel = useOnVisible<HTMLDivElement>(() => query.fetchNextPage(), !!query.hasNextPage);
  const marked = useRef(false);

  const markRead = useMutation({
    mutationFn: () => api("/notifications/read/", { method: "POST", body: {} }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.badges }),
  });
  const remove = useMutation({
    mutationFn: (id: number) => api(`/notifications/${id}/`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.notifications }),
  });

  // Opening the page counts as seeing them; keep the highlight until the next visit.
  useEffect(() => {
    if (query.data && !marked.current) {
      marked.current = true;
      if (query.data.pages[0].results.some((n) => !n.is_seen)) markRead.mutate();
    }
  }, [query.data, markRead]);

  const items = query.data?.pages.flatMap((p) => p.results) ?? [];
  const groups: [string, Notification[]][] = [];
  for (const note of items) {
    const label = dayLabel(note.created_at);
    const last = groups[groups.length - 1];
    if (last?.[0] === label) last[1].push(note);
    else groups.push([label, [note]]);
  }

  return (
    <div>
      <PageHeader
        title="Notifications"
        icon={Bell}
        actions={
          items.some((n) => !n.is_seen) && (
            <Button variant="ghost" size="sm" onClick={() => markRead.mutate()}>
              <CheckCheck className="size-4" aria-hidden /> Mark all read
            </Button>
          )
        }
      />
      {query.isPending ? (
        <div className="card space-y-4 p-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : !items.length ? (
        <div className="card">
          <EmptyState icon={Bell} title="All quiet in the kitchen">
            When people like, comment on or follow you, you'll see it here.
          </EmptyState>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map(([label, notes]) => (
            <section key={label} aria-label={label}>
              <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-ink-3">{label}</h2>
              <ul className="card divide-y divide-line overflow-hidden">
                {notes.map((note) => {
                  const type = TYPES[note.type];
                  const to = note.post ? `/posts/${note.post.id}` : `/u/${note.actor.username}`;
                  return (
                    <li key={note.id} className={cn("group relative flex items-center gap-3 px-4 py-3 transition-colors hover:bg-subtle/60", !note.is_seen && "bg-brand-soft/50")}>
                      <div className="relative shrink-0">
                        <Avatar user={note.actor} />
                        <span className={cn("absolute -bottom-1 -right-1 grid size-5 place-items-center rounded-full ring-2 ring-surface", type.tone)}>
                          <type.icon className="size-3" aria-hidden />
                        </span>
                      </div>
                      <Link to={to} className="min-w-0 flex-1 text-sm after:absolute after:inset-0">
                        <span className="font-semibold">{note.actor.full_name}</span> {type.text}
                        {note.post?.title && <span className="text-ink-2"> “{note.post.title}”</span>}
                        <time className="block text-xs text-ink-3" dateTime={note.created_at} title={fullDate(note.created_at)}>
                          {timeAgo(note.created_at)}
                        </time>
                      </Link>
                      {note.post?.thumbnail && <img src={note.post.thumbnail} alt="" className="size-11 shrink-0 rounded-lg object-cover" loading="lazy" />}
                      {!note.is_seen && <span className="size-2 shrink-0 rounded-full bg-brand" aria-label="Unread" />}
                      <button
                        type="button"
                        onClick={() => remove.mutate(note.id)}
                        className="relative z-10 rounded-full p-1.5 text-ink-3 opacity-0 hover:bg-line hover:text-ink focus:opacity-100 group-hover:opacity-100"
                        aria-label="Dismiss notification"
                      >
                        <X className="size-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          <div ref={sentinel} className="flex justify-center py-2">
            {query.isFetchingNextPage && <Spinner />}
          </div>
        </div>
      )}
    </div>
  );
}
