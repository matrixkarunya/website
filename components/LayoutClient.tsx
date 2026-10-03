"use client";

import { usePathname } from "next/navigation";
import { NavBar } from "@/components/Navbar";
import { Footer } from "@/components/footer";
import { Home, Swords, UsersRound, Newspaper, Trophy, LucideIcon } from "lucide-react";

// Map icon names to components
const iconMap: Record<string, LucideIcon> = {
  Home,
  Swords,
  UsersRound,
  Newspaper,
  Trophy,
};

export default function LayoutClient({
  children,
  navItems,
}: {
  children: React.ReactNode;
  navItems: { name: string; url: string; icon: string }[];
}) {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith("/admin");

  // Convert icon names to components (falls back to Home so an unknown name can never crash the nav)
  const navItemsWithIcons = navItems.map((item) => ({
    ...item,
    icon: iconMap[item.icon] ?? Home,
  }));

  return (
    <>
      {!isAdminRoute && <NavBar items={navItemsWithIcons} />}
      <main className={!isAdminRoute ? "pt-0 flex-1" : "flex-1"}>
        {children}
      </main>
      {!isAdminRoute && <Footer />}
    </>
  );
}