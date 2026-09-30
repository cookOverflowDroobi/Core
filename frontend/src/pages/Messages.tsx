import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChefHat, MessageCircle, MessagesSquare, PenSquare, RotateCw, SendHorizontal, Sparkles } from "lucide-react";
import { type FormEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { LinkedText } from "@/components/LinkedText";
import { Avatar } from "@/components/ui/Avatar";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Field";
import { Chip, EmptyState, Skeleton, Spinner } from "@/components/ui/misc";
import { useDebounce, useDocumentTitle } from "@/hooks";
import { api, errorMessage } from "@/lib/api";
import { keys, useAIStatus, useConversations, useDraftReply, useMe, useSousChefReply, useThread } from "@/lib/queries";
import type { Conversation, Message, Paginated, Thread, UserCard, UserMini } from "@/lib/types";
import { cn, dayLabel, timeAgo } from "@/lib/utils";

export default function Messages() {
  const { username } = useParams();
  useDocumentTitle(username ? `Chat with @${username}` : "Messages");
  const [composing, setComposing] = useState(false);
  const chef = useSousChef();

  return (
    <div className="card flex h-[calc(100dvh-10.5rem)] overflow-hidden md:h-[calc(100dvh-3rem)]">
      <aside className={cn("flex w-full flex-col border-r border-line md:w-80 md:shrink-0", username && "max-md:hidden")}>
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <h1 className="font-display text-xl font-semibold">Messages</h1>
          <Button variant="ghost" size="icon-sm" onClick={() => setComposing(true)} aria-label="New message">
            <PenSquare className="size-5" />
          </Button>
        </header>
        <ConversationList active={username} />
      </aside>
      <section className={cn("min-w-0 flex-1", !username && "max-md:hidden")}>
        {username ? (
          <ThreadView key={username.toLowerCase()} username={username} />
        ) : (
          <EmptyState
            icon={MessagesSquare}
            title="Your messages"
            className="h-full justify-center"
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => setComposing(true)}>New message</Button>
                {chef && (
                  <ButtonLink to={`/messages/${chef.username}`} variant="soft">
                    <ChefHat className="size-4" aria-hidden /> Ask {chef.full_name}
                  </ButtonLink>
                )}
              </div>
            }
          >
            Swap tips, ask for a recipe, or plan the next potluck.
          </EmptyState>
        )}
      </section>
      <NewMessageDialog open={composing} onClose={() => setComposing(false)} />
    </div>
  );
}

/** Sous-chef's account, when this server has AI set up. */
function useSousChef(): UserMini | null {
  const ai = useAIStatus();
  return ai.data?.enabled ? ai.data.assistant : null;
}

function ConversationList({ active }: { active?: string }) {
  const { data, isPending } = useConversations();
  const chef = useSousChef();
  if (isPending) {
    return (
      <div className="space-y-3 p-4">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-14" />
        ))}
      </div>
    );
  }
  const chefChat = chef ? data?.find((c) => c.user.id === chef.id) : undefined;
  const others = (data ?? []).filter((c) => c !== chefChat);
  return (
    <ul className="flex-1 overflow-y-auto p-2">
      {chef && (
        <li className="mb-1 border-b border-line pb-1">
          <ConversationRow
            conversation={chefChat ?? { user: chef, last_message: "", last_is_mine: false, updated_at: "", unread: 0 }}
            placeholder="Ask me what to cook tonight"
            active={active}
          />
        </li>
      )}
      {others.map((c) => (
        <li key={c.user.id}>
          <ConversationRow conversation={c} active={active} />
        </li>
      ))}
      {!others.length && <li className="p-6 text-center text-sm text-ink-3">No conversations yet.</li>}
    </ul>
  );
}

function ConversationRow({ conversation: c, active, placeholder = "Say hello 👋" }: {
  conversation: Conversation;
  active?: string;
  placeholder?: string;
}) {
  return (
    <NavLink
      to={`/messages/${c.user.username}`}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
        active?.toLowerCase() === c.user.username.toLowerCase() ? "bg-brand-soft" : "hover:bg-subtle",
      )}
    >
      <Avatar user={c.user} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className={cn("flex min-w-0 items-center gap-1.5 text-sm", c.unread ? "font-bold" : "font-semibold")}>
            <span className="truncate">{c.user.full_name}</span>
            {c.user.is_bot && <AIBadge />}
          </span>
          {c.updated_at && <span className="shrink-0 text-xs text-ink-3">{timeAgo(c.updated_at)}</span>}
        </span>
        <span className={cn("block truncate text-sm", c.unread ? "font-medium text-ink" : "text-ink-3")}>
          {c.last_is_mine && "You: "}
          {c.last_message || placeholder}
        </span>
      </span>
      {c.unread > 0 && (
        <span className="grid min-w-5 place-items-center rounded-full bg-brand px-1.5 text-[11px] font-bold leading-5 text-on-brand">{c.unread}</span>
      )}
    </NavLink>
  );
}

function AIBadge() {
  return (
    <Chip tone="brand" className="shrink-0 px-1.5 py-0 text-[10px] font-bold uppercase tracking-wide">
      AI
    </Chip>
  );
}

const STARTERS = [
  "What can I cook with chicken, rice and onion?",
  "What's trending on cookOverflow this week?",
  "A quick vegetarian dinner for two?",
  "How do I keep my rice from going mushy?",
];

function ThreadView({ username }: { username: string }) {
  const qc = useQueryClient();
  const { data, isPending, error } = useThread(username);
  const ai = useAIStatus();
  const answer = useSousChefReply(username);
  const draft = useDraftReply(username);
  const [text, setText] = useState("");
  const input = useRef<HTMLTextAreaElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const count = data?.messages.length ?? 0;
  const isChef = !!data?.user.is_bot;
  const aiOn = !!ai.data?.enabled;

  useLayoutEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [count, answer.isPending]);

  // Opening a thread marks it read on the server; refresh the unread badges.
  useEffect(() => {
    if (!count) return;
    qc.invalidateQueries({ queryKey: keys.badges });
    qc.invalidateQueries({ queryKey: keys.conversations });
  }, [count, qc]);

  const send = useMutation({
    mutationFn: (body: string) => api<Message>(`/conversations/${encodeURIComponent(username)}/`, { method: "POST", body: { body } }),
    onMutate: (body) => {
      const optimistic: Message = { id: -Date.now(), body, created_at: new Date().toISOString(), is_mine: true, is_read: true };
      qc.setQueryData<Thread>(keys.thread(username), (t) => (t ? { ...t, messages: [...t.messages, optimistic] } : t));
      return { optimistic };
    },
    onSuccess: (message, _, context) => {
      qc.setQueryData<Thread>(keys.thread(username), (t) =>
        t ? { ...t, messages: t.messages.map((m) => (m.id === context?.optimistic.id ? message : m)) } : t,
      );
      qc.invalidateQueries({ queryKey: keys.conversations });
      if (isChef && aiOn) answer.mutate();
    },
    onError: (err, body, context) => {
      qc.setQueryData<Thread>(keys.thread(username), (t) =>
        t ? { ...t, messages: t.messages.filter((m) => m.id !== context?.optimistic.id) } : t,
      );
      setText(body);
      toast.error(errorMessage(err));
    },
  });

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    const body = text.trim();
    if (!body) return;
    setText("");
    send.mutate(body);
  };

  // AI: a draft of your reply, or your own rough words ("yes but not friday") polished into one.
  const suggest = () =>
    draft.mutate(text.trim(), {
      onSuccess: (result) => {
        const before = text;
        setText(result.draft);
        input.current?.focus();
        toast("Drafted with AI. Edit it before you send.", {
          action: before.trim() ? { label: "Undo", onClick: () => setText(before) } : undefined,
        });
      },
      onError: (err) => toast.error(errorMessage(err)),
    });

  if (isPending) return <div className="grid h-full place-items-center"><Spinner /></div>;
  if (error || !data) {
    return <EmptyState icon={MessageCircle} title="Conversation not found" className="h-full justify-center">{errorMessage(error)}</EmptyState>;
  }

  const last = data.messages[data.messages.length - 1];
  // Sous-chef hasn't answered your latest message (its last answer failed, or the page was closed meanwhile).
  const unanswered = isChef && aiOn && !!last?.is_mine && last.id > 0 && !answer.isPending && !send.isPending;
  const firstName = data.user.full_name.split(" ")[0];

  let lastDay = "";
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-line px-4 py-3">
        <Link to="/messages" className="rounded-full p-1.5 text-ink-2 hover:bg-subtle md:hidden" aria-label="Back to conversations">
          <ArrowLeft className="size-5" />
        </Link>
        <Link to={`/u/${data.user.username}`} className="flex min-w-0 items-center gap-3">
          <Avatar user={data.user} size="sm" />
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 text-sm font-semibold">
              <span className="truncate hover:underline">{data.user.full_name}</span>
              {isChef && <AIBadge />}
            </span>
            <span className="block truncate text-xs text-ink-3">
              {isChef ? "Cooking assistant · answers with recipes from cookOverflow" : `@${data.user.username}`}
            </span>
          </span>
        </Link>
      </header>

      <div className="flex-1 space-y-1.5 overflow-y-auto px-4 py-4" role="log" aria-live="polite" aria-label={`Messages with ${data.user.full_name}`}>
        {data.messages.length === 0 && (isChef ? (
          <EmptyState icon={ChefHat} title={`Ask ${firstName} anything`}>
            <p>What to cook tonight, how to fix a dish, or what's trending. It suggests recipes cooks shared here first.</p>
            {aiOn && (
              <ul className="mt-4 flex flex-wrap justify-center gap-2">
                {STARTERS.map((starter) => (
                  <li key={starter}>
                    <button
                      type="button"
                      onClick={() => send.mutate(starter)}
                      className="rounded-full border border-line bg-surface px-3 py-1.5 text-left text-xs font-medium text-ink-2 hover:border-brand hover:text-brand"
                    >
                      {starter}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </EmptyState>
        ) : (
          <EmptyState icon={MessagesSquare} title={`Say hi to ${firstName}`}>
            Ask about a recipe or share a cooking tip.
          </EmptyState>
        ))}
        {data.messages.map((message) => {
          const day = dayLabel(message.created_at);
          const separator = day !== lastDay;
          lastDay = day;
          return (
            <div key={message.id}>
              {separator && <p className="py-3 text-center text-xs font-medium text-ink-3">{day}</p>}
              <div className={cn("flex", message.is_mine ? "justify-end" : "justify-start")}>
                <p
                  title={new Date(message.created_at).toLocaleString()}
                  className={cn(
                    "max-w-[80%] whitespace-pre-line break-words rounded-2xl px-3.5 py-2 text-[15px] leading-snug",
                    message.is_mine ? "rounded-br-md bg-brand text-on-brand" : "rounded-bl-md bg-subtle text-ink",
                    message.id < 0 && "opacity-60",
                  )}
                >
                  <LinkedText text={message.body} />
                </p>
              </div>
            </div>
          );
        })}
        {answer.isPending && <Typing name={firstName} />}
        {(answer.isError || unanswered) && !answer.isPending && (
          <div role="alert" className="flex flex-wrap items-center gap-2 pt-1 text-xs text-ink-3">
            {answer.isError ? `${firstName} couldn't answer: ${errorMessage(answer.error)}` : `${firstName} hasn't answered yet.`}
            <Button size="sm" variant="ghost" onClick={() => answer.mutate()}>
              <RotateCw className="size-3.5" aria-hidden /> Try again
            </Button>
          </div>
        )}
        {isChef && !aiOn && (
          <p className="pt-2 text-center text-xs text-ink-3">{firstName} is offline: AI isn't set up on this server.</p>
        )}
        <div ref={bottom} />
      </div>

      <form onSubmit={submit} className="flex items-end gap-2 border-t border-line p-3">
        {aiOn && !isChef && (
          <Button
            variant="ghost"
            size="icon"
            onClick={suggest}
            loading={draft.isPending}
            aria-label={text.trim() ? "Polish my message with AI" : "Draft a reply with AI"}
            title={text.trim() ? "Polish my message with AI" : "Draft a reply with AI"}
            className="size-11 shrink-0 text-brand hover:bg-brand-soft hover:text-brand"
          >
            {!draft.isPending && <Sparkles className="size-5" />}
          </Button>
        )}
        <textarea
          ref={input}
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
          autoFocus
          placeholder={isChef ? `Ask ${firstName}…` : "Write a message…"}
          aria-label="Write a message"
          className="field-sizing-content max-h-36 min-h-11 flex-1 resize-none rounded-2xl border border-line bg-surface px-4 py-2.5 text-[15px] placeholder:text-ink-3 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15"
        />
        <Button type="submit" size="icon" disabled={!text.trim()} aria-label="Send message" className="size-11">
          <SendHorizontal className="size-5" />
        </Button>
      </form>
    </div>
  );
}

function Typing({ name }: { name: string }) {
  return (
    <div className="flex justify-start" role="status" aria-label={`${name} is typing`}>
      <p className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-subtle px-4 py-3.5">
        {[0, 150, 300].map((delay) => (
          <span key={delay} className="size-1.5 animate-bounce rounded-full bg-ink-3" style={{ animationDelay: `${delay}ms` }} />
        ))}
      </p>
    </div>
  );
}

function NewMessageDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { data: me } = useMe();
  const [query, setQuery] = useState("");
  const debounced = useDebounce(query.trim(), 200);
  const users = useQuery({
    queryKey: ["user-search", debounced],
    queryFn: () => api<Paginated<UserCard>>("/users/", { query: { q: debounced } }),
    enabled: open,
  });

  return (
    <Dialog open={open} onClose={onClose} title="New message">
      <div className="p-5">
        <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search people" aria-label="Search people" />
        <ul className="mt-4 max-h-80 space-y-1 overflow-y-auto">
          {users.data?.results.filter((user) => user.id !== me?.id).map((user) => (
            <li key={user.id}>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigate(`/messages/${user.username}`);
                }}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-subtle"
              >
                <Avatar user={user} />
                <span>
                  <span className="block text-sm font-semibold">{user.full_name}</span>
                  <span className="block text-xs text-ink-3">@{user.username}</span>
                </span>
              </button>
            </li>
          ))}
          {users.isFetching && <li className="py-3 text-center"><Spinner /></li>}
        </ul>
      </div>
    </Dialog>
  );
}
