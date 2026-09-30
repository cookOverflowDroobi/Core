import { Sparkles, X } from "lucide-react";
import { useId, useState } from "react";
import { errorMessage } from "@/lib/api";
import { videoFrames } from "@/lib/frames";
import { useDraftPost } from "@/lib/queries";
import type { AIStatus, PostDraft } from "@/lib/types";
import { plural } from "@/lib/utils";
import { Button } from "../ui/Button";
import { Textarea } from "../ui/Field";

const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime", "video/mpeg", "video/3gpp"]);

/** "Draft with AI": the cook's notes plus the photos and video already attached in, a draft for the form out. */
export function AIDraft({
  status,
  images,
  video,
  mode,
  current,
  onDraft,
  onClose,
}: {
  status: AIStatus;
  images: File[];
  video: File | null;
  mode: "post" | "recipe";
  current: object | null;
  onDraft: (draft: PostDraft) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const draft = useDraftPost();
  const [prompt, setPrompt] = useState("");
  const [stage, setStage] = useState<"watching" | "writing" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const photos = images.filter((file) => PHOTO_TYPES.has(file.type)).slice(0, status.max_images);
  // Send the video itself when the model can watch it; otherwise stills picked from it in the browser.
  const sendsVideo = !!video && status.video && VIDEO_TYPES.has(video.type) && video.size <= status.max_video_mb * 1024 * 1024;
  const busy = stage !== null;
  const ready = prompt.trim() || photos.length > 0 || !!video;

  const generate = async () => {
    if (busy) return;
    if (!ready) {
      setError("Describe your dish, or attach a photo or a video first.");
      return;
    }
    setError(null);
    const form = new FormData();
    form.set("prompt", prompt.trim());
    form.set("mode", mode);
    if (current) form.set("current", JSON.stringify(current));
    photos.forEach((file) => form.append("images", file));
    if (video && sendsVideo) {
      form.append("video", video);
    } else if (video) {
      setStage("watching");
      try {
        const frames = await videoFrames(video, status.max_frames);
        frames.forEach((frame) => form.append("frames", frame));
      } catch {
        /* an unreadable video: draft from the notes and photos */
      }
      if (!prompt.trim() && !photos.length && !form.has("frames")) {
        setStage(null);
        setError("Couldn't read that video here. Describe the dish instead, or add a photo.");
        return;
      }
    }
    setStage("writing");
    draft.mutate(form, {
      onSuccess: (result) => onDraft(result.draft),
      onError: (err) => setError(errorMessage(err)),
      onSettled: () => setStage(null),
    });
  };

  const attached = [photos.length ? plural(photos.length, "photo") : "", video ? "your video" : ""].filter(Boolean);
  const reader = status.provider === "gemini" ? "Google's Gemini" : "An AI model";

  return (
    <section aria-labelledby={titleId} className="animate-fade-up rounded-2xl border border-brand/25 bg-brand-soft/60 p-3.5">
      <div className="flex items-center justify-between gap-2">
        <h3 id={titleId} className="flex items-center gap-1.5 text-sm font-semibold text-brand">
          <Sparkles className="size-4" aria-hidden /> Draft with AI
        </h3>
        <button type="button" onClick={onClose} className="rounded-full p-1 text-ink-3 hover:bg-surface hover:text-ink" aria-label="Close Draft with AI">
          <X className="size-4" />
        </button>
      </div>
      <Textarea
        value={prompt}
        onChange={(e) => {
          setPrompt(e.target.value);
          setError(null);
        }}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation(); // the composer would post on Ctrl+Enter
            generate();
          }
        }}
        rows={2}
        maxLength={2000}
        autoFocus
        aria-label="Describe your dish for the AI"
        placeholder="What did you make? “Mum's lentil soup, 40 minutes, serves 4, secret is lots of cumin”"
        className="mt-2 min-h-16 bg-surface field-sizing-content"
      />
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="min-w-0 flex-1 text-xs text-ink-2">
          {attached.length
            ? `Uses your notes and ${attached.join(" and ")}${video && !sendsVideo ? " (as stills)" : ""}.`
            : "Attach photos or a video below and it'll look at those too."}
        </p>
        <Button size="sm" onClick={generate} loading={busy} disabled={!ready && !busy}>
          {!busy && <Sparkles className="size-4" aria-hidden />}
          {stage === "watching" ? "Watching your video…" : stage === "writing" ? "Writing your draft…" : "Write it for me"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-xs font-medium text-danger">
          {error}
        </p>
      )}
      <p className="mt-2 text-[11px] leading-snug text-ink-3">
        {reader} reads your notes, photos and video to write a draft. Nothing is posted until you check it and press Post.
      </p>
    </section>
  );
}

/**
 * Shown once the AI filled in the form: what it guessed, for the cook to check, and an undo. It lives inside the
 * composer because a toast can't be clicked behind a modal dialog.
 */
export function AIDrafted({ notes, onUndo, onDismiss }: { notes: string[]; onUndo: () => void; onDismiss: () => void }) {
  return (
    <div role="status" className="flex animate-fade-up gap-2.5 rounded-xl bg-subtle px-3.5 py-2.5 text-sm text-ink-2">
      <Sparkles className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-ink">Drafted with AI. Check it before you post{notes.length ? ":" : "."}</p>
        {notes.length > 0 && (
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs">
            {notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex shrink-0 items-start gap-1">
        <Button variant="ghost" size="sm" onClick={onUndo} className="h-7 px-2.5">
          Undo
        </Button>
        <button type="button" onClick={onDismiss} className="rounded-full p-1.5 text-ink-3 hover:bg-surface hover:text-ink" aria-label="Dismiss AI notes">
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
