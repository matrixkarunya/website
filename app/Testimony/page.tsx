"use client";

import { useState, useEffect, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Quote, X } from "lucide-react";
import Dither from "@/components/ui/Dither";

interface Testimony {
  id: string;
  name: string;
  role: string;
  quote: string;
  imageUrl?: string;
  order: number;
  createdAt: any;
}

const textShadow = "0 2px 12px rgba(0,0,0,0.85), 0 1px 3px rgba(0,0,0,1)";

// Dither is a heavy animated canvas/WebGL background. It's decorative and
// identical on every render, so it's memoized and isolated from the rest of
// the tree — nothing here ever re-renders it after first mount.
const PageBackground = memo(function PageBackground() {
  return (
    <div className="fixed inset-0 w-full h-full -z-10">
      <Dither
        waveColor={[0.32, 0.15, 1]}
        disableAnimation={false}
        enableMouseInteraction
        mouseRadius={0.3}
        colorNum={4}
        pixelSize={2}
        waveAmplitude={0.3}
        waveFrequency={3}
        waveSpeed={0.05}
      />
      <div className="absolute inset-0 bg-black/50 z-10" />
      {/* Lighter blur on small screens — backdrop-filter blur is one of the
          most expensive paint operations on mobile GPUs, and stacking it
          with the Dither canvas underneath is what makes the page feel
          sluggish on phones. */}
      <div className="absolute inset-0 backdrop-blur-sm sm:backdrop-blur-sm bg-white/[0.03] z-20" />
    </div>
  );
});

// ── Multi-paragraph renderer (used inside the modal for full quote) ──────────
function Paragraphs({
  text,
  className,
  style,
}: {
  text: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const paras = text.split("\n").filter((p) => p.trim().length > 0);
  return (
    <div className={className} style={style}>
      {paras.map((para, i) => (
        <p key={i} className={i > 0 ? "mt-2.5" : ""}>
          {para}
        </p>
      ))}
    </div>
  );
}

// ── Author row (reused in card + modal) ───────────────────────────────────────
function Author({
  testimony,
  size = "sm",
}: {
  testimony: Testimony;
  size?: "sm" | "md";
}) {
  const dim = size === "md" ? 44 : 40;
  return (
    <div className="flex items-center gap-3">
      {testimony.imageUrl ? (
        <Image
          src={testimony.imageUrl}
          alt={testimony.name}
          width={dim}
          height={dim}
          sizes={`${dim}px`}
          className="rounded-full object-cover flex-shrink-0"
          style={{
            width: dim,
            height: dim,
            outline: "2px solid rgba(255,255,255,0.22)",
            outlineOffset: "2px",
          }}
        />
      ) : (
        <div
          className="rounded-full flex items-center justify-center font-black text-white flex-shrink-0"
          style={{
            width: dim,
            height: dim,
            fontSize: size === "md" ? 16 : 14,
            background: "rgba(255,255,255,0.15)",
            border: "1.5px solid rgba(255,255,255,0.22)",
          }}
        >
          {testimony.name.charAt(0)}
        </div>
      )}
      <div>
        <p
          className={`font-bold text-white leading-tight ${
            size === "md" ? "text-sm" : "text-sm"
          }`}
          style={{ textShadow }}
        >
          {testimony.name}
        </p>
        <p
          className="text-xs leading-tight"
          style={{ color: "rgba(255,255,255,0.48)" }}
        >
          {testimony.role}
        </p>
      </div>
    </div>
  );
}

// ── Full-text Modal ────────────────────────────────────────────────────────────
function TestimonyModal({
  testimony,
  onClose,
}: {
  testimony: Testimony | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!testimony) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    // Lock background scroll while modal is open — prevents the page (and
    // its animated background) from scrolling/repainting behind the modal
    // on mobile, which is a common source of jank.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = prevOverflow;
    };
  }, [testimony, onClose]);

  return (
    <AnimatePresence>
      {testimony && (
        <motion.div
          key={`testimony-modal-${testimony.id}`}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-5"
          style={{ background: "rgba(0,0,0,0.68)", backdropFilter: "blur(8px)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
        >
          <motion.div
            className="relative w-full max-w-lg flex flex-col rounded-3xl overflow-hidden"
            style={{
              background: "rgba(20,20,30,0.55)",
              border: "1.5px solid rgba(255,255,255,0.20)",
              backdropFilter: "blur(20px)",
              boxShadow:
                "0 32px 80px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.15)",
              maxHeight: "85vh",
            }}
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top edge highlight — matches card treatment */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent pointer-events-none" />

            {/* Header */}
            <div
              className="flex items-start justify-between px-5 sm:px-6 pt-6 sm:pt-8 pb-4 flex-shrink-0"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.10)" }}
            >
              <Quote className="w-5 h-5 mt-1.5" style={{ color: "rgba(255,255,255,0.25)" }} />
              <button
                onClick={onClose}
                className="p-1.5 rounded-xl hover:bg-white/10 active:bg-white/15 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4 text-white/60" />
              </button>
            </div>

            {/* Scrollable quote body */}
            <div className="testimony-modal-scroll flex-1 overflow-y-auto px-5 sm:px-6 py-5">
              <Paragraphs
                text={testimony.quote}
                className="text-sm md:text-[15px] leading-[1.85]"
                style={{
                  color: "rgba(255,255,255,0.88)",
                  textShadow: "0 1px 8px rgba(0,0,0,0.9)",
                }}
              />
            </div>

            {/* Pinned author footer */}
            <div
              className="flex-shrink-0 px-5 sm:px-6 py-4 sm:py-5"
              style={{ borderTop: "1px solid rgba(255,255,255,0.10)" }}
            >
              <Author testimony={testimony} size="md" />
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Themed scrollbar — frosted glass to match the modal, Firefox + WebKit */}
      <style jsx global>{`
        .testimony-modal-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(255, 255, 255, 0.28) transparent;
          -webkit-overflow-scrolling: touch;
        }
        .testimony-modal-scroll::-webkit-scrollbar {
          width: 8px;
        }
        .testimony-modal-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .testimony-modal-scroll::-webkit-scrollbar-thumb {
          background-color: rgba(255, 255, 255, 0.22);
          border-radius: 999px;
          border: 2px solid transparent;
          background-clip: padding-box;
        }
        .testimony-modal-scroll::-webkit-scrollbar-thumb:hover {
          background-color: rgba(255, 255, 255, 0.38);
          background-clip: padding-box;
        }
      `}</style>
    </AnimatePresence>
  );
}

// ── Testimony Card ─────────────────────────────────────────────────────────────
const TestimonyCard = memo(function TestimonyCard({
  testimony,
  index,
  onOpen,
}: {
  testimony: Testimony;
  index: number;
  onOpen: (t: Testimony) => void;
}) {
  const CHAR_LIMIT = 165;
  const isTruncated =
    testimony.quote.length > CHAR_LIMIT || testimony.quote.includes("\n");
  const rawSlice = testimony.quote.slice(0, CHAR_LIMIT);
  const previewText = rawSlice.slice(0, rawSlice.lastIndexOf(" ") || CHAR_LIMIT);

  const handleOpen = useCallback(() => onOpen(testimony), [onOpen, testimony]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleOpen();
      }
    },
    [handleOpen]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.05, 0.3) }}
      role="button"
      tabIndex={0}
      onClick={handleOpen}
      onKeyDown={handleKeyDown}
      className="relative flex flex-col gap-4 p-5 sm:p-6 rounded-3xl group cursor-pointer select-none active:scale-[0.98]"
      style={{
        background: "rgba(255,255,255,0.10)",
        border: "1.5px solid rgba(255,255,255,0.20)",
        backdropFilter: "blur(20px)",
        boxShadow:
          "0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.15)",
        transition: "background 0.25s ease, transform 0.15s ease",
        willChange: "transform",
      }}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Top edge highlight */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent rounded-t-3xl pointer-events-none" />

      {/* Hover/active tint as a separate layer instead of animating the
          parent's `background` on every hover frame — much cheaper to
          composite, and works identically for mobile's tap/active state. */}
      <div
        className="absolute inset-0 rounded-3xl bg-white/5 opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity duration-300 pointer-events-none"
      />

      <Quote
        className="w-5 h-5 flex-shrink-0 relative"
        style={{ color: "rgba(255,255,255,0.25)" }}
      />

      <div className="flex-1 relative">
        <p
          className="text-sm md:text-[15px] leading-[1.85]"
          style={{
            color: "rgba(255,255,255,0.88)",
            textShadow: "0 1px 8px rgba(0,0,0,0.9)",
            display: "-webkit-box",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: 4,
            overflow: "hidden",
          }}
        >
          &ldquo;{isTruncated ? previewText : testimony.quote}
          {isTruncated && (
            <>
              {"… "}
              <span
                className="font-bold"
                style={{
                  color: "#ffffff",
                  textShadow,
                  textDecoration: "underline",
                  textUnderlineOffset: "3px",
                  textDecorationThickness: "1.5px",
                  whiteSpace: "nowrap",
                }}
              >
                See more
              </span>
            </>
          )}
          &rdquo;
        </p>
      </div>

      <div
        className="flex items-center gap-3 pt-3 relative"
        style={{ borderTop: "1px solid rgba(255,255,255,0.10)" }}
      >
        {testimony.imageUrl ? (
          <Image
            src={testimony.imageUrl}
            alt={testimony.name}
            width={40}
            height={40}
            sizes="40px"
            className="rounded-full object-cover flex-shrink-0"
            style={{
              width: 40,
              height: 40,
              outline: "2px solid rgba(255,255,255,0.22)",
              outlineOffset: "2px",
            }}
          />
        ) : (
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-black text-white flex-shrink-0"
            style={{
              background: "rgba(255,255,255,0.15)",
              border: "1.5px solid rgba(255,255,255,0.22)",
            }}
          >
            {testimony.name.charAt(0)}
          </div>
        )}
        <div>
          <p className="text-sm font-bold text-white" style={{ textShadow }}>
            {testimony.name}
          </p>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.48)" }}>
            {testimony.role}
          </p>
        </div>
      </div>
    </motion.div>
  );
});

export default function TestimonyPage() {
  const [testimonies, setTestimonies] = useState<Testimony[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTestimony, setActiveTestimony] = useState<Testimony | null>(null);

  useEffect(() => {
    const q = query(collection(db, "testimonies"), orderBy("order", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const data: Testimony[] = [];
      snap.forEach((doc) => data.push({ id: doc.id, ...doc.data() } as Testimony));
      setTestimonies(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleOpen = useCallback((t: Testimony) => setActiveTestimony(t), []);
  const handleClose = useCallback(() => setActiveTestimony(null), []);

  if (loading) {
    return (
      <>
        <PageBackground />
        <div className="relative min-h-screen flex items-center justify-center">
          <div className="flex items-center gap-3">
            {[0, 150, 300].map((delay) => (
              <div
                key={delay}
                className="w-2 h-2 bg-white/80 rounded-full animate-bounce"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageBackground />
      <div className="relative min-h-screen">
        <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-16">
          {/* Header */}
          <motion.div
            className="flex flex-col items-center text-center gap-3 mb-10 sm:mb-12"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <div
              className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/20 backdrop-blur-sm"
              style={{ background: "rgba(255,255,255,0.07)" }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-white/60 animate-pulse" />
              <span
                className="text-[10px] font-semibold tracking-[0.22em] uppercase"
                style={{ color: "rgba(255,255,255,0.62)", textShadow }}
              >
                What They Say
              </span>
            </div>

            <h1
              className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tight"
              style={{ color: "#ffffff", textShadow }}
            >
              Testimonies
            </h1>

            <p
              className="text-sm md:text-base max-w-md leading-relaxed px-2"
              style={{
                color: "rgba(255,255,255,0.68)",
                textShadow: "0 1px 8px rgba(0,0,0,0.95)",
              }}
            >
              Voices from our community — students, mentors, and industry
              professionals who&apos;ve been part of the MATRIX journey.
            </p>

            <div className="w-12 h-px mt-1" style={{ background: "rgba(255,255,255,0.25)" }} />
          </motion.div>

          {/* Grid */}
          {testimonies.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {testimonies.map((t, i) => (
                <TestimonyCard key={t.id} testimony={t} index={i} onOpen={handleOpen} />
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <p className="text-lg mb-2" style={{ color: "rgba(255,255,255,0.55)" }}>
                No testimonies yet
              </p>
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>
                Check back soon
              </p>
            </div>
          )}
        </main>
      </div>

      <TestimonyModal testimony={activeTestimony} onClose={handleClose} />
    </>
  );
}