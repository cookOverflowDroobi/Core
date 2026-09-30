import {
  type InfiniteData,
  type QueryClient,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { api, errorMessage } from "./api";
import type {
  AIStatus,
  Badges,
  Comment,
  CookResponse,
  ScanResponse,
  Conversation,
  Notification,
  Message,
  Paginated,
  Post,
  PostDraft,
  Profile,
  ReactionState,
  SearchResults,
  Stats,
  TagCount,
  Thread,
  UserCard,
} from "./types";

export const keys = {
  me: ["me"] as const,
  posts: (feed: string, params?: object) => ["posts", feed, params ?? {}] as const,
  post: (id: number) => ["post", id] as const,
  comments: (id: number) => ["comments", id] as const,
  user: (username: string) => ["user", username.toLowerCase()] as const,
  userList: (username: string, kind: string) => ["users", kind, username.toLowerCase()] as const,
  suggestions: ["suggestions"] as const,
  tags: ["tags"] as const,
  cook: (ingredients: string[], staples: boolean) => ["cook", ingredients, staples] as const,
  scanStatus: ["cook-scan"] as const,
  badges: ["badges"] as const,
  notifications: ["notifications"] as const,
  conversations: ["conversations"] as const,
  thread: (username: string) => ["thread", username.toLowerCase()] as const,
  search: (q: string) => ["search", q] as const,
  stats: ["stats"] as const,
  ai: ["ai"] as const,
};

// ------------------------------------------------------------------ session

export function useMe() {
  return useQuery({
    queryKey: keys.me,
    queryFn: () => api<{ user: Profile | null }>("/auth/me/").then((r) => r.user),
    staleTime: 5 * 60_000,
    retry: 1,
  });
}

/** The signed-in user (only use under <RequireAuth>). */
export function useCurrentUser(): Profile {
  const { data } = useMe();
  if (!data) throw new Error("useCurrentUser used outside an authenticated route");
  return data;
}

export function useStats() {
  return useQuery({ queryKey: keys.stats, queryFn: () => api<Stats>("/stats/"), staleTime: 10 * 60_000 });
}

// -------------------------------------------------------------------- posts

export type FeedName = "feed" | "latest" | "trending" | "for-you" | "saved" | "recipes" | "tag" | "author";

const FEED_PATHS: Record<FeedName, string> = {
  feed: "/posts/feed/",
  latest: "/posts/",
  trending: "/posts/trending/",
  "for-you": "/posts/for-you/",
  saved: "/posts/saved/",
  recipes: "/posts/",
  tag: "/posts/",
  author: "/posts/",
};

export function usePosts(feed: FeedName, params: Record<string, string | undefined> = {}) {
  const query = feed === "recipes" ? { ...params, recipes: "1" } : params;
  return useInfiniteQuery({
    queryKey: keys.posts(feed, query),
    queryFn: ({ pageParam, signal }) =>
      api<Paginated<Post>>(FEED_PATHS[feed], { query: { ...query, page: pageParam }, signal }),
    initialPageParam: 1,
    getNextPageParam: (last) => last.next_page ?? undefined,
  });
}

export function usePost(id: number) {
  return useQuery({ queryKey: keys.post(id), queryFn: () => api<Post>(`/posts/${id}/`), enabled: id > 0 });
}

/** Apply `patch` to a post wherever it's cached (feeds, detail, cook results, search). */
export function patchPostEverywhere(qc: QueryClient, id: number, patch: Partial<Post> | ((p: Post) => Partial<Post>)) {
  const update = (post: Post): Post =>
    post.id === id ? { ...post, ...(typeof patch === "function" ? patch(post) : patch) } : post;

  qc.setQueriesData<InfiniteData<Paginated<Post>>>({ queryKey: ["posts"] }, (data) =>
    data ? { ...data, pages: data.pages.map((page) => ({ ...page, results: page.results.map(update) })) } : data,
  );
  qc.setQueryData<Post>(keys.post(id), (post) => (post ? update(post) : post));
  qc.setQueriesData<CookResponse>({ queryKey: ["cook"] }, (data) =>
    data ? { ...data, results: data.results.map((r) => ({ ...r, post: update(r.post) })) } : data,
  );
  qc.setQueriesData<SearchResults>({ queryKey: ["search"] }, (data) =>
    data ? { ...data, posts: data.posts.map(update) } : data,
  );
}

function removePostEverywhere(qc: QueryClient, id: number) {
  qc.setQueriesData<InfiniteData<Paginated<Post>>>({ queryKey: ["posts"] }, (data) =>
    data
      ? {
          ...data,
          pages: data.pages.map((page) => ({ ...page, results: page.results.filter((p) => p.id !== id) })),
        }
      : data,
  );
  qc.removeQueries({ queryKey: keys.post(id) });
}

/** Optimistic like/save toggles that roll back on failure. */
export function useReaction(kind: "like" | "save") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ post, on }: { post: Post; on: boolean }) =>
      api<ReactionState>(`/posts/${post.id}/${kind}/`, { method: on ? "POST" : "DELETE" }),
    onMutate: ({ post, on }) => {
      const before = { liked: post.liked, saved: post.saved, likes_count: post.likes_count };
      patchPostEverywhere(qc, post.id, (p) =>
        kind === "like"
          ? { liked: on, likes_count: Math.max(0, p.likes_count + (on ? 1 : -1)) }
          : { saved: on },
      );
      return { before };
    },
    onSuccess: (state, { post }) => {
      patchPostEverywhere(qc, post.id, state);
      if (kind === "save") qc.invalidateQueries({ queryKey: keys.posts("saved") });
    },
    onError: (error, { post }, context) => {
      if (context) patchPostEverywhere(qc, post.id, context.before);
      toast.error(errorMessage(error));
    },
  });
}

export function useSavePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, form }: { id?: number; form: FormData }) =>
      api<Post>(id ? `/posts/${id}/` : "/posts/", { method: id ? "PATCH" : "POST", form }),
    onSuccess: (post, { id }) => {
      if (id) {
        patchPostEverywhere(qc, id, post);
      } else {
        qc.invalidateQueries({ queryKey: ["posts"] });
        qc.invalidateQueries({ queryKey: keys.user(post.author.username) });
      }
      qc.invalidateQueries({ queryKey: keys.tags });
    },
  });
}

export function useDeletePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (post: Post) => api<void>(`/posts/${post.id}/`, { method: "DELETE" }),
    onSuccess: (_, post) => {
      removePostEverywhere(qc, post.id);
      qc.invalidateQueries({ queryKey: keys.user(post.author.username) });
      toast.success("Post deleted");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

// ----------------------------------------------------------------- comments

export function useComments(postId: number, enabled = true) {
  return useQuery({
    queryKey: keys.comments(postId),
    queryFn: () => api<Comment[]>(`/posts/${postId}/comments/`),
    enabled,
  });
}

export function useAddComment(postId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) =>
      api<Comment>(`/posts/${postId}/comments/`, { method: "POST", body: { content } }),
    onSuccess: (comment) => {
      qc.setQueryData<Comment[]>(keys.comments(postId), (list) => [...(list ?? []), comment]);
      patchPostEverywhere(qc, postId, (p) => ({ comments_count: p.comments_count + 1 }));
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

export function useDeleteComment(postId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentId: number) => api<void>(`/comments/${commentId}/`, { method: "DELETE" }),
    onSuccess: (_, commentId) => {
      qc.setQueryData<Comment[]>(keys.comments(postId), (list) => list?.filter((c) => c.id !== commentId));
      patchPostEverywhere(qc, postId, (p) => ({ comments_count: Math.max(0, p.comments_count - 1) }));
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

// -------------------------------------------------------------------- users

export function useProfile(username: string) {
  return useQuery({
    queryKey: keys.user(username),
    queryFn: () => api<Profile>(`/users/${encodeURIComponent(username)}/`),
    enabled: !!username,
  });
}

export function useUserList(username: string, kind: "followers" | "following", enabled: boolean) {
  return useInfiniteQuery({
    queryKey: keys.userList(username, kind),
    queryFn: ({ pageParam }) =>
      api<Paginated<UserCard>>(`/users/${encodeURIComponent(username)}/${kind}/`, { query: { page: pageParam } }),
    initialPageParam: 1,
    getNextPageParam: (last) => last.next_page ?? undefined,
    enabled,
  });
}

export function useSuggestions(limit = 5) {
  return useQuery({
    queryKey: [...keys.suggestions, limit],
    queryFn: () => api<UserCard[]>("/users/suggestions/", { query: { limit } }),
    staleTime: 60_000,
  });
}

export function useFollow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ username, follow }: { username: string; follow: boolean }) =>
      api<{ is_following: boolean; followers_count: number }>(`/users/${encodeURIComponent(username)}/follow/`, {
        method: follow ? "POST" : "DELETE",
      }),
    onSuccess: (state, { username }) => {
      qc.setQueryData<Profile>(keys.user(username), (p) => (p ? { ...p, ...state } : p));
      const patchCard = (u: UserCard) => (u.username === username ? { ...u, ...state } : u);
      qc.setQueriesData<UserCard[]>({ queryKey: keys.suggestions }, (list) => list?.map(patchCard));
      qc.setQueriesData<InfiniteData<Paginated<UserCard>>>({ queryKey: ["users"] }, (data) =>
        data ? { ...data, pages: data.pages.map((pg) => ({ ...pg, results: pg.results.map(patchCard) })) } : data,
      );
      qc.invalidateQueries({ queryKey: keys.posts("feed") });
      qc.invalidateQueries({ queryKey: keys.me });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

// ----------------------------------------------------------------- discover

export function useTags(limit = 30) {
  return useQuery({
    queryKey: [...keys.tags, limit],
    queryFn: () => api<TagCount[]>("/tags/", { query: { limit } }),
    staleTime: 5 * 60_000,
  });
}

export function useCook(ingredients: string[], staples: boolean) {
  return useQuery({
    queryKey: keys.cook(ingredients, staples),
    queryFn: ({ signal }) =>
      api<CookResponse>("/cook/", { query: { ingredients: ingredients.join(","), staples: staples ? 1 : 0 }, signal }),
    enabled: ingredients.length > 0,
    placeholderData: (previous) => previous,
  });
}

/** Whether this server has fridge scanning set up (it needs a vision model API key). */
export function useScanStatus() {
  return useQuery({
    queryKey: keys.scanStatus,
    queryFn: () => api<{ enabled: boolean; max_images: number }>("/cook/scan/"),
    staleTime: 10 * 60_000,
  });
}

export function useScanFridge() {
  return useMutation({
    mutationFn: (photos: File[]) => {
      const form = new FormData();
      for (const photo of photos) form.append("images", photo);
      return api<ScanResponse>("/cook/scan/", { method: "POST", form });
    },
  });
}

export function useSearch(q: string) {
  return useQuery({
    queryKey: keys.search(q),
    queryFn: ({ signal }) => api<SearchResults>("/search/", { query: { q }, signal }),
    enabled: q.trim().length > 0,
    placeholderData: (previous) => previous,
  });
}

// -------------------------------------------------------------------- inbox

export function useBadges(enabled = true) {
  return useQuery({
    queryKey: keys.badges,
    queryFn: () => api<Badges>("/badges/"),
    enabled,
    refetchInterval: 20_000,
    refetchIntervalInBackground: false,
  });
}

export function useNotifications() {
  return useInfiniteQuery({
    queryKey: keys.notifications,
    queryFn: ({ pageParam }) =>
      api<Paginated<Notification>>("/notifications/", { query: { page: pageParam, page_size: 20 } }),
    initialPageParam: 1,
    getNextPageParam: (last) => last.next_page ?? undefined,
  });
}

export function useConversations() {
  return useQuery({
    queryKey: keys.conversations,
    queryFn: () => api<Conversation[]>("/conversations/"),
    refetchInterval: 10_000,
  });
}

export function useThread(username: string) {
  return useQuery({
    queryKey: keys.thread(username),
    queryFn: () => api<Thread>(`/conversations/${encodeURIComponent(username)}/`),
    enabled: !!username,
    refetchInterval: 4_000,
  });
}

// ----------------------------------------------------------------------- AI

/** Whether this server has AI set up, and what its model can read. */
export function useAIStatus() {
  return useQuery({ queryKey: keys.ai, queryFn: () => api<AIStatus>("/ai/"), staleTime: 10 * 60_000 });
}

/** A post or recipe drafted from a prompt, photos and a video (or frames from one). Nothing is posted. */
export function useDraftPost() {
  return useMutation({
    mutationFn: (form: FormData) => api<{ draft: PostDraft }>("/ai/post-draft/", { method: "POST", form }),
  });
}

/** A draft of your next message in a chat, optionally from your own rough `hint`. Nothing is sent. */
export function useDraftReply(username: string) {
  return useMutation({
    mutationFn: (hint: string) =>
      api<{ draft: string }>(`/conversations/${encodeURIComponent(username)}/draft/`, { method: "POST", body: { hint } }),
  });
}

/** Ask Sous-chef to answer your latest messages; its answer joins the thread. */
export function useSousChefReply(username: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<{ message: Message | null }>(`/conversations/${encodeURIComponent(username)}/reply/`, { method: "POST" }),
    onSuccess: ({ message }) => {
      if (message) {
        qc.setQueryData<Thread>(keys.thread(username), (t) =>
          t && !t.messages.some((m) => m.id === message.id) ? { ...t, messages: [...t.messages, message] } : t,
        );
      }
      // Reading the thread marks the answer read while the chat is open (a closed chat isn't refetched, so the
      // answer stays unread there); then refresh the unread counts.
      qc.invalidateQueries({ queryKey: keys.thread(username) }).then(() => {
        qc.invalidateQueries({ queryKey: keys.conversations });
        qc.invalidateQueries({ queryKey: keys.badges });
      });
    },
  });
}
