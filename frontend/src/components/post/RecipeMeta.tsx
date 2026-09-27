import { Clock, Gauge, Globe2, Users } from "lucide-react";
import { Link } from "react-router";
import type { Post } from "@/lib/types";
import { cn, minutesLabel, titleCase } from "@/lib/utils";

const difficultyTone = {
  easy: "text-herb",
  medium: "text-gold",
  hard: "text-danger",
} as const;

export function RecipeMeta({ post, className }: { post: Post; className?: string }) {
  const items = [
    post.cook_time && { icon: Clock, label: minutesLabel(post.cook_time), title: "Total time" },
    post.servings && { icon: Users, label: `Serves ${post.servings}`, title: "Servings" },
    post.difficulty && {
      icon: Gauge,
      label: titleCase(post.difficulty),
      title: "Difficulty",
      tone: difficultyTone[post.difficulty],
    },
  ].filter(Boolean) as { icon: typeof Clock; label: string; title: string; tone?: string }[];

  if (!items.length && !post.cuisine) return null;
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-ink-2", className)}>
      {items.map(({ icon: Icon, label, title, tone }) => (
        <li key={title} className="inline-flex items-center gap-1.5" title={title}>
          <Icon className={cn("size-4 text-ink-3", tone)} aria-hidden />
          <span className="sr-only">{title}: </span>
          {label}
        </li>
      ))}
      {post.cuisine && (
        <li>
          <Link
            to={`/tags/${post.cuisine}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-2.5 py-0.5 font-medium text-brand hover:bg-brand/15"
          >
            <Globe2 className="size-3.5" aria-hidden />
            {titleCase(post.cuisine)}
          </Link>
        </li>
      )}
    </ul>
  );
}
