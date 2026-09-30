"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { GooeyText } from "@/components/ui/gooey-text-morphing";
import StatsCounter from "@/components/stats-counter";
import Dither from "@/components/ui/Dither";

const textShadow = "0 2px 16px rgba(0,0,0,0.9), 0 1px 4px rgba(0,0,0,1)";

export default function HeroSection() {
  return (
    <section
      className="relative flex flex-col items-center justify-center px-6 overflow-hidden"
      style={{ minHeight: "100svh" }}
    >
      {/* ── Blurred Dither backdrop — scoped to this section, scrolls away with it ── */}
      <div className="absolute inset-0 w-full h-full -z-20">
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
        <div className="absolute inset-0 bg-black/50" />
        <div className="absolute inset-0 backdrop-blur-sm bg-white/[0.03]" />
      </div>

      {/* Radial vignette */}
      <div
        className="absolute inset-0 pointer-events-none -z-10"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.65) 100%)",
        }}
      />

      {/* ── Top Left Logo - MATRIX ── */}
      <motion.div
        className="absolute top-5 left-5 md:top-8 md:left-10 z-20"
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 1, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
      >
        <Image
          src="/ml.png"
          alt="Matrix Logo"
          width={64}
          height={64}
          className="w-12 md:w-16 lg:w-20 h-12 md:h-16 lg:h-20 object-contain"
          priority
        />
      </motion.div>

      {/* ── Top Right Logo - Karunya ── */}
      <motion.div
        className="absolute top-5 right-5 md:top-8 md:right-10 z-20"
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 1, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
      >
        <Image
          src="/kl.png"
          alt="Karunya Logo"
          width={64}
          height={64}
          className="w-12 md:w-16 lg:w-20 h-12 md:h-16 lg:h-20 object-contain"
          priority
        />
      </motion.div>

      {/* ── Main Content ──
          Mobile : pt-16 pb-24 gap-3   → fits inside screen above bottom navbar
          Desktop: pt-24 pb-12 gap-4   → spacious, comfortable
      ── */}
      <div className="w-full max-w-4xl mx-auto relative z-10 flex flex-col items-center gap-3 md:gap-5 pt-16 pb-24 md:pt-24 md:pb-12">

        {/* ── GooeyText — UNTOUCHED ── */}
        <motion.div
          className="w-full text-center"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Mobile: 120px so content fits; Desktop: 200px for full impact */}
          <div className="h-[120px] md:h-[200px] flex items-center justify-center">
            <GooeyText
              texts={["MATRIX", "Division of AIML", "STUDENT ASSOCIATION"]}
              morphTime={1.2}
              cooldownTime={0.5}
              textClassName="font-extrabold tracking-tight text-white drop-shadow-[0_0_30px_rgba(139,92,246,0.6)]"
            />
          </div>
        </motion.div>

        {/* Subtitle + Pills */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col items-center gap-3 md:gap-4 -mt-2 md:-mt-3"
        >
          <p
            className="text-sm md:text-xl lg:text-2xl font-black tracking-[0.1em] uppercase text-center"
            style={{ color: "rgba(255,255,255,0.92)", textShadow }}
          >
            Karunya&apos;s Premier AI/ML Community
          </p>

          {/* Thin divider */}
          <div
            className="w-16 h-px"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)",
            }}
          />

          {/* Pills */}
          <div className="flex items-center gap-2 md:gap-2.5 flex-wrap justify-center">
            {[
              { label: "Students",   dot: "#22d3ee" },
              { label: "Innovators", dot: "#c084fc" },
              { label: "Leaders",    dot: "#60a5fa" },
            ].map(({ label, dot }) => (
              <motion.span
                key={label}
                className="flex items-center gap-1.5 text-[11px] md:text-sm font-semibold tracking-widest uppercase"
                style={{
                  color: "rgba(255,255,255,0.82)",
                  padding: "5px 14px",
                  borderRadius: "9999px",
                  border: "1px solid rgba(255,255,255,0.22)",
                  background: "rgba(255,255,255,0.09)",
                  backdropFilter: "blur(12px)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12)",
                  textShadow,
                }}
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0"
                  style={{ background: dot, boxShadow: `0 0 6px ${dot}` }}
                />
                {label}
              </motion.span>
            ))}
          </div>
        </motion.div>

        {/* Stats Block */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="w-full mt-1 md:mt-2"
        >
          {/* "Our Impact" pill label */}
          <div className="flex items-center justify-center mb-3">
            <div className="flex items-center gap-3 w-full max-w-xs">
              <div
                className="flex-1 h-px"
                style={{ background: "rgba(255,255,255,0.18)" }}
              />
              <span
                className="text-[9px] md:text-[10px] font-bold tracking-[0.28em] uppercase px-3 py-1 rounded-full flex-shrink-0"
                style={{
                  color: "rgba(255,255,255,0.75)",
                  background: "rgba(255,255,255,0.10)",
                  border: "1px solid rgba(255,255,255,0.20)",
                  backdropFilter: "blur(8px)",
                  textShadow,
                }}
              >
                Our Impact
              </span>
              <div
                className="flex-1 h-px"
                style={{ background: "rgba(255,255,255,0.18)" }}
              />
            </div>
          </div>

          {/* Frosted glass stats card */}
          <div
            className="w-full rounded-2xl px-3 py-3 md:px-4 md:py-5"
            style={{
              background: "rgba(0,0,0,0.35)",
              border: "1px solid rgba(255,255,255,0.14)",
              backdropFilter: "blur(20px)",
              boxShadow:
                "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)",
            }}
          >
            <StatsCounter />
          </div>
        </motion.div>
      </div>

      {/* ── Scroll Indicator — bottom-right corner, desktop only ──
          Vertical editorial style: animated line + rotated "SCROLL" text
          Absolute so it's always pinned in viewport, never pushed off screen
      ── */}
      <motion.div
        className="absolute bottom-8 right-8 md:right-10 hidden md:flex flex-col items-center gap-2 z-20"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.6, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Rotated SCROLL text */}
        <span
          className="text-[9px] font-bold tracking-[0.3em] uppercase"
          style={{
            color: "rgba(255,255,255,0.45)",
            writingMode: "vertical-rl",
            textOrientation: "mixed",
            textShadow,
            letterSpacing: "0.3em",
          }}
        >
          Scroll
        </span>

        {/* Animated breathing line */}
        <motion.div
          style={{
            width: "1px",
            borderRadius: "9999px",
            background:
              "linear-gradient(to bottom, rgba(255,255,255,0.55), rgba(255,255,255,0.05))",
            transformOrigin: "top",
          }}
          animate={{
            height: ["24px", "40px", "24px"],
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            repeat: Infinity,
            duration: 1.8,
            ease: "easeInOut",
          }}
        />

        {/* Arrow tip */}
        <motion.div
          animate={{ y: [0, 4, 0] }}
          transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M2 5L7 10L12 5"
              stroke="rgba(255,255,255,0.5)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </motion.div>
      </motion.div>

    </section>
  );
}