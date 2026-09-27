import { Bell, Bookmark, Compass, CookingPot, House, MessageCircle, ShoppingBasket, type LucideIcon } from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: "notifications" | "messages" | "shopping";
  end?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Home", icon: House, end: true },
  { to: "/explore", label: "Explore", icon: Compass },
  { to: "/cook", label: "What can I cook?", icon: CookingPot },
  { to: "/notifications", label: "Notifications", icon: Bell, badge: "notifications" },
  { to: "/messages", label: "Messages", icon: MessageCircle, badge: "messages" },
  { to: "/saved", label: "Saved", icon: Bookmark },
  { to: "/shopping", label: "Shopping list", icon: ShoppingBasket, badge: "shopping" },
];
