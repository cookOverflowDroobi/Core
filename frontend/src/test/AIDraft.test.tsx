import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AIDraft } from "@/components/composer/AIDraft";
import { splitLinks } from "@/lib/links";
import type { AIStatus, PostDraft } from "@/lib/types";

vi.mock("@/lib/frames", () => ({
  videoFrames: vi.fn(async (_file: File, count: number) =>
    Array.from({ length: count }, (_, i) => new File(["jpeg"], `frame-${i + 1}.jpg`, { type: "image/jpeg" })),
  ),
}));

const status: AIStatus = {
  enabled: true,
  provider: "gemini",
  model: "gemini-test",
  video: true,
  max_images: 4,
  max_frames: 3,
  max_video_mb: 20,
  assistant: null,
};

const drafted: PostDraft = {
  kind: "recipe",
  title: "Shakshuka",
  body: "Sunday eggs.",
  cuisine: "palestinian",
  difficulty: "easy",
  cook_time: 25,
  servings: 2,
  ingredients: ["egg", "tomato"],
  steps: ["Simmer the tomatoes for 10 minutes."],
  tags: ["brunch"],
  notes: ["I guessed the amounts."],
};

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const photo = new File(["png"], "dish.png", { type: "image/png" });
const clip = new File(["mp4"], "pan.mp4", { type: "video/mp4" });

describe("AIDraft", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  const sent = () => fetchMock.mock.calls.at(-1)![1].body as FormData;

  beforeEach(() => {
    document.cookie = "csrftoken=test-token";
    fetchMock = vi.fn(async () => new Response(JSON.stringify({ draft: drafted }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("sends the notes, the form and the attachments, then hands back the draft", async () => {
    const user = userEvent.setup();
    const onDraft = vi.fn();
    render(
      <AIDraft status={status} images={[photo]} video={clip} mode="post" current={{ body: "Sunday eggs" }} onDraft={onDraft} onClose={() => {}} />,
      { wrapper },
    );
    expect(screen.getByText("Uses your notes and 1 photo and your video.")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Describe your dish for the AI"), "my shakshuka");
    await user.click(screen.getByRole("button", { name: "Write it for me" }));

    await vi.waitFor(() => expect(onDraft).toHaveBeenCalledWith(drafted));
    expect(fetchMock.mock.calls.at(-1)![0]).toBe("/api/ai/post-draft/");
    const form = sent();
    expect(form.get("prompt")).toBe("my shakshuka");
    expect(form.get("mode")).toBe("post");
    expect(JSON.parse(form.get("current") as string)).toEqual({ body: "Sunday eggs" });
    expect((form.getAll("images") as File[]).map((f) => f.name)).toEqual(["dish.png"]);
    expect((form.get("video") as File).name).toBe("pan.mp4");
    expect(form.getAll("frames")).toEqual([]);
  });

  it("sends stills when the model can't watch video", async () => {
    const user = userEvent.setup();
    render(
      <AIDraft status={{ ...status, provider: "openai", video: false }} images={[]} video={clip} mode="recipe" current={null} onDraft={() => {}} onClose={() => {}} />,
      { wrapper },
    );
    expect(screen.getByText("Uses your notes and your video (as stills).")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Write it for me" }));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const form = sent();
    expect(form.get("video")).toBeNull();
    expect((form.getAll("frames") as File[]).map((f) => f.name)).toEqual(["frame-1.jpg", "frame-2.jpg", "frame-3.jpg"]);
  });

  it("asks for something to work from, and shows the server's error", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ detail: "The AI couldn't answer right now.", code: "ai_failed" }), { status: 502 }),
    );
    render(<AIDraft status={status} images={[]} video={null} mode="post" current={null} onDraft={() => {}} onClose={() => {}} />, { wrapper });
    expect(screen.getByRole("button", { name: "Write it for me" })).toBeDisabled();
    await user.type(screen.getByLabelText("Describe your dish for the AI"), "soup{Control>}{Enter}{/Control}");
    expect(await screen.findByRole("alert")).toHaveTextContent("The AI couldn't answer right now.");
  });
});

describe("splitLinks", () => {
  it("links app paths and web addresses, leaving sentence punctuation out", () => {
    expect(splitLinks("Try /posts/12, or ask /u/lina_haddad.")).toEqual([
      { text: "Try " },
      { text: "/posts/12", href: "/posts/12", external: false },
      { text: ", or ask " },
      { text: "@lina_haddad", href: "/u/lina_haddad", external: false },
      { text: "." },
    ]);
    expect(splitLinks("See /cook?i=onion,red%20lentils. More at https://example.com/a.")).toEqual([
      { text: "See " },
      { text: "/cook?i=onion,red lentils", href: "/cook?i=onion,red%20lentils", external: false },
      { text: ". More at " },
      { text: "https://example.com/a", href: "https://example.com/a", external: true },
      { text: "." },
    ]);
  });

  it("leaves paths inside words and unknown paths alone", () => {
    expect(splitLinks("and/or /posts/12abc /etc/passwd")).toEqual([{ text: "and/or /posts/12abc /etc/passwd" }]);
    expect(splitLinks("#vegan is on /tags/vegan")[1]).toEqual({ text: "#vegan", href: "/tags/vegan", external: false });
  });
});
