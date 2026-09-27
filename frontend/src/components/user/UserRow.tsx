import { UserCheck, UserPlus } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { useFollow, useMe } from "@/lib/queries";
import type { UserCard } from "@/lib/types";
import { cn, plural } from "@/lib/utils";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";

export function FollowButton({
  username,
  following,
  size = "md",
  className,
}: {
  username: string;
  following: boolean;
  size?: "xs" | "sm" | "md";
  className?: string;
}) {
  const follow = useFollow();
  const [hover, setHover] = useState(false);
  return (
    <Button
      size={size === "xs" ? "sm" : size}
      variant={following ? "outline" : "primary"}
      loading={follow.isPending}
      onClick={() => follow.mutate({ username, follow: !following })}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-pressed={following}
      className={cn(size === "xs" && "h-7 px-3 text-xs", following && hover && "border-danger text-danger", className)}
    >
      {!follow.isPending && size !== "xs" && (following ? <UserCheck className="size-4" aria-hidden /> : <UserPlus className="size-4" aria-hidden />)}
      {following ? (hover ? "Unfollow" : "Following") : "Follow"}
    </Button>
  );
}

export function UserRow({ user, compact }: { user: UserCard; compact?: boolean }) {
  const { data: me } = useMe();
  const subtitle = user.reason ?? (user.about || plural(user.followers_count, "follower"));
  return (
    <div className="flex items-center gap-3">
      <Link to={`/u/${user.username}`} className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar user={user} size={compact ? "md" : "lg"} />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold hover:underline">{user.full_name}</span>
          <span className="block truncate text-xs text-ink-3">
            @{user.username}
            {!compact && ` · ${plural(user.followers_count, "follower")}`}
          </span>
          {subtitle && compact && <span className="block truncate text-xs text-ink-3">{subtitle}</span>}
          {!compact && user.about && <span className="mt-0.5 line-clamp-1 text-sm text-ink-2">{user.about}</span>}
        </span>
      </Link>
      {me && me.id !== user.id && <FollowButton username={user.username} following={user.is_following} size={compact ? "xs" : "sm"} />}
    </div>
  );
}
