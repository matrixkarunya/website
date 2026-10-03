"use client";

import dynamic from "next/dynamic";
import AboutSection from "@/components/About";
import HeroSection from "@/components/HeroSection";
import TestimonySection from "@/components/TestimonySection";
import EventsSection from "@/components/EventsSection";
// Loads after first paint; never blocks content
import TimelineSection from "@/components/TimelineSection";

const Dither = dynamic(() => import("@/components/ui/Dither"), {
  ssr: false,
  loading: () => null,
});

// Stable reference so uniforms are not re-synced every render
const WAVE_COLOR: [number, number, number] = [0.32, 0.15, 1];

export default function Home() {
  return (
    <>
      {/* ── Layer 0: Fixed Dither Background ── */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          background: "#0a0820",
          contain: "strict",
          pointerEvents: "none",
        }}
      >
        <Dither
          waveColor={WAVE_COLOR}
          disableAnimation={false}
          enableMouseInteraction
          mouseRadius={0.3}
          colorNum={4}
          pixelSize={2}
          waveAmplitude={0.3}
          waveFrequency={3}
          waveSpeed={0.05}
        />
      </div>

      {/* ── Layer 1: Scroll-aware gradient shade ── */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1,
          pointerEvents: "none",
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.70) 0%, rgba(0,0,0,0.30) 18%, transparent 33%, transparent 66%, rgba(0,0,0,0.30) 82%, rgba(0,0,0,0.70) 100%)",
        }}
      />

      {/* ── Layer 2: All content ──
          (a div, not <main>: the root layout already wraps pages in a <main>) */}
      <div
        className="relative w-full min-h-screen"
        style={{ zIndex: 2, pointerEvents: "auto" }}
      >
        <HeroSection />

        {/* Anchor target for the nav's "About" link (/#about) */}
        <div id="about" style={{ scrollMarginTop: 96 }}>
          <AboutSection />
        </div>

        {/* Anchor target for the nav's "Our Timeline" link (/#timeline) */}
        <div id="timeline" style={{ scrollMarginTop: 96 }}>
          <TimelineSection />
        </div>

        <EventsSection />

        <TestimonySection />
      </div>
    </>
  );
}