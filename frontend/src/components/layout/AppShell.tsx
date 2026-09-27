import { useState } from "react";
import { Navigate, Outlet, ScrollRestoration, useLocation } from "react-router";
import { useHotkey } from "@/hooks";
import { useMe } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { CommandPalette } from "../CommandPalette";
import { ComposerProvider } from "../composer/ComposerProvider";
import { LogoMark } from "../Logo";
import { MobileNav, MobileTopBar } from "./MobileNav";
import { RightRail } from "./RightRail";
import { Sidebar } from "./Sidebar";

export function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center" role="status" aria-label="Loading cookOverflow">
      <LogoMark className="size-14 animate-pulse" />
    </div>
  );
}

/** Pages that use the full width (no right rail). */
const WIDE = ["/messages", "/cook"];

export function AppShell() {
  const { data: me, isPending } = useMe();
  const location = useLocation();
  const [searching, setSearching] = useState(false);

  useHotkey("mod+k", () => setSearching((s) => !s), !!me);
  useHotkey("/", () => setSearching(true), !!me);

  if (isPending) return <Splash />;
  if (!me) {
    const next = location.pathname + location.search;
    return <Navigate to={next === "/" ? "/login" : `/login?next=${encodeURIComponent(next)}`} replace />;
  }

  const wide = WIDE.some((path) => location.pathname.startsWith(path));
  const openSearch = () => setSearching(true);

  return (
    <ComposerProvider>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-canvas"
      >
        Skip to content
      </a>
      <MobileTopBar onSearch={openSearch} />
      <div className="mx-auto flex max-w-[88rem]">
        <Sidebar onSearch={openSearch} />
        <main
          id="main"
          className={cn(
            "min-w-0 flex-1 px-4 pb-28 pt-4 sm:px-6 md:pb-12 md:pt-6",
            !wide && "mx-auto max-w-[42rem] xl:mx-0 xl:max-w-none",
          )}
        >
          <Outlet />
        </main>
        {!wide && <RightRail onSearch={openSearch} />}
      </div>
      <MobileNav />
      <CommandPalette open={searching} onClose={() => setSearching(false)} />
      <ScrollRestoration />
    </ComposerProvider>
  );
}

/** Auth pages send signed-in users on to where they were going. */
export function PublicOnly() {
  const { data: me, isPending } = useMe();
  const location = useLocation();
  if (isPending) return <Splash />;
  if (me) {
    const next = new URLSearchParams(location.search).get("next");
    return <Navigate to={next?.startsWith("/") ? next : "/"} replace />;
  }
  return (
    <>
      <Outlet />
      <ScrollRestoration />
    </>
  );
}
