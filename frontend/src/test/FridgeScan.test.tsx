import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ScanReview } from "@/components/FridgeScan";
import type { ScanItem, ScanResponse } from "@/lib/types";

const item = (name: string, confidence: number, extra: Partial<ScanItem> = {}): ScanItem => ({
  raw: name,
  name,
  confidence,
  state: "raw",
  source: "visible",
  needs_confirm: confidence < 0.7,
  ...extra,
});

const result: ScanResponse = {
  proposed: [item("egg", 0.95), item("tomato", 0.9), item("labneh", 0.6, { state: "packaged", source: "label" })],
  rejected: [],
  warnings: ["Bottom shelf is blocked."],
};

describe("ScanReview", () => {
  it("ticks confident finds, leaves guesses unticked and hides what you already have", () => {
    render(<ScanReview result={result} have={["Egg"]} onAdd={() => {}} onDiscard={() => {}} />);
    expect(screen.getByText("Found 2 ingredients")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /egg/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "tomato" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "labneh" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("Bottom shelf is blocked.")).toBeInTheDocument();
  });

  it("adds only the ticked ingredients", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<ScanReview result={result} have={[]} onAdd={onAdd} onDiscard={() => {}} />);
    await user.click(screen.getByRole("button", { name: "labneh" }));
    await user.click(screen.getByRole("button", { name: "egg" }));
    await user.click(screen.getByRole("button", { name: "Add 2" }));
    expect(onAdd).toHaveBeenCalledWith(["tomato", "labneh"]);
  });

  it("offers to close when nothing new was found", async () => {
    const user = userEvent.setup();
    const onDiscard = vi.fn();
    render(<ScanReview result={{ ...result, proposed: [] }} have={[]} onAdd={() => {}} onDiscard={onDiscard} />);
    expect(screen.getByText("Nothing new found")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onDiscard).toHaveBeenCalled();
  });
});
