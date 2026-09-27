import { beforeEach, describe, expect, it } from "vitest";
import { passwordStrength } from "@/pages/auth/AuthLayout";
import {
  addToShoppingList, clearCheckedItems, shoppingListText, shoppingStore, toggleShoppingItem,
} from "@/lib/shopping";
import { findTimers, formatClock } from "@/lib/timers";
import { dayLabel, formatCount, initials, minutesLabel, recipeIntro, timeAgo } from "@/lib/utils";

describe("findTimers", () => {
  it("detects minutes, hours and ranges", () => {
    expect(findTimers("Simmer for 40 minutes.")).toEqual([{ label: "40 min", seconds: 2400 }]);
    expect(findTimers("Smoke for 3 hours")).toEqual([{ label: "3 h", seconds: 10800 }]);
    expect(findTimers("Bake 25-30 mins until golden")).toEqual([{ label: "25–30 min", seconds: 1500 }]);
    expect(findTimers("Rest 1.5 hrs, then sear 90 seconds")).toEqual([
      { label: "1.5 h", seconds: 5400 },
      { label: "90 sec", seconds: 90 },
    ]);
  });

  it("ignores text without durations", () => {
    expect(findTimers("Serve with 2 eggs and 3 onions")).toEqual([]);
  });
});

describe("formatClock", () => {
  it("formats seconds as a clock", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(90)).toBe("1:30");
    expect(formatClock(3725)).toBe("1:02:05");
  });
});

describe("utils", () => {
  const now = new Date("2026-09-27T12:00:00Z").getTime();

  it("timeAgo is compact", () => {
    expect(timeAgo("2026-09-27T11:59:40Z", now)).toBe("just now");
    expect(timeAgo("2026-09-27T11:55:00Z", now)).toBe("5m");
    expect(timeAgo("2026-09-27T09:00:00Z", now)).toBe("3h");
    expect(timeAgo("2026-09-25T12:00:00Z", now)).toBe("2d");
  });

  it("dayLabel names recent days", () => {
    const today = new Date(2026, 8, 27, 18);
    expect(dayLabel(new Date(2026, 8, 27, 9).toISOString(), today)).toBe("Today");
    expect(dayLabel(new Date(2026, 8, 26, 23).toISOString(), today)).toBe("Yesterday");
  });

  it("formats counts, minutes and initials", () => {
    expect(formatCount(999)).toBe("999");
    expect(formatCount(1200)).toBe("1.2k");
    expect(formatCount(15_000)).toBe("15k");
    expect(minutesLabel(45)).toBe("45 min");
    expect(minutesLabel(90)).toBe("1 h 30 min");
    expect(minutesLabel(120)).toBe("2 h");
    expect(initials("Lina Haddad")).toBe("LH");
    expect(initials("  cher ")).toBe("C");
  });

  it("recipeIntro drops the plain-text recipe sections", () => {
    const body = "My knafeh!\n\nIngredients:\n- cheese\n\nSteps:\n1. Bake";
    expect(recipeIntro(body, true)).toBe("My knafeh!");
    expect(recipeIntro(body, false)).toBe(body);
  });
});

describe("shopping list", () => {
  beforeEach(() => shoppingStore.set([]));

  it("adds items once and remembers the recipe", () => {
    expect(addToShoppingList(["Eggs", "tomato"], { id: 1, title: "Shakshuka" })).toBe(2);
    expect(addToShoppingList(["eggs", "garlic"])).toBe(1);
    const items = shoppingStore.get();
    expect(items.map((i) => i.name).sort()).toEqual(["Eggs", "garlic", "tomato"]);
    expect(items.find((i) => i.name === "tomato")?.recipe).toEqual({ id: 1, title: "Shakshuka" });
  });

  it("checks off and clears bought items", () => {
    addToShoppingList(["rice", "lemons"]);
    const rice = shoppingStore.get().find((i) => i.name === "rice")!;
    toggleShoppingItem(rice.id);
    expect(shoppingListText(shoppingStore.get())).toBe("- lemons");
    clearCheckedItems();
    expect(shoppingStore.get().map((i) => i.name)).toEqual(["lemons"]);
  });

  it("persists to localStorage", () => {
    addToShoppingList(["flour"]);
    expect(JSON.parse(localStorage.getItem("shopping-list")!)[0].name).toBe("flour");
  });
});

describe("passwordStrength", () => {
  it("grows with length and variety", () => {
    expect(passwordStrength("").score).toBe(0);
    expect(passwordStrength("abc").score).toBeLessThanOrEqual(1);
    expect(passwordStrength("longerpassword").score).toBe(2);
    expect(passwordStrength("Longer-Passw0rd!").score).toBe(4);
  });
});
