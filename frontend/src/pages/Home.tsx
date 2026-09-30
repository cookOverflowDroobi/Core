import { ChefHat, ImagePlus, Sparkles, Users } from "lucide-react";
import { useComposer } from "@/components/composer/context";
import { PostFeed } from "@/components/post/PostFeed";
import { Avatar } from "@/components/ui/Avatar";
import { ButtonLink } from "@/components/ui/Button";
import { useDocumentTitle } from "@/hooks";
import { useAIStatus, useCurrentUser, usePosts } from "@/lib/queries";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 5) return "Late-night snack";
  if (hour < 11) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function Home() {
  useDocumentTitle("Home");
  const me = useCurrentUser();
  const composer = useComposer();
  const feed = usePosts("feed");
  const ai = useAIStatus();

  return (
    <div className="space-y-5">
      <header>
        <p className="text-sm font-medium text-ink-3">{greeting()},</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight">{me.first_name || me.username}</h1>
      </header>

      <section className="card p-4" aria-label="Create a post">
        <div className="flex items-center gap-3">
          <Avatar user={me} />
          <button
            type="button"
            onClick={() => composer.open()}
            className="h-11 flex-1 rounded-full bg-subtle px-4 text-left text-[15px] text-ink-3 transition-colors hover:bg-line/60"
          >
            What's cooking today?
          </button>
        </div>
        <div className="mt-3 flex gap-2 border-t border-line pt-3">
          <button
            type="button"
            onClick={() => composer.open({ mode: "recipe" })}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-sm font-semibold text-ink-2 hover:bg-subtle"
          >
            <ChefHat className="size-5 text-brand" aria-hidden /> Share a recipe
          </button>
          <button
            type="button"
            onClick={() => composer.open()}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-sm font-semibold text-ink-2 hover:bg-subtle"
          >
            <ImagePlus className="size-5 text-herb" aria-hidden /> Photo
          </button>
          {ai.data?.enabled && (
            <button
              type="button"
              onClick={() => composer.open({ ai: true })}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-sm font-semibold text-ink-2 hover:bg-subtle"
            >
              <Sparkles className="size-5 text-brand" aria-hidden /> Draft with AI
            </button>
          )}
        </div>
      </section>

      <PostFeed
        query={feed}
        empty={{
          icon: Users,
          title: "Your feed is hungry",
          body: "Follow a few cooks to fill it with recipes, or share your first dish.",
          action: <ButtonLink to="/explore">Find cooks to follow</ButtonLink>,
        }}
      />
    </div>
  );
}
