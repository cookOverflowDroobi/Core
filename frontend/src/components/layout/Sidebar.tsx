import { Ellipsis, LogOut, Monitor, Moon, Plus, Search, Settings, Sun, UserRound } from "lucide-react";
import { NavLink, useNavigate } from "react-router";
import { useBadges, useCurrentUser } from "@/lib/queries";
import { shoppingStore } from "@/lib/shopping";
import { setTheme, themeStore } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { useComposer } from "../composer/context";
import { Logo } from "../Logo";
import { Avatar } from "../ui/Avatar";
import { Menu } from "../ui/misc";
import { NAV_ITEMS, type NavItem } from "./nav";
import { useLogout } from "./useLogout";

export function useBadgeCount() {
  const { data } = useBadges();
  const shopping = shoppingStore.use().filter((item) => !item.checked).length;
  return (badge?: NavItem["badge"]) =>
    badge === "shopping" ? shopping : badge ? (data?.[badge] ?? 0) : 0;
}

export function Badge({ count, className }: { count: number; className?: string }) {
  if (!count) return null;
  return (
    <span
      className={cn(
        "grid min-w-5 place-items-center rounded-full bg-brand px-1.5 text-[11px] font-bold leading-5 text-on-brand",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

const THEMES = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

export function Sidebar({ onSearch }: { onSearch: () => void }) {
  const me = useCurrentUser();
  const count = useBadgeCount();
  const composer = useComposer();
  const navigate = useNavigate();
  const logout = useLogout();
  const theme = themeStore.use();
  const nextTheme = THEMES[(THEMES.findIndex((t) => t.value === theme) + 1) % THEMES.length];

  return (
    <aside className="sticky top-0 hidden h-dvh w-20 shrink-0 flex-col border-r border-line px-3 py-5 md:flex lg:w-64 lg:px-4">
      <NavLink to="/" className="mb-6 px-2" aria-label="cookOverflow home">
        <Logo className="hidden lg:inline-flex" />
        <Logo compact className="lg:hidden" />
      </NavLink>

      <button
        type="button"
        onClick={onSearch}
        className="mb-3 flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink-3 transition-colors hover:border-ink-3 max-lg:justify-center"
        aria-label="Search (Ctrl+K)"
      >
        <Search className="size-5 shrink-0" aria-hidden />
        <span className="hidden flex-1 text-left lg:inline">Search</span>
        <kbd className="hidden rounded-md border border-line px-1.5 text-[11px] font-medium lg:inline">Ctrl K</kbd>
      </button>

      <nav aria-label="Main" className="flex flex-col gap-0.5">
        {NAV_ITEMS.map(({ to, label, icon: Icon, badge, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            title={label}
            className={({ isActive }) =>
              cn(
                "group relative flex items-center gap-3.5 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors max-lg:justify-center",
                isActive ? "bg-brand-soft font-semibold text-brand" : "text-ink-2 hover:bg-subtle hover:text-ink",
              )
            }
          >
            <Icon className="size-[22px] shrink-0" aria-hidden />
            <span className="hidden flex-1 lg:inline">{label}</span>
            <Badge count={count(badge)} className="max-lg:absolute max-lg:right-1.5 max-lg:top-1" />
          </NavLink>
        ))}
        <NavLink
          to={`/u/${me.username}`}
          title="Profile"
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3.5 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors max-lg:justify-center",
              isActive ? "bg-brand-soft font-semibold text-brand" : "text-ink-2 hover:bg-subtle hover:text-ink",
            )
          }
        >
          <UserRound className="size-[22px] shrink-0" aria-hidden />
          <span className="hidden lg:inline">Profile</span>
        </NavLink>
      </nav>

      <button
        type="button"
        onClick={() => composer.open()}
        className="mt-5 flex h-12 items-center justify-center gap-2 rounded-full bg-brand font-semibold text-on-brand shadow-sm transition hover:brightness-110 active:scale-[0.98]"
        title="Create (N)"
      >
        <Plus className="size-5" aria-hidden />
        <span className="hidden lg:inline">Create</span>
      </button>

      <div className="mt-auto flex items-center gap-3 rounded-2xl p-2 max-lg:flex-col">
        <NavLink to={`/u/${me.username}`} className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar user={me} />
          <span className="hidden min-w-0 lg:block">
            <span className="block truncate text-sm font-semibold">{me.full_name}</span>
            <span className="block truncate text-xs text-ink-3">@{me.username}</span>
          </span>
        </NavLink>
        <Menu
          label="Account menu"
          trigger={<Ellipsis className="size-5" />}
          items={[
            { label: "Settings", icon: Settings, onSelect: () => navigate("/settings") },
            { label: `Theme: ${nextTheme.label}`, icon: nextTheme.icon, onSelect: () => setTheme(nextTheme.value) },
            { label: "Sign out", icon: LogOut, onSelect: logout, danger: true },
          ]}
        />
      </div>
    </aside>
  );
}
