// components/TimelineSection.tsx
"use client";

import { useRef, useState } from "react";
import {
  motion,
  useScroll,
  useSpring,
  useTransform,
  useMotionValueEvent,
  useReducedMotion,
  MotionValue,
} from "framer-motion";
import { ArrowRight } from "lucide-react";

// ───────────────────────── Content ─────────────────────────
// Edit this array to change the story. Event counts drive the live
// "events so far" counter (it adds them up as you move through the years).
const CHAPTERS = [
  {
    year: "2023",
    academicYear: "Academic Year 2023–24",
    chapter: "Chapter 01 · The Beginning",
    title: "Born as AIMS",
    body: "A small group of students came together and founded AIMS — the seed of everything that followed. Year one: 4 events.",
    events: 4,
  },
  {
    year: "2024",
    academicYear: "Academic Year 2024–25",
    chapter: "Chapter 02 · Growth",
    title: "Finding Our Rhythm",
    body: "Momentum. More workshops, more members, and a clearer sense of what the community wanted to become. 6 events.",
    events: 6,
  },
  {
    year: "2025",
    academicYear: "Academic Year 2025–26",
    chapter: "Chapter 03 · The Rebrand",
    title: "AIMS Becomes MATRIX",
    body: "Reborn as MATRIX and inaugurated on 2nd September 2025. The new identity brought our biggest year yet: 27 events.",
    events: 27,
    badge: "Rebrand",
  },
  {
    year: "2026",
    academicYear: "Academic Year 2026–27",
    chapter: "Chapter 04 · Today",
    title: "Still Accelerating",
    body: "Already 9 events into the year, and the calendar keeps filling up. The story is still being written.",
    events: 9,
  },
] as const;

// ───────────────────────── Config ─────────────────────────
const ACCENT = "#8272f0";
const PANELS = CHAPTERS.length + 1; // intro + one per year
const LAST = PANELS - 1;

// Scroll budget, measured in "panels of scroll" (1 unit = --per of page scroll)
const REST_UNITS = 0.4; // rest on 2026 before leaving
const EXIT_UNITS = 1; // scroll spent blurring out into Events
const TOTAL_UNITS = LAST + REST_UNITS + EXIT_UNITS;
const SLIDE_END = LAST / TOTAL_UNITS; // progress where the last slide lands
const EXIT_START = (LAST + REST_UNITS) / TOTAL_UNITS; // progress where blur-out begins
const HOLD = 0.3; // share of each step where a panel rests before sliding
const MAX_BLUR_PX = 22;

const textShadow = "0 2px 16px rgba(0,0,0,0.9), 0 1px 4px rgba(0,0,0,1)";

// Cumulative event counts for each panel: [0, 4, 10, 37, 46]
const COUNTS = CHAPTERS.reduce<number[]>(
  (acc, c) => [...acc, acc[acc.length - 1] + c.events],
  [0]
);

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

// Maps raw scroll progress (0..1) to a panel position (0..LAST) with a rest
// at every panel and a smoothstep slide in between.
function positionAt(p: number) {
  const q = clamp01(p / SLIDE_END);
  if (q >= 1) return LAST;
  const seg = q * LAST;
  const k = Math.floor(seg);
  const t = clamp01((seg - k - HOLD) / (1 - HOLD));
  return k + t * t * (3 - 2 * t);
}

// ───────────────────────── Pieces ─────────────────────────
function Pill({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="inline-flex w-fit items-center gap-2 sm:gap-2.5 rounded-full border px-3 py-1 sm:px-4 sm:py-1.5"
      style={{
        borderColor: "rgba(255,255,255,0.16)",
        background: "rgba(255,255,255,0.05)",
      }}
    >
      <span
        className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
        style={{ background: ACCENT }}
      />
      <span
        className="text-[9px] sm:text-[11px] font-bold tracking-[0.18em] sm:tracking-[0.22em] uppercase text-white whitespace-nowrap"
        style={{ textShadow }}
      >
        {children}
      </span>
    </div>
  );
}

function IntroPanel({ pos }: { pos: MotionValue<number> }) {
  const opacity = useTransform(pos, (v) => Math.max(0, 1 - v * 1.1));
  return (
    <div
      className="relative h-full flex-shrink-0"
      style={{ width: `${100 / PANELS}%` }}
    >
      <motion.div
        style={{ opacity }}
        className="flex h-full flex-col justify-center px-6 sm:px-10 md:px-[7%] pt-16"
      >
        <p
          className="mb-4 sm:mb-5 text-[11px] sm:text-sm tracking-[0.35em] sm:tracking-[0.4em] text-white/55"
          style={{ textShadow }}
        >
          2023 → 2026
        </p>
        <h2
          className="font-black leading-[0.95] tracking-tight text-white"
          style={{
            fontSize: "clamp(2.5rem, 12.5vw, 8rem)",
            textShadow,
          }}
        >
          From AIMS
          <br />
          to <span style={{ color: ACCENT }}>MATRIX</span>
        </h2>
        <div className="mt-6 sm:mt-8 flex items-center gap-3 sm:gap-4 text-sm sm:text-base text-white/60">
          <span>Keep scrolling</span>
          <span className="h-px w-14 sm:w-28" style={{ background: ACCENT }} />
          <ArrowRight className="h-4 w-4" />
        </div>
      </motion.div>
    </div>
  );
}

function YearPanel({
  chapter,
  index,
  pos,
}: {
  chapter: (typeof CHAPTERS)[number];
  index: number; // panel index (intro is 0)
  pos: MotionValue<number>;
}) {
  const opacity = useTransform(pos, (v) =>
    Math.max(0, 1 - Math.abs(v - index) * 1.1)
  );
  const badge = "badge" in chapter ? chapter.badge : undefined;

  return (
    <div
      className="relative h-full flex-shrink-0"
      style={{ width: `${100 / PANELS}%` }}
    >
      {/* Year */}
      <motion.h3
        className="absolute inset-x-0 text-center font-black leading-none tracking-tight text-white select-none"
        style={{
          opacity,
          bottom: "calc(100% - var(--line-y) + 1rem)",
          fontSize: "clamp(3rem, min(13vw, 17vh), 9rem)",
          textShadow,
        }}
      >
        {chapter.year}
      </motion.h3>

      {/* Dot */}
      <div
        className="absolute left-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          top: "var(--line-y)",
          background: ACCENT,
          boxShadow: `0 0 0 6px ${ACCENT}22, 0 0 28px 6px ${ACCENT}88`,
        }}
      />

      {/* Card */}
      <motion.div
        className="absolute left-1/2 -translate-x-1/2 rounded-2xl sm:rounded-3xl p-5 sm:p-6 md:p-8"
        style={{
          opacity,
          top: "calc(var(--line-y) + 1.5rem)",
          width: "min(88vw, 32rem)",
          background: "rgba(14,11,34,0.72)",
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow:
            "0 24px 60px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)",
        }}
      >
        <Pill>{chapter.chapter}</Pill>
        <h4
          className="mt-4 sm:mt-5 text-xl sm:text-2xl md:text-[1.75rem] font-black leading-tight tracking-tight text-white"
          style={{ textShadow }}
        >
          {chapter.title}
        </h4>
        <p className="mt-2 sm:mt-3 text-[13px] sm:text-sm md:text-[15px] leading-[1.65] sm:leading-[1.7] text-white/65">
          {chapter.body}
        </p>
        <div className="mt-4 sm:mt-5 flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-2.5 sm:gap-3">
            <span
              className="text-3xl sm:text-4xl font-black leading-none"
              style={{ color: ACCENT }}
            >
              {chapter.events}
            </span>
            <span className="text-[10px] sm:text-[11px] tracking-[0.22em] uppercase text-white/55">
              Events
            </span>
          </div>
          {badge && (
            <span
              className="rounded-full border px-3 py-1 sm:px-4 sm:py-1.5 text-[9px] sm:text-[11px] font-bold tracking-[0.18em] sm:tracking-[0.22em] uppercase text-white"
              style={{
                borderColor: "rgba(255,255,255,0.16)",
                background: "rgba(255,255,255,0.05)",
              }}
            >
              {badge}
            </span>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ───────────────────────── Section ─────────────────────────
export default function TimelineSection() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });
  // Spring smooths wheel/touch steps into one continuous glide
  const smooth = useSpring(scrollYProgress, {
    stiffness: 140,
    damping: 28,
    mass: 0.4,
    restDelta: 0.0005,
  });
  const progress = reduce ? scrollYProgress : smooth;

  // pos: 0 = intro, 1 = 2023, … LAST = 2026 (fractional while sliding)
  const pos = useTransform(progress, positionAt);
  const trackX = useTransform(pos, (v) => `${(-v * 100) / PANELS}%`);

  // Exit: 0 → 1 over the last stretch of scroll (blur + fade into Events)
  const exit = useTransform(progress, (p) =>
    clamp01((p - EXIT_START) / (1 - EXIT_START))
  );
  const exitFilter = useTransform(exit, (e) =>
    e <= 0.001 || reduce ? "none" : `blur(${(e * MAX_BLUR_PX).toFixed(1)}px)`
  );
  const exitOpacity = useTransform(exit, (e) => 1 - e);
  const exitScale = useTransform(exit, (e) => (reduce ? 1 : 1 - 0.035 * e));

  // Live HUD values
  const counter = useTransform(
    pos,
    Array.from({ length: PANELS }, (_, i) => i),
    COUNTS
  );
  const counterText = useTransform(counter, (v) =>
    String(Math.round(v)).padStart(2, "0")
  );
  const barFill = useTransform(pos, [0, 1, LAST], [0, 0.04, 1]);
  const baseLine = useTransform(pos, [0.4, 1], [0, 1]);
  const litLine = useTransform(pos, [1, 2], [0, 1]);
  const aimsOpacity = useTransform(pos, [0.5, 1, 2, 2.7], [0, 1, 1, 0]);
  const matrixOpacity = useTransform(pos, [2.3, 3, LAST], [0, 1, 1]);

  const [active, setActive] = useState(0);
  useMotionValueEvent(pos, "change", (v) => {
    const r = Math.round(v);
    setActive((prev) => (prev === r ? prev : r));
  });

  const ghostBase: React.CSSProperties = {
    gridArea: "1 / 1",
    color: "transparent",
    WebkitTextStroke: "1.5px rgba(255,255,255,0.14)",
    lineHeight: 1,
    letterSpacing: 0,
    textAlign: "center",
  };

  return (
    <section
      ref={ref}
      id="journey"
      aria-label="Our journey timeline"
      // --per = page scroll spent per panel (shorter on phones)
      className="relative w-full [--per:75vh] md:[--per:90vh]"
      style={{ height: `calc(var(--per) * ${TOTAL_UNITS} + 100svh)` }}
    >
      <div
        // --line-y = where the timeline line + dots sit (tuned per screen)
        className="sticky top-0 h-[100svh] w-full overflow-hidden isolate [--line-y:34%] sm:[--line-y:38%] [@media(max-height:620px)]:[--line-y:31%]"
      >
        {/* Background: same recipe as the About section (stays put while content blurs out) */}
        <div aria-hidden className="absolute inset-0 -z-20 pointer-events-none">
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

        {/* Everything below blurs + fades out as we leave for Events */}
        <motion.div
          className="absolute inset-0 will-change-[filter,opacity]"
          style={{
            filter: exitFilter,
            opacity: exitOpacity,
            scale: exitScale,
          }}
        >
          {/* Ghost outline words — one grid cell, dead-centre, no drift */}
          <div
            aria-hidden
            className="absolute inset-0 grid place-items-center overflow-hidden pointer-events-none select-none"
          >
            <motion.span
              className="font-black whitespace-nowrap"
              style={{
                ...ghostBase,
                fontSize: "min(26vw, 44vh)",
                opacity: aimsOpacity,
              }}
            >
              AIMS
            </motion.span>
            <motion.span
              className="font-black whitespace-nowrap"
              style={{
                ...ghostBase,
                fontSize: "min(20vw, 38vh)",
                opacity: matrixOpacity,
              }}
            >
              MATRIX
            </motion.span>
          </div>

          {/* Timeline line (static; the dots slide along it) */}
          <motion.div
            aria-hidden
            className="absolute inset-x-0 h-px pointer-events-none"
            style={{
              top: "var(--line-y)",
              opacity: baseLine,
              background: "rgba(255,255,255,0.14)",
            }}
          />
          <motion.div
            aria-hidden
            className="absolute left-0 h-px pointer-events-none"
            style={{
              top: "var(--line-y)",
              width: "50%",
              opacity: litLine,
              background: `linear-gradient(to right, transparent, ${ACCENT} 35%, ${ACCENT})`,
            }}
          />

          {/* Horizontal track */}
          <motion.div
            className="relative z-[2] flex h-full will-change-transform"
            style={{ width: `${PANELS * 100}%`, x: trackX }}
          >
            <IntroPanel pos={pos} />
            {CHAPTERS.map((c, i) => (
              <YearPanel key={c.year} chapter={c} index={i + 1} pos={pos} />
            ))}
          </motion.div>

          {/* HUD */}
          <div className="absolute inset-0 z-[3] pointer-events-none px-5 sm:px-6 md:px-10 lg:px-16 pt-[4.5rem] md:pt-24 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:pb-8 flex flex-col justify-between">
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-2 sm:gap-3 min-w-0">
                <Pill>Our Journey</Pill>
                <motion.p
                  key={active}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="pl-1 text-xs sm:text-sm md:text-base font-semibold text-white/65"
                  style={{ textShadow }}
                >
                  {active === 0
                    ? "2023 → 2026"
                    : CHAPTERS[active - 1].academicYear}
                </motion.p>
              </div>

              <div className="flex flex-col items-end flex-shrink-0">
                <motion.span
                  className="text-4xl sm:text-5xl md:text-6xl font-black leading-none tabular-nums"
                  style={{ color: ACCENT, textShadow }}
                >
                  {counterText}
                </motion.span>
                <span className="mt-1.5 sm:mt-2 text-[9px] sm:text-[10px] md:text-[11px] tracking-[0.25em] sm:tracking-[0.3em] uppercase text-white/55 whitespace-nowrap">
                  Events so far
                </span>
              </div>
            </div>

            {/* Progress */}
            <div>
              <div className="mb-2 sm:mb-3 flex justify-between text-[10px] sm:text-[11px] md:text-xs tracking-[0.25em] sm:tracking-[0.3em]">
                {CHAPTERS.map((c, i) => (
                  <span
                    key={c.year}
                    className="transition-colors duration-300"
                    style={{
                      color:
                        active >= i + 1 ? ACCENT : "rgba(255,255,255,0.45)",
                    }}
                  >
                    {c.year}
                  </span>
                ))}
              </div>
              <div className="relative h-[2px] w-full bg-white/10">
                <motion.div
                  className="absolute inset-y-0 left-0 w-full origin-left"
                  style={{ scaleX: barFill, background: ACCENT }}
                />
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}