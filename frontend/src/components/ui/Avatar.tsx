import { useState } from "react";
import type { UserMini } from "@/lib/types";
import { cn, initials } from "@/lib/utils";

const sizes = {
  xs: "size-6 text-[10px]",
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-14 text-lg",
  xl: "size-28 text-3xl sm:size-32",
} as const;

// Stable, pleasant background colours for users without a photo.
const tones = ["bg-orange-200 text-orange-900", "bg-amber-200 text-amber-900", "bg-emerald-200 text-emerald-900",
  "bg-sky-200 text-sky-900", "bg-rose-200 text-rose-900", "bg-violet-200 text-violet-900"];

export function Avatar({ user, size = "md", className }: { user: UserMini; size?: keyof typeof sizes; className?: string }) {
  const [failed, setFailed] = useState(false);
  const showImage = user.avatar && !failed && !user.avatar.endsWith("/guest.png");
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold ring-1 ring-black/5",
        sizes[size],
        !showImage && tones[user.id % tones.length],
        className,
      )}
    >
      {showImage ? (
        <img src={user.avatar!} alt="" className="size-full object-cover" loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <span aria-hidden>{initials(user.full_name || user.username)}</span>
      )}
    </span>
  );
}
