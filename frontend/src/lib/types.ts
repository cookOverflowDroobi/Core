export interface UserMini {
  id: number;
  username: string;
  full_name: string;
  avatar: string | null;
  /** An account the server runs, like the Sous-chef assistant. */
  is_bot: boolean;
}

export interface UserCard extends UserMini {
  about: string;
  followers_count: number;
  is_following: boolean;
  reason: string | null;
}

export interface Profile extends UserMini {
  first_name: string;
  last_name: string;
  cover: string | null;
  about: string;
  city: string;
  country: string;
  gender: string;
  phone: string | null;
  email: string | null;
  date_joined: string;
  followers_count: number;
  following_count: number;
  posts_count: number;
  is_following: boolean;
  follows_you: boolean;
  is_me: boolean;
  is_staff: boolean;
}

export type Difficulty = "" | "easy" | "medium" | "hard";

export interface Media {
  id: number;
  url: string;
}

export interface Post {
  id: number;
  author: UserMini;
  body: string;
  title: string;
  cuisine: string;
  difficulty: Difficulty;
  cook_time: number | null;
  servings: number | null;
  ingredients: string[];
  steps: string[];
  is_recipe: boolean;
  tags: string[];
  images: Media[];
  videos: Media[];
  created_at: string;
  updated_at: string | null;
  likes_count: number;
  comments_count: number;
  liked: boolean;
  saved: boolean;
  is_owner: boolean;
  reason: string | null;
}

export interface Comment {
  id: number;
  author: UserMini;
  content: string;
  created_at: string;
  is_owner: boolean;
}

export interface Paginated<T> {
  count: number;
  next_page: number | null;
  results: T[];
}

export interface Notification {
  id: number;
  type: "like" | "comment" | "follow" | "other";
  actor: UserMini;
  post: { id: number; title: string; thumbnail: string | null } | null;
  created_at: string;
  is_seen: boolean;
}

export interface Conversation {
  user: UserMini;
  last_message: string;
  last_is_mine: boolean;
  updated_at: string;
  unread: number;
}

export interface Message {
  id: number;
  body: string;
  created_at: string;
  is_mine: boolean;
  is_read: boolean;
}

export interface Thread {
  user: UserMini;
  messages: Message[];
}

export interface CookResult {
  post: Post;
  score: number;
  matched: string[];
  missing: string[];
}

export interface CookResponse {
  ingredients: string[];
  staples: string[];
  count: number;
  results: CookResult[];
}

/** One ingredient the fridge scan thinks it saw, for the user to confirm. */
export interface ScanItem {
  raw: string;
  name: string;
  confidence: number;
  state: "raw" | "cooked" | "leftover" | "packaged" | "unknown";
  source: "visible" | "label" | "inferred";
  needs_confirm: boolean;
}

export interface ScanResponse {
  proposed: ScanItem[];
  rejected: { raw: string; reason: string }[];
  warnings: string[];
}

/** What this server's AI can do (`GET /api/ai/`). */
export interface AIStatus {
  enabled: boolean;
  provider: "gemini" | "openai" | null;
  model: string | null;
  /** Whether the model watches videos itself; if not, the app sends frames picked from them. */
  video: boolean;
  max_images: number;
  max_frames: number;
  max_video_mb: number;
  /** Sous-chef's account, to chat with. */
  assistant: UserMini | null;
}

/** A post or recipe the AI drafted for the composer. Nothing is published until the user posts it. */
export interface PostDraft {
  kind: "post" | "recipe";
  title: string;
  body: string;
  cuisine: string;
  difficulty: Difficulty;
  cook_time: number | null;
  servings: number | null;
  ingredients: string[];
  steps: string[];
  tags: string[];
  /** What the AI guessed, for the cook to check. */
  notes: string[];
}

export interface TagCount {
  name: string;
  count: number;
}

export interface Badges {
  notifications: number;
  messages: number;
}

export interface Stats {
  cooks: number;
  recipes: number;
  posts: number;
  cuisines: number;
}

export interface SearchResults {
  query: string;
  users: UserCard[];
  posts: Post[];
  tags: TagCount[];
}

export interface ReactionState {
  liked: boolean;
  saved: boolean;
  likes_count: number;
}
