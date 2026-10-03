"use client";

import { usePathname } from "next/navigation";
import { NavBar, type NavItem } from "@/components/Navbar";
import { Footer } from "@/components/footer";
import {
  Home,
  Swords,
  UsersRound,
  Newspaper,
  Trophy,
  Info,
  Package,
  Mail,
  History,
  LucideIcon,
} from "lucide-react";

// Map icon names to components
const iconMap: Record<string, LucideIcon> = {
  Home,
  Swords,
  UsersRound,
  Newspaper,
  Trophy,
  Info,
  Package,
  Mail,
  History,
};

export type RawNavItem = {
  name: string;
  url: string;
  icon: string;
  placement?: NavItem["placement"];
  description?: string;
};

export default function LayoutClient({
  children,
  navItems,
}: {
  children: React.ReactNode;
  navItems: RawNavItem[];
}) {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith("/admin");

  // Convert icon names to components (falls back to Home so an unknown name can never crash the nav)
  const navItemsWithIcons: NavItem[] = navItems.map((item) => ({
    ...item,
    icon: iconMap[item.icon] ?? Home,
  }));

  return (
    <>
      {!isAdminRoute && <NavBar items={navItemsWithIcons} />}
      <main className={!isAdminRoute ? "pt-0 flex-1" : "flex-1"}>
        {children}
      </main>
      {!isAdminRoute && (
        // position + z-index lift this above the home page's fixed dither background,
        // so the solid colour (and the empty space below the footer) actually shows.
        <div style={{ position: "relative", zIndex: 2, backgroundColor: "#0a0a0a" }}>
          <Footer />
          {/* Phones only: empty footer space so the floating bottom bar never covers the text */}
          <div
            className="md:hidden"
            style={{ height: "calc(5.5rem + env(safe-area-inset-bottom))" }}
            aria-hidden
          />
        </div>
      )}
    </>
  );
}