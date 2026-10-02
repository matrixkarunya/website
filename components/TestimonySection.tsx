"use client";

import { useState, useEffect, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Quote, ArrowRight, X } from "lucide-react";

interface Testimony {
  id: string;
  name: string;
  role: string;
  quote: string;
  imageUrl?: string;
  order: number;
  createdAt: any;
}

const CHAR_LIMIT = 165;
const PREVIEW_COUNT = 8; // max cards that scroll on the home page
const VIEW_MORE_AFTER = 3; // "View More" appears when there are MORE than this many
const SECONDS_PER_CARD = 6; // keeps the marquee at a readable pace
const textShadow = "0 2px 12px rgba(0,0,0,0.85), 0 1px 3px rgba(0,0,0,1)";

// ── Section background — same recipe as About / Events / Timeline ────────────
// The page-level fixed Dither already renders behind every section, so no
// extra WebGL canvas here: just the dark tint + ONE blur layer, plus the
// radial vignette. Needs an `isolate` parent so the negative z-index layers
// stay inside the section.
const SectionBackground = memo(function SectionBackground() {
  return (
    <>
      <div aria-hidden className="absolute inset-0 w-full h-full -z-20 pointer-events-none">
        <div className="absolute inset-0 bg-black/50" />
        <div className="absolute inset-0 backdrop-blur-sm bg-white/[0.03]" />
      </div>
      <div
        aria-hidden
        className="absolute inset-0 -z-10 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.65) 100%)",
        }}
      />
    </>
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
          className="text-sm font-bold text-white leading-tight"
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
              height: "min(85vh, 34rem)",
            }}
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent pointer-events-none" />

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

            <div className="testimony-modal-scroll flex-1 min-h-0 overflow-y-auto px-5 sm:px-6 py-5">
              <Paragraphs
                text={testimony.quote}
                className="text-sm md:text-[15px] leading-[1.85]"
                style={{
                  color: "rgba(255,255,255,0.88)",
                  textShadow: "0 1px 8px rgba(0,0,0,0.9)",
                }}
              />
            </div>

            <div
              className="flex-shrink-0 px-5 sm:px-6 py-4 sm:py-5"
              style={{ borderTop: "1px solid rgba(255,255,255,0.10)" }}
            >
              <Author testimony={testimony} size="md" />
            </div>
          </motion.div>
        </motion.div>
      )}

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
  inLoop = false,
}: {
  testimony: Testimony;
  index: number;
  onOpen: (t: Testimony) => void;
  inLoop?: boolean;
}) {
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
      initial={inLoop ? undefined : { opacity: 0, y: 20 }}
      animate={inLoop ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.05, 0.3) }}
      role="button"
      tabIndex={0}
      onClick={handleOpen}
      onKeyDown={handleKeyDown}
      className={`relative flex flex-col gap-4 p-5 sm:p-6 rounded-3xl group cursor-pointer select-none active:scale-[0.98] h-[264px] sm:h-[280px] ${
        inLoop ? "flex-shrink-0 w-[280px] md:w-[320px]" : "w-full max-w-sm"
      }`}
      style={{
        background: "rgba(255,255,255,0.10)",
        border: "1.5px solid rgba(255,255,255,0.20)",
        backdropFilter: "blur(20px)",
        boxShadow:
          "0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.15)",
        transition: "background 0.25s ease, transform 0.15s ease",
        willChange: "transform",
      }}
      whileHover={inLoop ? undefined : { y: -3 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent rounded-t-3xl pointer-events-none" />
      <div className="absolute inset-0 rounded-3xl bg-white/5 opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity duration-300 pointer-events-none" />

      <Quote
        className="w-5 h-5 flex-shrink-0 relative"
        style={{ color: "rgba(255,255,255,0.25)" }}
      />

      <div className="flex-1 min-h-0 relative overflow-hidden">
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
        <div className="min-w-0">
          <p
            className="text-sm font-bold text-white truncate"
            style={{ textShadow }}
          >
            {testimony.name}
          </p>
          <p
            className="text-xs truncate"
            style={{ color: "rgba(255,255,255,0.48)" }}
          >
            {testimony.role}
          </p>
        </div>
      </div>
    </motion.div>
  );
});

// ── Main Section ──────────────────────────────────────────────────────────────
export default function TestimonySection() {
  const [testimonies, setTestimonies] = useState<Testimony[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [activeTestimony, setActiveTestimony] = useState<Testimony | null>(null);

  useEffect(() => {
    // Only the first PREVIEW_COUNT are needed on the home page. Because that is
    // always more than VIEW_MORE_AFTER, the length of this list is enough to
    // know whether "View More" should show.
    const q = query(
      collection(db, "testimonies"),
      orderBy("order", "asc"),
      limit(PREVIEW_COUNT)
    );
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

  if (loading || testimonies.length === 0) return null;

  // Static row for 1–2 testimonies (a loop with only 1–2 unique cards stutters
  // rather than flows), looped scroll for 3+.
  const isStatic = testimonies.length <= 2;
  const isLoop = !isStatic;

  // Visible whenever there are MORE than 3 testimonies (4 or more).
  const showViewMore = testimonies.length > VIEW_MORE_AFTER;

  // Duplicate enough times to fill a smooth, seamless loop even with just 3–4
  // cards. The track scrolls by exactly 1/3 of its width, so 3 copies is the
  // structural minimum regardless of source count.
  const loopItems = isLoop ? [...testimonies, ...testimonies, ...testimonies] : [];

  return (
    <section className="relative w-full isolate overflow-hidden py-12 md:py-16">
      <SectionBackground />

      <style>{`
        @keyframes testimony-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-33.333%); }
        }
        .testimony-track {
          animation: testimony-scroll 30s linear infinite;
          will-change: transform;
        }
        .testimony-track.paused {
          animation-play-state: paused;
        }
      `}</style>

      {/* ── Section header ── */}
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 md:px-10 lg:px-16 mb-8 sm:mb-10">
        <motion.div
          className="flex flex-col items-center text-center gap-3"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-8%" }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <div
            className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/20 backdrop-blur-sm w-fit"
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
          <h2
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tight"
            style={{ color: "#ffffff", textShadow }}
          >
            Testimonies
          </h2>
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
        </motion.div>
      </div>

      {/* ── Cards area ── */}
      <motion.div
        className="relative z-10 w-full"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.9, delay: 0.2 }}
      >
        {isStatic ? (
          <div className="flex flex-wrap justify-center gap-4 px-4 sm:px-6 md:px-10">
            {testimonies.map((t, i) => (
              <TestimonyCard key={t.id} testimony={t} index={i} onOpen={handleOpen} />
            ))}
          </div>
        ) : (
          <div className="relative">
            {/* Edge fades — matched to the section's dark backdrop */}
            <div
              className="absolute left-0 top-0 bottom-0 w-12 sm:w-20 md:w-32 z-10 pointer-events-none"
              style={{
                background: "linear-gradient(to right, rgba(0,0,0,0.55), transparent)",
              }}
            />
            <div
              className="absolute right-0 top-0 bottom-0 w-12 sm:w-20 md:w-32 z-10 pointer-events-none"
              style={{
                background: "linear-gradient(to left, rgba(0,0,0,0.55), transparent)",
              }}
            />
            <div
              className="overflow-hidden"
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
            >
              <div
                className={`flex gap-4 testimony-track ${isPaused ? "paused" : ""}`}
                style={{
                  animationDuration: `${testimonies.length * SECONDS_PER_CARD}s`,
                }}
              >
                {loopItems.map((t, i) => (
                  <TestimonyCard
                    key={`${t.id}-${i}`}
                    testimony={t}
                    index={i}
                    onOpen={handleOpen}
                    inLoop
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* ── View More — visible when there are more than 3 testimonies ── */}
      {showViewMore && (
        <div className="relative z-10 flex justify-center pt-10">
          <Link
            href="/Testimony"
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all group"
            style={{
              background: "rgba(255,255,255,0.10)",
              border: "1.5px solid rgba(255,255,255,0.20)",
              backdropFilter: "blur(20px)",
              color: "#ffffff",
              boxShadow:
                "0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.15)",
              textShadow,
            }}
          >
            View More
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      )}

      {/* Full-quote modal (opens when a card is clicked) */}
      <TestimonyModal testimony={activeTestimony} onClose={handleClose} />
    </section>
  );
}