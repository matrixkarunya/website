"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, MotionConfig, motion, type Variants } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, LayoutGrid, Plus, X, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface NavItem {
  name: string;
  url: string;
  icon: LucideIcon;
  /** "bar" = shown in the pill, "more" = shown in the More modal. Defaults to "bar". */
  placement?: "bar" | "more";
  /** Short line shown under the name in the More modal. */
  description?: string;
}

interface NavBarProps {
  items: NavItem[];
  className?: string;
}

const gridVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.14 } },
};

const tileVariants: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.96, filter: "blur(6px)" },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: { type: "spring", stiffness: 320, damping: 26 },
  },
};

/* ───────────── Path helpers (case-insensitive, trailing-slash tolerant) ───────────── */

const normalize = (p: string) => {
  const x = p.toLowerCase().replace(/\/+$/, "");
  return x === "" ? "/" : x;
};

// "/" and "/Home" are the same page
const isHomePath = (p: string) => {
  const n = normalize(p);
  return n === "/" || n === "/home";
};

/* ───────────── Smooth-scroll helpers (don't rely on native smooth scrolling) ───────────── */

type Scroller = Window | HTMLElement;

const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const isScrollable = (node: HTMLElement) => {
  const { overflowY } = getComputedStyle(node);
  return /(auto|scroll|overlay)/.test(overflowY) && node.scrollHeight > node.clientHeight + 1;
};

// The element that actually scrolls: a scrollable ancestor, otherwise the window
const findScroller = (el: HTMLElement | null): Scroller => {
  let node = el?.parentElement ?? null;
  while (node && node !== document.documentElement) {
    if (isScrollable(node)) return node;
    node = node.parentElement;
  }
  return window;
};

const getScrollTop = (s: Scroller) =>
  s === window ? window.scrollY : (s as HTMLElement).scrollTop;

const getMaxScroll = (s: Scroller) =>
  s === window
    ? document.documentElement.scrollHeight - window.innerHeight
    : (s as HTMLElement).scrollHeight - (s as HTMLElement).clientHeight;

const getTargetTop = (s: Scroller, el: HTMLElement) => {
  const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
  const rect = el.getBoundingClientRect();
  if (s === window) return rect.top + window.scrollY - margin;
  const container = s as HTMLElement;
  return rect.top - container.getBoundingClientRect().top + container.scrollTop - margin;
};

// "instant" overrides any CSS scroll-behavior so our animation isn't fought by the browser
const setScrollTop = (s: Scroller, top: number) => {
  const options = { top, behavior: "instant" as ScrollBehavior };
  if (s === window) window.scrollTo(options);
  else (s as HTMLElement).scrollTo(options);
};

const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/** Animates the scroll position. Returns a function that cancels it. */
function animateScroll(s: Scroller, to: number): () => void {
  const from = getScrollTop(s);
  const target = Math.max(0, Math.min(to, getMaxScroll(s)));
  const distance = target - from;
  if (Math.abs(distance) < 2) return () => {};

  if (prefersReducedMotion()) {
    setScrollTop(s, target);
    return () => {};
  }

  const duration = Math.min(1000, Math.max(450, Math.abs(distance) * 0.35));
  const startTime = performance.now();
  const interrupts = ["wheel", "touchstart", "keydown", "mousedown"] as const;
  let raf = 0;
  let stopped = false;

  const stop = () => {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(raf);
    interrupts.forEach((evt) => window.removeEventListener(evt, stop));
  };

  const step = (now: number) => {
    if (stopped) return;
    const progress = Math.min(1, (now - startTime) / duration);
    setScrollTop(s, from + distance * easeInOutCubic(progress));
    if (progress < 1) raf = requestAnimationFrame(step);
    else stop();
  };

  // The user taking over (wheel, touch, key press) cancels the animation
  interrupts.forEach((evt) => window.addEventListener(evt, stop, { passive: true }));
  raf = requestAnimationFrame(step);
  return stop;
}

export function NavBar({ items, className }: NavBarProps) {
  const pathname = usePathname() ?? "/";
  const [isMobile, setIsMobile] = useState(false);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  // A scroll that should run once the modal has fully closed
  const pendingScroll = useRef<(() => void) | null>(null);
  const cancelScroll = useRef<(() => void) | null>(null);

  const barItems = items.filter((i) => (i.placement ?? "bar") === "bar");
  const moreItems = items.filter((i) => i.placement === "more");

  // Which nav item is "current" (section links like "/Home#about" never count as a page)
  const matches = (item: NavItem) => {
    if (item.url.includes("#")) return false;
    if (isHomePath(item.url) && isHomePath(pathname)) return true;
    const target = normalize(item.url);
    const current = normalize(pathname);
    if (target === current) return true;
    if (target !== "/" && current.startsWith(target + "/")) return true;
    return false;
  };

  // Exact match first, then nested routes, fall back to the first item
  const activeItem = items.find(matches) || items[0];
  const activeTab = activeItem.name;
  const moreActive = moreItems.some((i) => i.name === activeTab);

  useEffect(() => setMounted(true), []);

  // Mobile = below 768px
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const runPendingScroll = useCallback(() => {
    const run = pendingScroll.current;
    pendingScroll.current = null;
    if (run) requestAnimationFrame(run);
  }, []);

  const isSamePage = (targetPath: string) =>
    normalize(targetPath) === normalize(pathname) ||
    (isHomePath(targetPath) && isHomePath(pathname));

  // Same-page links scroll smoothly instead of jumping:
  //  - "/Home#about", "/Home#timeline" while on the home page → smooth scroll to that section
  //  - Home while already on the home page → smooth scroll to the top
  // Links to other pages are left to Next.js.
   // Same-page links scroll smoothly instead of jumping:
  //  - "/Home#about", "/Home#timeline" while on the home page → smooth scroll to that section
  //  - Home while already on the home page → smooth scroll to the top
  // Links to other pages are left to Next.js.
  const handleNavClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    item: NavItem,
    fromModal = false
  ) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
      return;
    }
    const [rawPath, hash] = item.url.split("#");
    const targetPath = rawPath || "/";
    if (!isSamePage(targetPath)) return;

    let run: () => void;
    if (hash) {
      if (!document.getElementById(hash)) {
        console.warn(`[NavBar] No element with id="${hash}" found on this page.`);
        return;
      }
      run = () => {
        const el = document.getElementById(hash);
        if (!el) return;
        const scroller = findScroller(el);
        cancelScroll.current?.();
        cancelScroll.current = animateScroll(scroller, getTargetTop(scroller, el));
        window.history.replaceState(window.history.state, "", `${pathname}#${hash}`);
      };
    } else {
      run = () => {
        const scroller = findScroller(document.querySelector("main"));
        cancelScroll.current?.();
        cancelScroll.current = animateScroll(scroller, 0);
        window.history.replaceState(window.history.state, "", pathname);
      };
    }

    e.preventDefault();

    if (fromModal) {
      // Wait until the modal has closed and the page scroll-lock is released
      pendingScroll.current = run;
      // Safety net in case the exit animation never reports completion
      window.setTimeout(runPendingScroll, 500);
    } else {
      run();
    }
  };

  // Open: put the <dialog> in the browser's top layer, then show the card
  const openMore = () => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    setOpen(true);
  };

  // Close: animate the card out; the <dialog> is closed in onExitComplete below
  const closeMore = useCallback(() => {
    setOpen(false);
  }, []);

  // Close on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Scroll lock + initial focus while open
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const raf = requestAnimationFrame(() => cardRef.current?.focus());
    return () => {
      document.body.style.overflow = prevOverflow;
      cancelAnimationFrame(raf);
    };
  }, [open]);

  const linkClasses = (active: boolean) =>
    cn(
      "relative cursor-pointer text-sm font-semibold px-4 sm:px-5 md:px-6 py-2 rounded-full transition-colors whitespace-nowrap",
      "text-foreground/80 hover:text-primary",
      active && "bg-muted text-primary"
    );

  const Lamp = () => (
    <motion.div
      layoutId="lamp"
      className="absolute inset-0 w-full bg-primary/5 rounded-full -z-10"
      initial={false}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-primary rounded-t-full">
        <div className="absolute w-12 h-6 bg-primary/20 rounded-full blur-md -top-2 -left-2" />
        <div className="absolute w-8 h-6 bg-primary/20 rounded-full blur-md -top-1" />
        <div className="absolute w-4 h-4 bg-primary/20 rounded-full blur-sm top-0 left-2" />
      </div>
    </motion.div>
  );

  return (
    <MotionConfig reducedMotion="user">
      {/* ───────────── The navbar: top on desktop, bottom on small screens ───────────── */}
      <div
        className={cn(
          "fixed left-1/2 -translate-x-1/2 z-50",
          isMobile ? "bottom-0" : "top-0",
          className
        )}
        style={{
          paddingTop: isMobile ? 0 : 24,
          paddingBottom: isMobile ? "max(0.75rem, env(safe-area-inset-bottom))" : 0,
        }}
      >
        <div className="flex items-center gap-1 md:gap-3 bg-background/5 border border-border backdrop-blur-lg py-1 px-1 rounded-full shadow-lg">
          {barItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.name;

            return (
              <Link
                key={item.name}
                href={item.url}
                aria-label={item.name}
                aria-current={isActive ? "page" : undefined}
                onClick={(e) => handleNavClick(e, item)}
                className={linkClasses(isActive)}
              >
                {/* Full words on big screens, icons on small screens */}
                {isMobile ? <Icon size={18} strokeWidth={2.5} /> : item.name}
                {isActive && <Lamp />}
              </Link>
            );
          })}

          {/* More button */}
          {moreItems.length > 0 && (
            <button
              type="button"
              aria-label="More"
              aria-haspopup="dialog"
              aria-expanded={open}
              onClick={() => (open ? closeMore() : openMore())}
              className={cn(linkClasses(moreActive), open && "text-primary")}
            >
              {isMobile ? (
                <LayoutGrid size={18} strokeWidth={2.5} />
              ) : (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  More
                  <Plus
                    size={14}
                    strokeWidth={3}
                    style={{
                      transition: "transform 300ms",
                      transform: open ? "rotate(45deg)" : "rotate(0deg)",
                    }}
                  />
                </span>
              )}
              {moreActive && <Lamp />}
            </button>
          )}
        </div>
      </div>

      {/* ───────────── More modal: native <dialog> in the top layer ───────────── */}
      {mounted &&
        createPortal(
          <dialog
            ref={dialogRef}
            aria-labelledby="more-title"
            // Escape: animate out ourselves instead of the instant native close
            onCancel={(e) => {
              e.preventDefault();
              closeMore();
            }}
            className="backdrop:bg-transparent"
            style={{
              position: "fixed",
              inset: 0,
              width: "100%",
              height: "100%",
              maxWidth: "none",
              maxHeight: "none",
              margin: 0,
              padding: 0,
              border: "none",
              background: "transparent",
              color: "inherit",
              overflow: "hidden",
            }}
          >
            <AnimatePresence
              onExitComplete={() => {
                dialogRef.current?.close();
                runPendingScroll();
              }}
            >
              {open && (
                <div className="fixed inset-0 flex items-center justify-center p-4">
                  {/* Backdrop */}
                  <motion.div
                    aria-hidden
                    onClick={closeMore}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="absolute inset-0 bg-black/60 backdrop-blur-md"
                  />

                  {/* Card */}
                  <motion.div
                    ref={cardRef}
                    tabIndex={-1}
                    initial={{ opacity: 0, y: 20, scale: 0.92, filter: "blur(10px)" }}
                    animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                    exit={{
                      opacity: 0,
                      y: 10,
                      scale: 0.96,
                      filter: "blur(6px)",
                      transition: { duration: 0.18 },
                    }}
                    transition={{ type: "spring", stiffness: 280, damping: 26 }}
                    style={{ maxHeight: "calc(100dvh - 2rem)" }}
                    className="relative w-full max-w-md overflow-y-auto rounded-3xl border border-border bg-background/80 shadow-2xl shadow-black/40 backdrop-blur-2xl outline-none"
                  >
                    {/* Theme glow + lamp, echoing the navbar */}
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-primary/15 to-transparent" />
                    <div className="pointer-events-none absolute left-1/2 top-0 h-1 w-16 -translate-x-1/2 rounded-b-full bg-primary">
                      <div className="absolute left-1/2 top-0 h-8 w-24 -translate-x-1/2 rounded-full bg-primary/30 blur-xl" />
                    </div>

                    {/* Header */}
                    <div className="relative flex items-start justify-between px-5 pb-3 pt-6">
                      <div>
                        <h2 id="more-title" className="text-lg font-bold tracking-tight">
                          Explore more
                        </h2>
                        <p className="text-sm text-muted-foreground">
                          Jump anywhere on Matrix
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label="Close"
                        onClick={closeMore}
                        className="rounded-full border border-border bg-muted/60 p-2 text-foreground/70 transition hover:text-primary"
                      >
                        <X size={16} strokeWidth={2.5} />
                      </button>
                    </div>

                    {/* Items */}
                    <motion.div
                      variants={gridVariants}
                      initial="hidden"
                      animate="show"
                      className="relative grid grid-cols-2 gap-2 p-3 pt-1"
                    >
                      {moreItems.map((item, index) => {
                        const Icon = item.icon;
                        const active = activeTab === item.name;
                        // An odd last tile spans the full width instead of sitting alone
                        const spanFull =
                          moreItems.length % 2 === 1 && index === moreItems.length - 1;
                        return (
                          <motion.div
                            key={item.name}
                            variants={tileVariants}
                            style={spanFull ? { gridColumn: "1 / -1" } : undefined}
                          >
                            <Link
                              href={item.url}
                              aria-current={active ? "page" : undefined}
                              onClick={(e) => {
                                handleNavClick(e, item, true);
                                closeMore();
                              }}
                              className="group relative block h-full outline-none"
                              style={{ borderRadius: 18 }}
                            >
                              {/* Hover / keyboard-focus highlight: a soft fill, no border */}
                              <span
                                aria-hidden
                                className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100"
                                style={{
                                  borderRadius: 18,
                                  background:
                                    "color-mix(in srgb, currentColor 8%, transparent)",
                                }}
                              />

                              {/* Tile content (padding is inline so a global reset can't remove it) */}
                              <span
                                style={{
                                  position: "relative",
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: 12,
                                  padding: 14,
                                }}
                              >
                                <span className="flex items-start justify-between">
                                  <span
                                    className={cn(
                                      "flex h-10 w-10 items-center justify-center rounded-xl border border-border transition-all duration-200 group-hover:-translate-y-0.5",
                                      active
                                        ? "bg-primary text-primary-foreground border-primary"
                                        : "bg-muted text-foreground/80 group-hover:text-primary"
                                    )}
                                  >
                                    <Icon size={18} strokeWidth={2.5} />
                                  </span>
                                  {active ? (
                                    <span className="mt-1 h-2 w-2 rounded-full bg-primary shadow-[0_0_10px_2px] shadow-primary/60" />
                                  ) : (
                                    <ArrowUpRight
                                      size={16}
                                      className="mt-1 -translate-x-1 translate-y-1 text-primary opacity-0 transition duration-200 group-hover:translate-x-0 group-hover:translate-y-0 group-hover:opacity-100"
                                    />
                                  )}
                                </span>

                                <span>
                                  <span className="block text-sm font-semibold text-foreground">
                                    {item.name}
                                  </span>
                                  {item.description && (
                                    <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                                      {item.description}
                                    </span>
                                  )}
                                </span>
                              </span>
                            </Link>
                          </motion.div>
                        );
                      })}
                    </motion.div>

                    {/* Hint (big screens only) */}
                    {!isMobile && (
                      <div className="relative flex items-center justify-center gap-1.5 border-t border-border/60 px-5 py-3 text-xs text-muted-foreground">
                        Press
                        <kbd className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-sans text-[10px] font-semibold">
                          Esc
                        </kbd>
                        to close
                      </div>
                    )}
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </dialog>,
          document.body
        )}
    </MotionConfig>
  );
}