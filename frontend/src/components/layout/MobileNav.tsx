import { Bell, Compass, CookingPot, House, MessageCircle, Plus, Search } from "lucide-react";
import { NavLink } from "react-router";
import { useCurrentUser } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { useComposer } from "../composer/context";
import { LogoMark } from "../Logo";
import { Avatar } from "../ui/Avatar";
import { Badge, useBadgeCount } from "./Sidebar";

export function MobileTopBar({ onSearch }: { onSearch: () => void }) {
  const me = useCurrentUser();
  const count = useBadgeCount();
  return (
    <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-line bg-canvas/85 px-4 py-2.5 backdrop-blur-md md:hidden">
      <NavLink to="/" aria-label="cookOverflow home" className="mr-auto flex items-center gap-2">
        <LogoMark className="size-8" />
        <span className="font-display text-lg font-semibold">
          cook<span className="text-brand">Overflow</span>
        </span>
      </NavLink>
      <button type="button" onClick={onSearch} className="rounded-full p-2 text-ink-2 hover:bg-subtle" aria-label="Search">
        <Search className="size-5" />
      </button>
      <NavLink to="/notifications" className="relative rounded-full p-2 text-ink-2 hover:bg-subtle" aria-label="Notifications">
        <Bell className="size-5" />
        <Badge count={count("notifications")} className="absolute -right-0.5 -top-0.5" />
      </NavLink>
      <NavLink to={`/u/${me.username}`} aria-label="Your profile">
        <Avatar user={me} size="sm" />
      </NavLink>
    </header>
  );
}

export function MobileNav() {
  const count = useBadgeCount();
  const composer = useComposer();
  const item = ({ isActive }: { isActive: boolean }) =>
    cn("relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium", isActive ? "text-brand" : "text-ink-3");

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 flex items-end border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      <NavLink to="/" end className={item}>
        <House className="size-6" aria-hidden />
        Home
      </NavLink>
      <NavLink to="/explore" className={item}>
        <Compass className="size-6" aria-hidden />
        Explore
      </NavLink>
      <div className="flex flex-1 justify-center">
        <button
          type="button"
          onClick={() => composer.open()}
          className="-mt-5 grid size-14 place-items-center rounded-full bg-brand text-on-brand shadow-pop ring-4 ring-canvas active:scale-95"
          aria-label="Create"
        >
          <Plus className="size-7" />
        </button>
      </div>
      <NavLink to="/cook" className={item}>
        <CookingPot className="size-6" aria-hidden />
        Cook
      </NavLink>
      <NavLink to="/messages" className={item}>
        <MessageCircle className="size-6" aria-hidden />
        Messages
        <Badge count={count("messages")} className="absolute right-[18%] top-1" />
      </NavLink>
    </nav>
  );
}
