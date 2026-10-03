import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import LandingLoader from "@/components/landing-loader";
import LayoutClient, { type RawNavItem } from "@/components/LayoutClient";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["200", "300", "400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-inter",
  display: "swap",
});

// Pass icon names as strings instead of components
// (LayoutClient must know every icon name used here)
// placement: "bar" (default) = shown in the pill, "more" = shown in the More modal.
// About and Our Timeline are sections on the home page, so they link to "/#id" anchors.
const navItems: RawNavItem[] = [
  { name: "Home", url: "/Home", icon: "Home" },
  { name: "Events", url: "/Events", icon: "Swords" },
  { name: "Products", url: "/products", icon: "Package" },
  { name: "Members", url: "/Team", icon: "UsersRound" },
  {
    name: "About",
    url: "/Home#about",
    icon: "Info",
    placement: "more",
    description: "Who we are",
  },
  {
    name: "Our Timeline",
    url: "/Home#timeline",
    icon: "History",
    placement: "more",
    description: "Our journey so far",
  },
  {
    name: "Hall of Fame",
    url: "/hall-of-fame",
    icon: "Trophy",
    placement: "more",
    description: "Our top achievers",
  },
  {
    name: "Testimony",
    url: "/Testimony",
    icon: "Newspaper",
    placement: "more",
    description: "Stories from our members",
  },
  {
    name: "Contact",
    url: "/contact",
    icon: "Mail",
    placement: "more",
    description: "Get in touch with us",
  },
];
export const metadata = {
  title: "Matrix - Karunya's AI/ML Student Community",
  description: "Karunya's premier AI/ML community for students and innovators. Driving innovation through learning and collaboration.",
  keywords: "Matrix, Karunya, AI, ML, Machine Learning, Artificial Intelligence, Student Community, Innovation",
  authors: [{ name: "Matrix - Karunya" }],
  icons: {
    icon: "/mll.png",
    shortcut: "/mll.png",
    apple: "/mll.png",
  },
  openGraph: {
    title: "Matrix - Karunya's AI/ML Student Community",
    description: "Karunya's premier AI/ML community for students and innovators",
    images: ["/ml-g.png"],
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Matrix - Karunya's AI/ML Student Community",
    description: "Karunya's premier AI/ML community for students and innovators",
    images: ["/ml-g.png"],
  },
  verification: {
    google: "NZgaSP7VDEzk3guDRCj60AgnwnEJy-nM4PYvf7NJtlE",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className={`${plusJakartaSans.variable} ${inter.variable} font-sans antialiased flex flex-col min-h-screen`}>
        <AuthProvider>
          <LandingLoader>
            <LayoutClient navItems={navItems}>
              {children}
            </LayoutClient>
          </LandingLoader>
        </AuthProvider>
      </body>
    </html>
  );
}