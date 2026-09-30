import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ChefHat, ImagePlus, MessageSquareText, Plus, Sparkles, Trash2, Video, X } from "lucide-react";
import { type DragEvent, type FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { useDebounce } from "@/hooks";
import { api, ApiError, errorMessage } from "@/lib/api";
import { useAIStatus, useCurrentUser, useSavePost } from "@/lib/queries";
import type { Difficulty, Media, Post, PostDraft } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChipInput } from "../ChipInput";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { Field, Input, Textarea, inputClass } from "../ui/Field";
import { AIDraft, AIDrafted } from "./AIDraft";
import type { ComposerOptions } from "./context";

const DRAFT_KEY = "composer-draft";
const MAX_IMAGES = 6;
const CUISINES = ["american", "chinese", "egyptian", "french", "greek", "indian", "italian", "japanese", "jordanian",
  "korean", "lebanese", "mexican", "moroccan", "nigerian", "palestinian", "spanish", "thai", "turkish", "vietnamese"];

interface Draft {
  mode: "post" | "recipe";
  body: string;
  title: string;
  cuisine: string;
  difficulty: Difficulty;
  cookTime: string;
  servings: string;
  ingredients: string[];
  steps: string[];
  tags: string[];
}

const emptyDraft: Draft = {
  mode: "post", body: "", title: "", cuisine: "", difficulty: "", cookTime: "", servings: "",
  ingredients: [], steps: [""], tags: [],
};

function fromPost(post: Post): Draft {
  return {
    mode: post.is_recipe ? "recipe" : "post",
    body: post.body,
    title: post.title,
    cuisine: post.cuisine,
    difficulty: post.difficulty,
    cookTime: post.cook_time ? String(post.cook_time) : "",
    servings: post.servings ? String(post.servings) : "",
    ingredients: post.ingredients,
    steps: post.steps.length ? post.steps : [""],
    tags: post.tags,
  };
}

function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? { ...emptyDraft, ...(JSON.parse(raw) as Partial<Draft>) } : null;
  } catch {
    return null;
  }
}

const isBlank = (d: Draft) =>
  !d.body.trim() && !d.title.trim() && !d.ingredients.length && !d.steps.some((s) => s.trim()) && !d.tags.length;

function fromAI(draft: PostDraft): Draft {
  return {
    mode: draft.kind,
    body: draft.body,
    title: draft.title,
    cuisine: draft.cuisine,
    difficulty: draft.difficulty,
    cookTime: draft.cook_time ? String(draft.cook_time) : "",
    servings: draft.servings ? String(draft.servings) : "",
    ingredients: draft.ingredients,
    steps: draft.steps.length ? draft.steps : [""],
    tags: draft.tags,
  };
}

export function Composer({ options, onClose }: { options: ComposerOptions; onClose: () => void }) {
  const me = useCurrentUser();
  const navigate = useNavigate();
  const editing = options.post;
  const save = useSavePost();
  const ai = useAIStatus();
  const canDraft = !editing && !!ai.data?.enabled;

  const [restored] = useState(() => (editing ? null : loadDraft()));
  const [draft, setDraft] = useState<Draft>(() =>
    editing ? fromPost(editing) : { ...(restored ?? emptyDraft), ...(options.mode ? { mode: options.mode } : {}) },
  );
  const [images, setImages] = useState<File[]>([]);
  const [video, setVideo] = useState<File | null>(null);
  const [existing, setExisting] = useState<Media[]>(editing?.images ?? []);
  const [removed, setRemoved] = useState<number[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dragging, setDragging] = useState(false);
  const [aiOpen, setAiOpen] = useState(!!options.ai);
  // The AI's notes on the draft it wrote, and the form as it was before, for Undo.
  const [aiDrafted, setAiDrafted] = useState<{ notes: string[]; before: Draft } | null>(null);
  const [ingredientQuery, setIngredientQuery] = useState("");
  const debouncedQuery = useDebounce(ingredientQuery, 200);

  const suggestions = useQuery({
    queryKey: ["ingredients", debouncedQuery],
    queryFn: () => api<{ name: string }[]>("/ingredients/", { query: { q: debouncedQuery, limit: 8 } }),
    enabled: draft.mode === "recipe" && debouncedQuery.trim().length > 0,
    staleTime: 60_000,
  });

  const previews = useMemo(() => images.map((file) => ({ file, url: URL.createObjectURL(file) })), [images]);
  useEffect(() => () => previews.forEach((p) => URL.revokeObjectURL(p.url)), [previews]);

  // Autosave drafts of new posts.
  useEffect(() => {
    if (editing) return;
    const id = window.setTimeout(() => {
      if (isBlank(draft)) localStorage.removeItem(DRAFT_KEY);
      else localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    }, 400);
    return () => window.clearTimeout(id);
  }, [draft, editing]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  };

  const addImages = (files: FileList | File[]) => {
    const picked = [...files].filter((f) => f.type.startsWith("image/"));
    const room = MAX_IMAGES - existing.length - images.length;
    if (picked.length > room) toast.warning(`You can attach up to ${MAX_IMAGES} photos.`);
    setImages((current) => [...current, ...picked.slice(0, Math.max(0, room))]);
    setErrors((e) => ({ ...e, images: "" }));
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    addImages(event.dataTransfer.files);
    const clip = [...event.dataTransfer.files].find((f) => f.type.startsWith("video/"));
    if (clip) setVideo(clip);
  };

  const applyAIDraft = (generated: PostDraft) => {
    setAiDrafted({ notes: generated.notes, before: draft });
    setDraft(fromAI(generated));
    setErrors({});
    setAiOpen(false);
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    const steps = draft.steps.filter((s) => s.trim());
    if (draft.mode === "recipe") {
      if (!draft.title.trim()) next.title = "Give your recipe a name.";
      if (!draft.ingredients.length) next.ingredients = "Add at least one ingredient.";
      if (!steps.length) next.steps = "Add at least one step.";
    } else if (!draft.body.trim() && !images.length && !existing.length && !video) {
      next.body = "Write something or add a photo.";
    }
    setErrors(next);
    return !Object.keys(next).length;
  };

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (!validate()) return;
    const recipe = draft.mode === "recipe";
    const form = new FormData();
    form.set("body", draft.body.trim());
    form.set("title", recipe ? draft.title.trim() : "");
    form.set("cuisine", recipe ? draft.cuisine.trim() : "");
    form.set("difficulty", recipe ? draft.difficulty : "");
    form.set("cook_time", recipe ? draft.cookTime : "");
    form.set("servings", recipe ? draft.servings : "");
    form.set("ingredients", JSON.stringify(recipe ? draft.ingredients : []));
    form.set("steps", JSON.stringify(recipe ? draft.steps.filter((s) => s.trim()) : []));
    form.set("tags", draft.tags.join(","));
    images.forEach((file) => form.append("images", file));
    if (video) form.append("videos", video);
    if (removed.length) form.set("remove_images", removed.join(","));

    save.mutate(
      { id: editing?.id, form },
      {
        onSuccess: (post) => {
          if (!editing) localStorage.removeItem(DRAFT_KEY);
          toast.success(editing ? "Post updated" : recipe ? "Recipe published!" : "Posted!", {
            action: editing ? undefined : { label: "View", onClick: () => navigate(`/posts/${post.id}`) },
          });
          onClose();
        },
        onError: (error) => {
          if (error instanceof ApiError && Object.keys(error.fields).length) setErrors(error.fields);
          toast.error(errorMessage(error));
        },
      },
    );
  };

  const recipe = draft.mode === "recipe";
  const photoCount = existing.length + images.length;

  return (
    <Dialog open onClose={onClose} bare label={editing ? "Edit post" : "Create a post"} className="w-[min(100%-1rem,42rem)]">
      <form
        onSubmit={submit}
        onKeyDown={(e) => (e.ctrlKey || e.metaKey) && e.key === "Enter" && submit(e)}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => e.currentTarget === e.target && setDragging(false)}
        onDrop={onDrop}
        className="relative flex max-h-[min(100dvh-2rem,56rem)] flex-col"
      >
        <header className="flex items-center gap-3 border-b border-line px-5 py-3.5">
          <Avatar user={me} size="sm" />
          <h2 className="font-display text-lg font-semibold">
            {editing ? "Edit post" : "Create"}
          </h2>
          {!editing && (
            <div className="ml-2 flex rounded-full bg-subtle p-1" role="radiogroup" aria-label="Post type">
              {([["post", "Post", MessageSquareText], ["recipe", "Recipe", ChefHat]] as const).map(([value, label, Icon]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={draft.mode === value}
                  onClick={() => set("mode", value)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors",
                    draft.mode === value ? "bg-surface text-ink shadow-sm" : "text-ink-3 hover:text-ink",
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  {label}
                </button>
              ))}
            </div>
          )}
          {canDraft && (
            <Button
              variant={aiOpen ? "soft" : "ghost"}
              size="sm"
              onClick={() => setAiOpen((open) => !open)}
              aria-expanded={aiOpen}
              aria-label="Draft with AI"
              className="ml-auto px-2.5 text-brand sm:px-3"
            >
              <Sparkles className="size-4" aria-hidden />
              <span className="hidden sm:inline">AI</span>
            </Button>
          )}
          <button
            type="button"
            onClick={onClose}
            className={cn("rounded-full p-1.5 text-ink-3 hover:bg-subtle hover:text-ink", !canDraft && "ml-auto")}
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {restored && !isBlank(restored) && !editing && (
            <div className="flex items-center justify-between rounded-xl bg-brand-soft px-3.5 py-2 text-sm text-brand">
              <span>We restored your unsaved draft.</span>
              <button
                type="button"
                className="font-semibold hover:underline"
                onClick={() => {
                  localStorage.removeItem(DRAFT_KEY);
                  setDraft({ ...emptyDraft, mode: draft.mode });
                }}
              >
                Start fresh
              </button>
            </div>
          )}

          {canDraft && aiOpen && (
            <AIDraft
              status={ai.data!}
              images={images}
              video={video}
              mode={draft.mode}
              current={isBlank(draft) ? null : { ...draft, steps: draft.steps.filter((s) => s.trim()) }}
              onDraft={applyAIDraft}
              onClose={() => setAiOpen(false)}
            />
          )}
          {aiDrafted && (
            <AIDrafted
              notes={aiDrafted.notes}
              onUndo={() => {
                setDraft(aiDrafted.before);
                setAiDrafted(null);
              }}
              onDismiss={() => setAiDrafted(null)}
            />
          )}

          {recipe && (
            <Field label="Recipe name" error={errors.title}>
              {(props) => (
                <Input
                  {...props}
                  value={draft.title}
                  onChange={(e) => set("title", e.target.value)}
                  maxLength={120}
                  placeholder="e.g. Grandma's maqluba"
                  className="font-display text-lg"
                  autoFocus={!aiOpen}
                />
              )}
            </Field>
          )}

          <Field label={recipe ? "Story or notes" : "What's cooking?"} error={errors.body} optional={recipe}>
            {(props) => (
              <Textarea
                {...props}
                value={draft.body}
                onChange={(e) => set("body", e.target.value)}
                maxLength={5000}
                rows={recipe ? 3 : 5}
                placeholder={recipe ? "Where is this recipe from? Any tips?" : `Share something with the kitchen, ${me.first_name || me.username}…`}
                className="field-sizing-content"
                autoFocus={!recipe && !aiOpen}
              />
            )}
          </Field>

          {recipe && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Field label="Cuisine" className="col-span-2 sm:col-span-1" optional>
                  {(props) => (
                    <>
                      <Input {...props} value={draft.cuisine} onChange={(e) => set("cuisine", e.target.value)} list="cuisines" placeholder="italian" />
                      <datalist id="cuisines">
                        {CUISINES.map((c) => (
                          <option key={c} value={c} />
                        ))}
                      </datalist>
                    </>
                  )}
                </Field>
                <Field label="Minutes" optional error={errors.cook_time}>
                  {(props) => (
                    <Input {...props} type="number" min={1} max={1440} inputMode="numeric" value={draft.cookTime} onChange={(e) => set("cookTime", e.target.value)} placeholder="45" />
                  )}
                </Field>
                <Field label="Serves" optional error={errors.servings}>
                  {(props) => (
                    <Input {...props} type="number" min={1} max={100} inputMode="numeric" value={draft.servings} onChange={(e) => set("servings", e.target.value)} placeholder="4" />
                  )}
                </Field>
                <Field label="Difficulty" className="col-span-2 sm:col-span-1" optional>
                  {(props) => (
                    <select {...props} value={draft.difficulty} onChange={(e) => set("difficulty", e.target.value as Difficulty)} className={inputClass}>
                      <option value="">—</option>
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  )}
                </Field>
              </div>

              <Field label="Ingredients" error={errors.ingredients} hint="Press Enter after each one. Paste a list to add many.">
                {(props) => (
                  <ChipInput
                    id={props.id}
                    aria-describedby={props["aria-describedby"]}
                    values={draft.ingredients}
                    onChange={(v) => set("ingredients", v)}
                    suggestions={suggestions.data?.map((s) => s.name) ?? []}
                    onQueryChange={setIngredientQuery}
                    placeholder="rice, chicken, onion…"
                    max={60}
                  />
                )}
              </Field>

              <fieldset className="space-y-2">
                <legend className="mb-1.5 text-sm font-medium">Steps</legend>
                <ol className="space-y-2">
                  {draft.steps.map((step, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-2 grid size-7 shrink-0 place-items-center rounded-full bg-ink text-xs font-bold text-canvas">
                        {i + 1}
                      </span>
                      <Textarea
                        value={step}
                        onChange={(e) => set("steps", draft.steps.map((s, j) => (j === i ? e.target.value : s)))}
                        rows={1}
                        maxLength={200}
                        aria-label={`Step ${i + 1}`}
                        placeholder={i === 0 ? "Soak the rice for 20 minutes…" : "Next…"}
                        className="field-sizing-content min-h-10 flex-1"
                      />
                      <div className="flex flex-col">
                        <button type="button" disabled={i === 0} onClick={() => set("steps", move(draft.steps, i, -1))} className="rounded p-1 text-ink-3 hover:text-ink disabled:opacity-30" aria-label={`Move step ${i + 1} up`}>
                          <ArrowUp className="size-4" />
                        </button>
                        <button type="button" disabled={i === draft.steps.length - 1} onClick={() => set("steps", move(draft.steps, i, 1))} className="rounded p-1 text-ink-3 hover:text-ink disabled:opacity-30" aria-label={`Move step ${i + 1} down`}>
                          <ArrowDown className="size-4" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => set("steps", draft.steps.length > 1 ? draft.steps.filter((_, j) => j !== i) : [""])}
                        className="mt-1.5 rounded-full p-1.5 text-ink-3 hover:bg-danger-soft hover:text-danger"
                        aria-label={`Remove step ${i + 1}`}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </li>
                  ))}
                </ol>
                {errors.steps && <p className="text-xs font-medium text-danger">{errors.steps}</p>}
                <Button variant="ghost" size="sm" onClick={() => set("steps", [...draft.steps, ""])} disabled={draft.steps.length >= 40}>
                  <Plus className="size-4" /> Add step
                </Button>
              </fieldset>
            </>
          )}

          {(photoCount > 0 || video) && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {existing.map((media) => (
                <Thumb key={media.id} url={media.url} onRemove={() => {
                  setExisting((list) => list.filter((m) => m.id !== media.id));
                  setRemoved((ids) => [...ids, media.id]);
                }} />
              ))}
              {previews.map((preview, i) => (
                <Thumb key={preview.url} url={preview.url} onRemove={() => setImages((list) => list.filter((_, j) => j !== i))} />
              ))}
              {video && (
                <div className="relative grid aspect-square place-items-center rounded-xl bg-subtle text-ink-3">
                  <Video className="size-7" aria-hidden />
                  <span className="absolute inset-x-1 bottom-1 truncate text-center text-[10px]">{video.name}</span>
                  <RemoveButton onClick={() => setVideo(null)} label="Remove video" />
                </div>
              )}
            </div>
          )}
          {errors.images && <p className="text-xs font-medium text-danger">{errors.images}</p>}

          <Field label="Tags" optional hint="Help people find it: #breakfast, #vegan…">
            {(props) => (
              <ChipInput id={props.id} aria-describedby={props["aria-describedby"]} values={draft.tags} onChange={(v) => set("tags", v.map((t) => t.toLowerCase().replace(/[^a-z0-9_]/g, "")).filter(Boolean))} placeholder="#dinner" prefix="#" max={10} />
            )}
          </Field>
        </div>

        <footer className="flex items-center gap-1 border-t border-line px-3 py-2.5">
          <label className={cn("cursor-pointer rounded-full p-2.5 text-herb hover:bg-herb-soft", photoCount >= MAX_IMAGES && "pointer-events-none opacity-40")} title="Add photos">
            <ImagePlus className="size-5" aria-hidden />
            <span className="sr-only">Add photos</span>
            <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => e.target.files && addImages(e.target.files)} />
          </label>
          <label className="cursor-pointer rounded-full p-2.5 text-brand hover:bg-brand-soft" title="Add a video">
            <Video className="size-5" aria-hidden />
            <span className="sr-only">Add a video</span>
            <input type="file" accept="video/*" className="sr-only" onChange={(e) => setVideo(e.target.files?.[0] ?? null)} />
          </label>
          <span className="ml-1 hidden text-xs text-ink-3 sm:inline">Drop photos anywhere · Ctrl+Enter to post</span>
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={save.isPending}>
              {editing ? "Save changes" : recipe ? "Publish recipe" : "Post"}
            </Button>
          </div>
        </footer>

        {dragging && (
          <div className="pointer-events-none absolute inset-2 grid place-items-center rounded-2xl border-2 border-dashed border-brand bg-brand-soft/90 text-brand">
            <p className="flex items-center gap-2 font-semibold">
              <ImagePlus className="size-6" /> Drop photos to attach
            </p>
          </div>
        )}
      </form>
    </Dialog>
  );
}

function move<T>(list: T[], index: number, delta: number): T[] {
  const next = [...list];
  const [item] = next.splice(index, 1);
  next.splice(index + delta, 0, item);
  return next;
}

function RemoveButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80" aria-label={label}>
      <X className="size-3.5" />
    </button>
  );
}

function Thumb({ url, onRemove }: { url: string; onRemove: () => void }) {
  return (
    <div className="relative aspect-square animate-fade-up overflow-hidden rounded-xl bg-subtle">
      <img src={url} alt="" className="size-full object-cover" />
      <RemoveButton onClick={onRemove} label="Remove photo" />
    </div>
  );
}
