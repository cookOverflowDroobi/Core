import { Bookmark, CalendarDays, ChefHat, CircleAlert, Grid3x3, MapPin, MessageCircle, Pencil } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router";
import { PostFeed } from "@/components/post/PostFeed";
import { UserListDialog } from "@/components/user/UserListDialog";
import { FollowButton } from "@/components/user/UserRow";
import { Avatar } from "@/components/ui/Avatar";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState, Skeleton, Tabs } from "@/components/ui/misc";
import { useDocumentTitle } from "@/hooks";
import { ApiError } from "@/lib/api";
import { type FeedName, usePosts, useProfile } from "@/lib/queries";
import { formatCount } from "@/lib/utils";

export default function ProfilePage() {
  const { username = "" } = useParams();
  return <Profile key={username.toLowerCase()} username={username} />;
}

function Profile({ username }: { username: string }) {
  const { tab = "posts" } = useParams();
  const { data: profile, isPending, error } = useProfile(username);
  const [list, setList] = useState<"followers" | "following" | null>(null);
  useDocumentTitle(profile ? `${profile.full_name} (@${profile.username})` : undefined);

  const feed: FeedName = tab === "saved" ? "saved" : tab === "recipes" ? "recipes" : "author";
  const posts = usePosts(feed, feed === "saved" ? {} : { author: username });

  if (isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-44 rounded-2xl sm:h-56" />
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
    );
  }
  if (error || !profile) {
    const missing = error instanceof ApiError && error.status === 404;
    return (
      <div className="card">
        <EmptyState icon={CircleAlert} title={missing ? "No cook by that name" : "Couldn't load this profile"} action={<ButtonLink to="/explore">Explore cooks</ButtonLink>}>
          {missing ? `There's no @${username} here. Check the spelling?` : "Please try again in a moment."}
        </EmptyState>
      </div>
    );
  }

  const hasCover = profile.cover && !profile.cover.endsWith("/cover.png");
  const location = [profile.city, profile.country].filter(Boolean).join(", ");
  const base = `/u/${profile.username}`;
  const tabs = [
    { to: base, label: "Posts", icon: Grid3x3, end: true },
    { to: `${base}/recipes`, label: "Recipes", icon: ChefHat },
    ...(profile.is_me ? [{ to: `${base}/saved`, label: "Saved", icon: Bookmark }] : []),
  ];

  return (
    <div>
      <section className="card overflow-hidden" aria-label="Profile">
        <div className="relative h-40 bg-linear-to-br from-[#f26b1d] via-[#c8410e] to-[#6b2a0e] sm:h-52">
          {hasCover && <img src={profile.cover!} alt="" className="size-full object-cover" />}
        </div>
        <div className="px-4 pb-5 sm:px-6">
          <div className="-mt-14 flex items-end justify-between gap-3 sm:-mt-16">
            <Avatar user={profile} size="xl" className="ring-4 ring-surface" />
            <div className="flex gap-2 pb-1">
              {profile.is_me ? (
                <ButtonLink to="/settings" variant="outline">
                  <Pencil className="size-4" aria-hidden /> Edit profile
                </ButtonLink>
              ) : (
                <>
                  <ButtonLink to={`/messages/${profile.username}`} variant="outline" size="icon" aria-label={`Message ${profile.full_name}`}>
                    <MessageCircle className="size-5" />
                  </ButtonLink>
                  <FollowButton username={profile.username} following={profile.is_following} />
                </>
              )}
            </div>
          </div>

          <div className="mt-3">
            <h1 className="font-display text-2xl font-semibold tracking-tight">{profile.full_name}</h1>
            <p className="flex flex-wrap items-center gap-2 text-sm text-ink-3">
              @{profile.username}
              {profile.follows_you && <span className="rounded-md bg-subtle px-1.5 py-0.5 text-xs font-medium text-ink-2">Follows you</span>}
            </p>
            {profile.about && <p className="mt-3 max-w-prose whitespace-pre-line text-[15px] text-ink-2">{profile.about}</p>}
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-3">
              {location && (
                <li className="inline-flex items-center gap-1.5">
                  <MapPin className="size-4" aria-hidden /> {location}
                </li>
              )}
              <li className="inline-flex items-center gap-1.5">
                <CalendarDays className="size-4" aria-hidden /> Joined{" "}
                {new Date(profile.date_joined).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
              </li>
            </ul>
          </div>

          <dl className="mt-4 flex gap-6 text-sm">
            <div>
              <dt className="sr-only">Posts</dt>
              <dd>
                <strong className="text-ink">{formatCount(profile.posts_count)}</strong> <span className="text-ink-3">posts</span>
              </dd>
            </div>
            {(["followers", "following"] as const).map((kind) => (
              <div key={kind}>
                <dt className="sr-only">{kind}</dt>
                <dd>
                  <button type="button" onClick={() => setList(kind)} className="hover:underline">
                    <strong className="text-ink">{formatCount(kind === "followers" ? profile.followers_count : profile.following_count)}</strong>{" "}
                    <span className="text-ink-3">{kind}</span>
                  </button>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <Tabs items={tabs} className="my-4" />
      <PostFeed
        query={posts}
        empty={
          feed === "saved"
            ? { icon: Bookmark, title: "Nothing saved yet", body: "Tap the bookmark on any post to keep it here." }
            : feed === "recipes"
              ? { icon: ChefHat, title: "No recipes yet", body: profile.is_me ? "Share your first recipe with the community." : `${profile.first_name || profile.username} hasn't shared a recipe yet.` }
              : { icon: Grid3x3, title: "No posts yet", body: profile.is_me ? "Your posts will show up here." : "Nothing to see here yet." }
        }
      />
      <UserListDialog username={profile.username} kind={list} onClose={() => setList(null)} />
    </div>
  );
}
