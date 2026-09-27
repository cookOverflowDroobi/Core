import { Check, ClipboardCopy, CookingPot, Plus, ShoppingBasket, Trash2, X } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { useDocumentTitle } from "@/hooks";
import {
  addToShoppingList, clearCheckedItems, removeShoppingItem, shoppingListText, shoppingStore, toggleShoppingItem,
  type ShoppingItem,
} from "@/lib/shopping";
import { cn, copyText } from "@/lib/utils";

export default function Shopping() {
  useDocumentTitle("Shopping list");
  const items = shoppingStore.use();
  const [text, setText] = useState("");
  const toBuy = items.filter((i) => !i.checked);
  const bought = items.filter((i) => i.checked);

  const add = (event: FormEvent) => {
    event.preventDefault();
    if (addToShoppingList(text.split(",")) === 0 && text.trim()) toast.info("That's already on your list");
    setText("");
  };

  const copy = async () => {
    if (await copyText(shoppingListText(items))) toast.success("List copied. Paste it anywhere.");
  };

  return (
    <div>
      <PageHeader
        title="Shopping list"
        icon={ShoppingBasket}
        description="Missing ingredients from recipes land here. Saved on this device."
        actions={
          toBuy.length > 0 && (
            <Button variant="outline" size="sm" onClick={copy}>
              <ClipboardCopy className="size-4" aria-hidden /> Copy
            </Button>
          )
        }
      />

      <form onSubmit={add} className="mb-5 flex gap-2">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add an item, e.g. lemons" aria-label="Add an item" />
        <Button type="submit" disabled={!text.trim()}>
          <Plus className="size-4" aria-hidden /> Add
        </Button>
      </form>

      {!items.length ? (
        <div className="card">
          <EmptyState icon={ShoppingBasket} title="Your list is empty" action={<ButtonLink to="/cook" variant="soft"><CookingPot className="size-4" /> What can I cook?</ButtonLink>}>
            Find a recipe and tap “Add missing to list”, or add items yourself above.
          </EmptyState>
        </div>
      ) : (
        <div className="space-y-5">
          <ItemList title={`To buy (${toBuy.length})`} items={toBuy} />
          {bought.length > 0 && (
            <div>
              <div className="mb-2 flex items-center justify-between px-1">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3">In the basket ({bought.length})</h2>
                <Button variant="ghost" size="sm" onClick={clearCheckedItems}>
                  <Trash2 className="size-4" aria-hidden /> Clear
                </Button>
              </div>
              <ItemList items={bought} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ItemList({ title, items }: { title?: string; items: ShoppingItem[] }) {
  if (!items.length) return title ? <p className="px-1 text-sm text-herb">Everything's in the basket. Happy cooking!</p> : null;
  return (
    <div>
      {title && <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-ink-3">{title}</h2>}
      <ul className="card divide-y divide-line overflow-hidden">
        {items.map((item) => (
          <li key={item.id} className="group flex items-center gap-3 px-4 py-3">
            <button
              type="button"
              onClick={() => toggleShoppingItem(item.id)}
              className={cn(
                "grid size-6 shrink-0 place-items-center rounded-full border-2 transition-colors",
                item.checked ? "border-herb bg-herb text-white" : "border-line hover:border-herb",
              )}
              aria-label={item.checked ? `Put ${item.name} back on the list` : `Mark ${item.name} as bought`}
              aria-pressed={item.checked}
            >
              {item.checked && <Check className="size-4" />}
            </button>
            <span className="min-w-0 flex-1">
              <span className={cn("block text-[15px] font-medium", item.checked && "text-ink-3 line-through")}>{item.name}</span>
              {item.recipe && (
                <Link to={`/posts/${item.recipe.id}`} className="block truncate text-xs text-ink-3 hover:text-brand hover:underline">
                  for {item.recipe.title}
                </Link>
              )}
            </span>
            <button
              type="button"
              onClick={() => removeShoppingItem(item.id)}
              className="rounded-full p-1.5 text-ink-3 opacity-0 hover:bg-subtle hover:text-danger focus:opacity-100 group-hover:opacity-100"
              aria-label={`Remove ${item.name}`}
            >
              <X className="size-4" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
