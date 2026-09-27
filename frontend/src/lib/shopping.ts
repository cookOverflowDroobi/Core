import { createStore } from "./store";

export interface ShoppingItem {
  id: string;
  name: string;
  checked: boolean;
  recipe?: { id: number; title: string };
  addedAt: number;
}

export const shoppingStore = createStore<ShoppingItem[]>("shopping-list", []);

const key = (name: string) => name.trim().toLowerCase();

/** Add ingredients, skipping ones already on the list. Returns how many were new. */
export function addToShoppingList(names: string[], recipe?: { id: number; title: string }): number {
  let added = 0;
  shoppingStore.set((items) => {
    const existing = new Set(items.filter((item) => !item.checked).map((item) => key(item.name)));
    const fresh: ShoppingItem[] = [];
    for (const name of names) {
      const k = key(name);
      if (!k || existing.has(k)) continue;
      existing.add(k);
      fresh.push({ id: `${Date.now()}-${k}`, name: name.trim(), checked: false, recipe, addedAt: Date.now() });
    }
    added = fresh.length;
    return [...fresh, ...items];
  });
  return added;
}

export function toggleShoppingItem(id: string) {
  shoppingStore.set((items) => items.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item)));
}

export function removeShoppingItem(id: string) {
  shoppingStore.set((items) => items.filter((item) => item.id !== id));
}

export function clearCheckedItems() {
  shoppingStore.set((items) => items.filter((item) => !item.checked));
}

export function shoppingListText(items: ShoppingItem[]): string {
  return items.filter((item) => !item.checked).map((item) => `- ${item.name}`).join("\n");
}
