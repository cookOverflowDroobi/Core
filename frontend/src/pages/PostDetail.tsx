import { ArrowLeft, ChefHat, CircleAlert, ListChecks, ShoppingBasket, Timer } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { Comments } from "@/components/post/Comments";
import { CookMode } from "@/components/post/CookMode";
import { MediaGallery } from "@/components/post/MediaGallery";
import { PostActions } from "@/components/post/PostActions";
import { PostCardSkeleton, PostHeader } from "@/components/post/PostCard";
import { RecipeMeta } from "@/components/post/RecipeMeta";
import { Button, ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/misc";
import { useDocumentTitle } from "@/hooks";
import { ApiError } from "@/lib/api";
import { usePost } from "@/lib/queries";
import { addToShoppingList } from "@/lib/shopping";
import { findTimers } from "@/lib/timers";
import { cn, recipeIntro } from "@/lib/utils";

function useCheckedIngredients(postId: number) {
  const key = `checked-ingredients:${postId}`;
  const [checked, setChecked] = useState<Set<number>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(key) ?? "[]") as number[]);
    } catch {
      return new Set();
    }
  });
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify([...checked]));
  }, [key, checked]);
  const toggle = (index: number) =>
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  return { checked, toggle, clear: () => setChecked(new Set()) };
}

export default function PostDetailPage() {
  const id = Number(useParams().id);
  // A fresh component per post keeps per-recipe state (checked ingredients) separate.
  return <PostDetail key={id} id={id} />;
}

function PostDetail({ id }: { id: number }) {
  const navigate = useNavigate();
  const { data: post, isPending, error } = usePost(id);
  const { checked, toggle, clear } = useCheckedIngredients(id);
  const [cooking, setCooking] = useState(false);
  useDocumentTitle(post ? post.title || `${post.author.full_name}'s post` : undefined);

  const back = (
    <button
      type="button"
      onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))}
      className="mb-4 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm font-semibold text-ink-2 hover:bg-subtle"
    >
      <ArrowLeft className="size-4" aria-hidden /> Back
    </button>
  );

  if (isPending) return <>{back}<PostCardSkeleton /></>;
  if (error || !post) {
    const missing = error instanceof ApiError && error.status === 404;
    return (
      <>
        {back}
        <div className="card">
          <EmptyState icon={CircleAlert} title={missing ? "This post is gone" : "Couldn't load this post"} action={<ButtonLink to="/">Go home</ButtonLink>}>
            {missing ? "It may have been deleted by its author." : "Please try again in a moment."}
          </EmptyState>
        </div>
      </>
    );
  }

  const intro = recipeIntro(post.body, post.is_recipe);
  const unchecked = post.ingredients.filter((_, i) => !checked.has(i));

  return (
    <div>
      {back}
      <article className="card overflow-hidden">
        <PostHeader post={post} />
        <div className="space-y-3 px-4 pb-4 pt-3 sm:px-6">
          {post.is_recipe && (
            <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">{post.title}</h1>
          )}
          {post.is_recipe && <RecipeMeta post={post} />}
          {intro && <p className="whitespace-pre-line break-words text-base leading-relaxed text-ink-2">{intro}</p>}
          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-x-2">
              {post.tags.map((tag) => (
                <Link key={tag} to={`/tags/${tag}`} className="text-sm font-medium text-brand hover:underline">
                  #{tag}
                </Link>
              ))}
            </div>
          )}
        </div>

        <MediaGallery images={post.images} videos={post.videos} alt={post.title || "Post photo"} />

        {post.is_recipe && (
          <div className="grid gap-6 px-4 py-6 sm:px-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <section aria-labelledby="ingredients-title">
              <div className="mb-3 flex items-baseline justify-between">
                <h2 id="ingredients-title" className="font-display text-xl font-semibold">Ingredients</h2>
                <span className="text-xs text-ink-3">
                  {checked.size}/{post.ingredients.length} ready
                </span>
              </div>
              <ul className="space-y-0.5">
                {post.ingredients.map((item, i) => (
                  <li key={item}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-subtle">
                      <input type="checkbox" checked={checked.has(i)} onChange={() => toggle(i)} className="size-4.5 accent-[var(--color-brand)]" />
                      <span className={cn("text-[15px]", checked.has(i) && "text-ink-3 line-through")}>{item}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="soft"
                  size="sm"
                  disabled={!unchecked.length}
                  onClick={() => {
                    const added = addToShoppingList(unchecked, { id: post.id, title: post.title });
                    toast.success(added ? `Added ${added} to your shopping list` : "Already on your list", {
                      action: { label: "View", onClick: () => navigate("/shopping") },
                    });
                  }}
                >
                  <ShoppingBasket className="size-4" aria-hidden /> Add {unchecked.length || ""} to shopping list
                </Button>
                {checked.size > 0 && (
                  <Button variant="ghost" size="sm" onClick={clear}>
                    Reset
                  </Button>
                )}
              </div>
            </section>

            <section aria-labelledby="method-title">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 id="method-title" className="font-display text-xl font-semibold">Method</h2>
                {post.steps.length > 0 && (
                  <Button size="sm" onClick={() => setCooking(true)}>
                    <ChefHat className="size-4" aria-hidden /> Start cook mode
                  </Button>
                )}
              </div>
              <ol className="space-y-4">
                {post.steps.map((step, i) => (
                  <li key={i} className="flex gap-3.5">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ink text-sm font-bold text-canvas">{i + 1}</span>
                    <div className="pt-1">
                      <p className="text-[15px] leading-relaxed">{step}</p>
                      {findTimers(step).map((timer) => (
                        <span key={timer.label} className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand">
                          <Timer className="size-3" aria-hidden /> {timer.label}
                        </span>
                      ))}
                    </div>
                  </li>
                ))}
              </ol>
              {post.steps.length === 0 && (
                <p className="flex items-center gap-2 text-sm text-ink-3">
                  <ListChecks className="size-4" aria-hidden /> No steps were added to this recipe.
                </p>
              )}
            </section>
          </div>
        )}

        <div className="border-t border-line">
          <PostActions post={post} onComment={() => document.getElementById(`comment-box-${post.id}`)?.focus()} />
        </div>
        <div id="comments">
          <Comments post={post} />
        </div>
      </article>

      {cooking && <CookMode post={post} checked={checked} onToggle={toggle} onClose={() => setCooking(false)} />}
    </div>
  );
}
