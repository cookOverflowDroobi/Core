import {
  Bell, Bookmark, Compass, CookingPot, CornerDownLeft, FileText, Hash, House, type LucideIcon, MessageCircle,
  Moon, Plus, Search, Settings, ShoppingBasket, Sun,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useDebounce } from "@/hooks";
import { useSearch } from "@/lib/queries";
import { resolvedTheme, setTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { useComposer } from "./composer/context";
import { Avatar } from "./ui/Avatar";
import { Dialog } from "./ui/Dialog";
import { Spinner } from "./ui/misc";

interface Item {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon?: LucideIcon;
  avatar?: Parameters<typeof Avatar>[0]["user"];
  run: () => void;
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const composer = useComposer();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const debounced = useDebounce(query.trim(), 180);
  const search = useSearch(debounced);
  const list = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const items = useMemo<Item[]>(() => {
    const go = (to: string) => () => navigate(to);
    if (!debounced) {
      const dark = resolvedTheme() === "dark";
      return [
        { id: "new", group: "Actions", label: "Create a post", hint: "N", icon: Plus, run: () => composer.open() },
        { id: "new-recipe", group: "Actions", label: "Share a recipe", icon: FileText, run: () => composer.open({ mode: "recipe" }) },
        { id: "cook", group: "Actions", label: "What can I cook?", icon: CookingPot, run: go("/cook") },
        { id: "theme", group: "Actions", label: dark ? "Switch to light mode" : "Switch to dark mode", icon: dark ? Sun : Moon, run: () => setTheme(dark ? "light" : "dark") },
        { id: "home", group: "Go to", label: "Home", icon: House, run: go("/") },
        { id: "explore", group: "Go to", label: "Explore", icon: Compass, run: go("/explore") },
        { id: "notifications", group: "Go to", label: "Notifications", icon: Bell, run: go("/notifications") },
        { id: "messages", group: "Go to", label: "Messages", icon: MessageCircle, run: go("/messages") },
        { id: "saved", group: "Go to", label: "Saved", icon: Bookmark, run: go("/saved") },
        { id: "shopping", group: "Go to", label: "Shopping list", icon: ShoppingBasket, run: go("/shopping") },
        { id: "settings", group: "Go to", label: "Settings", icon: Settings, run: go("/settings") },
      ];
    }
    const data = search.data;
    return [
      { id: "all", group: "Search", label: `Search for “${debounced}”`, icon: Search, run: go(`/search?q=${encodeURIComponent(debounced)}`) },
      ...(data?.users ?? []).map((u) => ({
        id: `u${u.id}`, group: "People", label: u.full_name, hint: `@${u.username}`, avatar: u, run: go(`/u/${u.username}`),
      })),
      ...(data?.tags ?? []).map((t) => ({
        id: `t${t.name}`, group: "Tags", label: `#${t.name}`, hint: `${t.count} posts`, icon: Hash, run: go(`/tags/${t.name}`),
      })),
      ...[...(data?.posts ?? [])].slice(0, 6).sort((a, b) => Number(b.is_recipe) - Number(a.is_recipe)).map((p) => ({
        id: `p${p.id}`, group: p.is_recipe ? "Recipes" : "Posts", label: p.title || p.body.slice(0, 70),
        hint: `by ${p.author.full_name}`, icon: p.is_recipe ? CookingPot : FileText, run: go(`/posts/${p.id}`),
      })),
    ];
  }, [debounced, search.data, navigate, composer]);

  useEffect(() => setActive(0), [items]);
  useEffect(() => {
    list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const choose = (item: Item | undefined) => {
    if (!item) return;
    onClose();
    item.run();
  };

  let lastGroup = "";
  return (
    <Dialog open={open} onClose={onClose} bare label="Search and commands" className="mt-[12vh] mb-auto w-[min(100%-1rem,36rem)]">
      <div className="flex items-center gap-3 border-b border-line px-4">
        <Search className="size-5 text-ink-3" aria-hidden />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => Math.min(i + 1, items.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              choose(items[active]);
            }
          }}
          placeholder="Search recipes, people, tags… or type a command"
          className="h-14 flex-1 bg-transparent text-base placeholder:text-ink-3 focus:outline-none"
          role="combobox"
          aria-expanded
          aria-controls="palette-list"
          aria-activedescendant={items[active] ? `palette-${items[active].id}` : undefined}
        />
        {search.isFetching && <Spinner />}
        <kbd className="rounded-md border border-line px-1.5 py-0.5 text-[11px] text-ink-3">Esc</kbd>
      </div>
      <ul ref={list} id="palette-list" role="listbox" className="max-h-[55vh] overflow-y-auto p-2">
        {items.map((item, index) => {
          const header = item.group !== lastGroup ? item.group : null;
          lastGroup = item.group;
          const Icon = item.icon;
          return (
            <li key={item.id} role="presentation">
              {header && <p className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wider text-ink-3">{header}</p>}
              <div
                id={`palette-${item.id}`}
                role="option"
                aria-selected={index === active}
                data-index={index}
                onMouseMove={() => setActive(index)}
                onClick={() => choose(item)}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm",
                  index === active ? "bg-subtle text-ink" : "text-ink-2",
                )}
              >
                {item.avatar ? <Avatar user={item.avatar} size="sm" /> : Icon && <Icon className="size-5 text-ink-3" aria-hidden />}
                <span className="min-w-0 flex-1 truncate font-medium">{item.label}</span>
                {item.hint && <span className="shrink-0 text-xs text-ink-3">{item.hint}</span>}
                {index === active && <CornerDownLeft className="size-4 text-ink-3" aria-hidden />}
              </div>
            </li>
          );
        })}
        {debounced && !search.isFetching && items.length === 1 && (
          <li className="px-3 py-6 text-center text-sm text-ink-3">No matches yet. Press Enter to search everything.</li>
        )}
      </ul>
    </Dialog>
  );
}
