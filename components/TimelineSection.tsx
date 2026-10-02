"use client";
import { useRef, useState, useEffect, useMemo, memo } from "react";
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
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  buildChapters,
  REBRAND_YEAR,
  type Chapter,
  type TimelineEntry,
} from "@/lib/timeline";

// ───────────────────────── Config ─────────────────────────
const ACCENT = "#8272f0";
const REST_UNITS = 0.5; // rest on the last year before leaving
const EXIT_UNITS = 1; // scroll spent fading out into Events
const HOLD = 0.25; // share of each step where a panel rests before sliding
const MAX_BLUR_PX: number = 8;
const textShadow = "0 2px 10px rgba(0,0,0,0.85), 0 1px 3px rgba(0,0,0,1)";

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

// Smootherstep: zero velocity AND acceleration at both ends.
const smoother = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

// Tracks the rounded panel index and only re-renders the caller.
function useActivePanel(pos: MotionValue<number>) {
  const [active, setActive] = useState(() => Math.round(pos.get()));
  useMotionValueEvent(pos, "change", (v) => {
    const r = Math.round(v);
    setActive((prev) => (prev === r ? prev : r));
  });
  return active;
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

const IntroPanel = memo(function IntroPanel({
  pos,
  panels,
  endYear,
}: {
  pos: MotionValue<number>;
  panels: number;
  endYear: string;
}) {
  const opacity = useTransform(pos, (v) => Math.max(0, 1 - v * 1.1));
  return (
    <div
      className="relative h-full flex-shrink-0"
      style={{ width: `${100 / panels}%` }}
    >
      <motion.div
        style={{ opacity }}
        className="flex h-full flex-col justify-center px-6 sm:px-10 md:px-[7%] pt-16"
      >
        <p
          className="mb-4 sm:mb-5 text-[11px] sm:text-sm tracking-[0.35em] sm:tracking-[0.4em] text-white/55"
          style={{ textShadow }}
        >
          2023 → {endYear}
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
});

const YearPanel = memo(function YearPanel({
  chapter,
  index,
  panels,
  pos,
}: {
  chapter: Chapter;
  index: number; // panel index (intro is 0)
  panels: number;
  pos: MotionValue<number>;
}) {
  const opacity = useTransform(pos, (v) =>
    Math.max(0, 1 - Math.abs(v - index) * 1.1)
  );

  return (
    <div
      className="relative h-full flex-shrink-0"
      style={{ width: `${100 / panels}%` }}
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
          boxShadow: `0 0 0 5px ${ACCENT}22, 0 0 16px 3px ${ACCENT}88`,
        }}
      />

      {/* Card */}
      <motion.div
        className="absolute left-1/2 -translate-x-1/2 rounded-2xl sm:rounded-3xl p-5 sm:p-6 md:p-8"
        style={{
          opacity,
          top: "calc(var(--line-y) + 1.5rem)",
          width: "min(88vw, 32rem)",
          background: "rgba(14,11,34,0.78)",
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow:
            "0 12px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)",
        }}
      >
        <Pill>{chapter.chapter}</Pill>
        <h4
          className="mt-4 sm:mt-5 text-xl sm:text-2xl md:text-[1.75rem] font-black leading-tight tracking-tight text-white"
          style={{ textShadow }}
        >
          {chapter.title}
        </h4>
        <p className="mt-2 sm:mt-3 text-[13px] sm:text-sm md:text-[15px] leading-[1.65] sm:leading-[1.7] text-white/65 break-words">
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
          {chapter.badge && (
            <span
              className="rounded-full border px-3 py-1 sm:px-4 sm:py-1.5 text-[9px] sm:text-[11px] font-bold tracking-[0.18em] sm:tracking-[0.22em] uppercase text-white"
              style={{
                borderColor: "rgba(255,255,255,0.16)",
                background: "rgba(255,255,255,0.05)",
              }}
            >
              {chapter.badge}
            </span>
          )}
        </div>
      </motion.div>
    </div>
  );
});

const ActiveLabel = memo(function ActiveLabel({
  pos,
  chapters,
  endYear,
}: {
  pos: MotionValue<number>;
  chapters: Chapter[];
  endYear: string;
}) {
  const active = useActivePanel(pos);
  return (
    <motion.p
      key={active}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="pl-1 text-xs sm:text-sm md:text-base font-semibold text-white/65"
      style={{ textShadow }}
    >
      {active === 0
        ? `2023 → ${endYear}`
        : chapters[Math.min(active, chapters.length) - 1].academicYear}
    </motion.p>
  );
});

const YearTicks = memo(function YearTicks({
  pos,
  chapters,
}: {
  pos: MotionValue<number>;
  chapters: Chapter[];
}) {
  const active = useActivePanel(pos);
  return (
    <div className="mb-2 sm:mb-3 flex justify-between text-[10px] sm:text-[11px] md:text-xs tracking-[0.25em] sm:tracking-[0.3em]">
      {chapters.map((c, i) => (
        <span
          key={c.year}
          className="transition-colors duration-300"
          style={{
            color: active >= i + 1 ? ACCENT : "rgba(255,255,255,0.45)",
          }}
        >
          {c.year}
        </span>
      ))}
    </div>
  );
});

// ───────────────────────── Inner timeline (needs ≥ 1 chapter) ─────────────────────────
function TimelineInner({
  chapters,
  rebrandPanel,
}: {
  chapters: Chapter[];
  /** Panel index where MATRIX takes over, or Infinity if there is none */
  rebrandPanel: number;
}) {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();

  const cfg = useMemo(() => {
    const PANELS = chapters.length + 1; // intro + one per year
    const LAST = PANELS - 1;
    const TOTAL_UNITS = LAST + REST_UNITS + EXIT_UNITS;
    const SLIDE_END = LAST / TOTAL_UNITS;
    const EXIT_START = (LAST + REST_UNITS) / TOTAL_UNITS;
    const COUNTS = chapters.reduce<number[]>(
      (acc, c) => [...acc, acc[acc.length - 1] + c.events],
      [0]
    );
    const PANEL_INDEXES = Array.from({ length: PANELS }, (_, i) => i);

    // Raw scroll progress (0..1) -> panel position (0..LAST), with a rest at every panel
    const positionAt = (p: number) => {
      const q = clamp01(p / SLIDE_END);
      if (q >= 1) return LAST;
      const seg = q * LAST;
      const k = Math.floor(seg);
      const t = clamp01((seg - k - HOLD) / (1 - HOLD));
      return k + smoother(t);
    };

    return {
      PANELS,
      LAST,
      TOTAL_UNITS,
      EXIT_START,
      COUNTS,
      PANEL_INDEXES,
      positionAt,
    };
  }, [chapters]);

  const { PANELS, LAST, TOTAL_UNITS, EXIT_START, COUNTS, PANEL_INDEXES, positionAt } =
    cfg;
  const endYear = chapters[chapters.length - 1].year;

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });

  const smooth = useSpring(scrollYProgress, {
    stiffness: 70,
    damping: 22,
    mass: 0.7,
    restDelta: 0.0005,
  });
  const progress = reduce ? scrollYProgress : smooth;

  const pos = useTransform(progress, positionAt);
  const trackX = useTransform(pos, (v) => `${(-v * 100) / PANELS}%`);

  const exit = useTransform(progress, (p) =>
    clamp01((p - EXIT_START) / (1 - EXIT_START))
  );
  const exitFilter = useTransform(exit, (e) =>
    e <= 0.001 || reduce || MAX_BLUR_PX === 0
      ? "none"
      : `blur(${(e * MAX_BLUR_PX).toFixed(1)}px)`
  );
  const exitOpacity = useTransform(exit, (e) => 1 - e);
  const exitScale = useTransform(exit, (e) => (reduce ? 1 : 1 - 0.035 * e));

  // Live HUD values
  const counter = useTransform(pos, PANEL_INDEXES, COUNTS);
  const counterText = useTransform(counter, (v) =>
    String(Math.round(v)).padStart(2, "0")
  );
  // 0 -> 1 reaches ~4% at the first year, then fills to 100% at the last
  const barFill = useTransform(pos, (v) => {
    if (LAST <= 1) return clamp01(v) * 1;
    return v <= 1 ? 0.04 * Math.max(0, v) : 0.04 + (0.96 * (v - 1)) / (LAST - 1);
  });
  const baseLine = useTransform(pos, (v) => clamp01((v - 0.4) / 0.6));
  const litLine = useTransform(pos, (v) => clamp01(v - 1));
  // AIMS fades in at the start and out just before the rebrand panel
  const aimsOpacity = useTransform(pos, (v) =>
    Math.min(clamp01((v - 0.5) / 0.5), clamp01((rebrandPanel - 0.3 - v) / 0.7))
  );
  // MATRIX fades in as the rebrand panel arrives and stays
  const matrixOpacity = useTransform(pos, (v) =>
    clamp01((v - (rebrandPanel - 0.7)) / 0.7)
  );

  const ghostBase: React.CSSProperties = {
    gridArea: "1 / 1",
    color: "transparent",
    WebkitTextStroke: "1.5px rgba(255,255,255,0.14)",
    lineHeight: 1,
    letterSpacing: 0,
    textAlign: "center",
    willChange: "opacity",
    transform: "translateZ(0)",
  };

  return (
    <section
      ref={ref}
      id="journey"
      aria-label="Our journey timeline"
      className="relative w-full [--per:160svh] md:[--per:120svh]"
      style={{ height: `calc(var(--per) * ${TOTAL_UNITS} + 100svh)` }}
    >
      <div className="sticky top-0 h-[100svh] w-full overflow-hidden isolate [--line-y:34%] sm:[--line-y:38%] [@media(max-height:620px)]:[--line-y:31%]">
        <div aria-hidden className="absolute inset-0 -z-20 pointer-events-none">
          <div className="absolute inset-0 bg-black/60" />
        </div>
        <div
          aria-hidden
          className="absolute inset-0 -z-10 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.65) 100%)",
          }}
        />

        <motion.div
          className="absolute inset-0 will-change-[opacity,transform]"
          style={{
            filter: exitFilter,
            opacity: exitOpacity,
            scale: exitScale,
          }}
        >
          {/* Ghost outline words */}
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

          {/* Timeline line */}
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
            <IntroPanel pos={pos} panels={PANELS} endYear={endYear} />
            {chapters.map((c, i) => (
              <YearPanel
                key={c.year}
                chapter={c}
                index={i + 1}
                panels={PANELS}
                pos={pos}
              />
            ))}
          </motion.div>

          {/* HUD */}
          <div className="absolute inset-0 z-[3] pointer-events-none px-5 sm:px-6 md:px-10 lg:px-16 pt-[4.5rem] md:pt-24 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:pb-8 flex flex-col justify-between">
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-2 sm:gap-3 min-w-0">
                <Pill>Our Journey</Pill>
                <ActiveLabel pos={pos} chapters={chapters} endYear={endYear} />
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

            <div>
              <YearTicks pos={pos} chapters={chapters} />
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

// ───────────────────────── Data wrapper (default export) ─────────────────────────
export default function TimelineSection() {
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "timeline"), orderBy("year", "asc"));
    return onSnapshot(
      q,
      (snap) => {
        setEntries(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TimelineEntry)
        );
        setLoaded(true);
      },
      (err) => {
        // Falls back to the fixed 2023 chapter only
        console.error("Error loading timeline:", err);
        setLoaded(true);
      }
    );
  }, []);

  const chapters = useMemo(() => buildChapters(entries), [entries]);

  // Panel index of the first year >= rebrand year (intro is panel 0)
  const rebrandIdx = chapters.findIndex((c) => Number(c.year) >= REBRAND_YEAR);
  const rebrandPanel = rebrandIdx === -1 ? Infinity : rebrandIdx + 1;

  if (!loaded) {
    return <section id="journey" aria-busy="true" className="h-[100svh] w-full" />;
  }

  // Re-mount only when the panel structure changes (add/delete a year)
  return (
    <TimelineInner
      key={`${chapters.length}-${rebrandPanel}`}
      chapters={chapters}
      rebrandPanel={rebrandPanel}
    />
  );
}