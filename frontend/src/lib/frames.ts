/**
 * Evenly spaced stills from a video, as JPEG files. For AI models that can't watch video themselves, and for clips
 * too big to upload: the video is read here in the browser, and only the stills are sent.
 */
export async function videoFrames(file: File, count: number, longEdge = 1024): Promise<File[]> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  try {
    const loaded = once(video, "loadeddata");
    video.src = url;
    await loaded;
    const { duration, videoWidth, videoHeight } = video;
    if (!Number.isFinite(duration) || duration <= 0 || !videoWidth || !videoHeight) return [];

    const scale = Math.min(1, longEdge / Math.max(videoWidth, videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(videoWidth * scale);
    canvas.height = Math.round(videoHeight * scale);
    const context = canvas.getContext("2d");
    if (!context) return [];

    const frames: File[] = [];
    for (let i = 0; i < count; i++) {
      const seeked = once(video, "seeked");
      video.currentTime = (duration * (i + 0.5)) / count;
      await seeked;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.8));
      if (blob) frames.push(new File([blob], `frame-${i + 1}.jpg`, { type: "image/jpeg" }));
    }
    return frames;
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}

function once(video: HTMLVideoElement, event: "loadeddata" | "seeked", timeout = 15_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => finish(new Error("The video took too long to read.")), timeout);
    const onEvent = () => finish();
    const onError = () => finish(new Error("This video can't be read in the browser."));
    function finish(error?: Error) {
      window.clearTimeout(timer);
      video.removeEventListener(event, onEvent);
      video.removeEventListener("error", onError);
      if (error) reject(error);
      else resolve();
    }
    video.addEventListener(event, onEvent);
    video.addEventListener("error", onError);
  });
}
