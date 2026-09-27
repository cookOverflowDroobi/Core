import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { Media } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Dialog } from "../ui/Dialog";

export function MediaGallery({ images, videos, alt }: { images: Media[]; videos: Media[]; alt: string }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!images.length && !videos.length) return null;

  const shown = images.slice(0, 4);
  const extra = images.length - shown.length;

  return (
    <div className="space-y-1">
      {shown.length > 0 && (
        <div
          className={cn(
            "grid gap-1 overflow-hidden",
            shown.length === 1 ? "grid-cols-1" : "grid-cols-2",
            shown.length === 3 && "grid-rows-2",
          )}
        >
          {shown.map((image, i) => (
            <button
              key={image.id}
              type="button"
              onClick={() => setOpen(i)}
              className={cn(
                "group relative overflow-hidden bg-subtle",
                shown.length === 1 ? "aspect-[16/10]" : "aspect-square",
                shown.length === 3 && i === 0 && "row-span-2 aspect-auto",
              )}
              aria-label={`Open photo ${i + 1} of ${images.length}`}
            >
              <img
                src={image.url}
                alt={i === 0 ? alt : ""}
                loading="lazy"
                decoding="async"
                className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              />
              {i === shown.length - 1 && extra > 0 && (
                <span className="absolute inset-0 grid place-items-center bg-black/50 text-2xl font-semibold text-white">
                  +{extra}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      {videos.map((video) => (
        <video key={video.id} src={video.url} controls preload="metadata" className="aspect-video w-full bg-black" />
      ))}
      {open !== null && <Lightbox images={images} start={open} onClose={() => setOpen(null)} alt={alt} />}
    </div>
  );
}

function Lightbox({ images, start, onClose, alt }: { images: Media[]; start: number; onClose: () => void; alt: string }) {
  const [index, setIndex] = useState(start);
  const go = (delta: number) => setIndex((i) => (i + delta + images.length) % images.length);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") go(1);
      if (event.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <Dialog open onClose={onClose} bare label="Photo viewer" className="w-[min(100%-1rem,64rem)]">
      <div className="relative bg-black">
        <img src={images[index].url} alt={alt} className="mx-auto max-h-[85dvh] w-auto object-contain" />
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
          aria-label="Close"
        >
          <X className="size-5" />
        </button>
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
              aria-label="Previous photo"
            >
              <ChevronLeft className="size-6" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
              aria-label="Next photo"
            >
              <ChevronRight className="size-6" />
            </button>
            <p className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
              {index + 1} / {images.length}
            </p>
          </>
        )}
      </div>
    </Dialog>
  );
}
