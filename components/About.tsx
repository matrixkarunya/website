"use client";

import { memo, useRef, useState, useEffect } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Fallback used until the Firestore doc loads (or if it's empty/missing)
const MATRIX_FALLBACK_IMAGE = "/matrix-team.jpg";

// Inserts Cloudinary transformation params right after /upload/ so the CDN
// serves a resized, auto-format, auto-quality version instead of the raw original.
function optimizeCloudinaryUrl(url: string, width = 1200) {
  if (!url.includes("res.cloudinary.com") || !url.includes("/upload/")) {
    return url;
  }
  return url.replace(
    "/upload/",
    `/upload/f_auto,q_auto,w_${width},c_limit/`
  );
}

const sections = [
  {
    number: "01",
    tag: "KITS",
    title: "Karunya Institute of Technology & Sciences",
    subtitle: "Where Karunyans Grow to Change the World",
    description:
      "Established in 1986 and accredited with NAAC A++, Karunya Institute of Technology and Sciences is a premier private deemed university in Coimbatore, Tamil Nadu. Spread across a 700-acre green campus, Karunya unites thousands of students across engineering, science, and humanities under a mission of academic excellence and societal impact.",
    highlights: [
      { label: "Established", value: "1986" },
      { label: "Accreditation", value: "NAAC A++" },
      { label: "Campus", value: "700 Acres" },
      { label: "Ranking", value: "QS Asia Top 700" },
    ],
    image: "/images/ku1.jpeg",
    imageAlt: "Karunya University Campus",
    flip: false,
  },
  {
    number: "02",
    tag: "AIML",
    title: "Division of AI & Machine Learning",
    subtitle: "Building the Engineers of Tomorrow",
    description:
      "The Division of AI & ML at Karunya creates a foreground for students to acquire knowledge in futuristic areas of Artificial Intelligence & Machine Learning Engineering — covering computer vision, NLP, robotics, and deep learning to prepare globally competitive professionals.",
    highlights: [
      { label: "Program", value: "B.Tech & M.Tech" },
      { label: "Duration", value: "2 - 4 Years" },
      { label: "Focus", value: "AI · ML" },
      { label: "Vision", value: "Global Ready" },
    ],
    image: "/images/aiml.png",
    imageAlt: "Division of AI & ML",
    flip: true,
  },
  {
    number: "03",
    tag: "The Community",
    title: "MATRIX",
    subtitle: "Machine Learning Association for Technical Research & Innovative eXcellence",
    description:
      "Inaugurated on 2nd September 2025, MATRIX is the official student association of the Division of AI & ML. We are a community of students, innovators, and leaders pushing boundaries — from workshops and hackathons to research initiatives and industry connects.",
    highlights: [
      { label: "Events", value: "20+" },
      { label: "Workshops", value: "10+" },
      { label: "Alumni", value: "100+" },
      { label: "Reached", value: "2k+" },
    ],
    image: MATRIX_FALLBACK_IMAGE,
    imageAlt: "MATRIX Student Community",
    flip: false,
  },
];

type Section = (typeof sections)[number];

// Same text shadow as the Hero so the look matches
const textShadow = "0 2px 16px rgba(0,0,0,0.9), 0 1px 4px rgba(0,0,0,1)";
const paraTextShadow = "0 1px 8px rgba(0,0,0,0.95), 0 2px 20px rgba(0,0,0,0.8)";

// Stat boxes: same glass look as the Hero pills, fill only (no per-element blur)
const glassStat: React.CSSProperties = {
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.05) 100%)",
  border: "1px solid rgba(255,255,255,0.18)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12)",
};

// Image frame: same as the Hero stats card
const glassFrame: React.CSSProperties = {
  background: "rgba(0,0,0,0.35)",
  border: "1px solid rgba(255,255,255,0.14)",
  boxShadow: "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)",
};

const Panel = memo(function Panel({
  section,
  priority,
}: {
  section: Section;
  priority: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-8%" });
  const reduce = useReducedMotion();

  const dx = reduce ? 0 : 24;
  const textAnim = {
    hidden: { opacity: 0, x: section.flip ? dx : -dx },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
    },
  };
  const imgAnim = {
    hidden: { opacity: 0, x: section.flip ? -dx : dx },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const, delay: 0.1 },
    },
  };

  return (
    <div
      ref={ref}
      className={cn(
        "flex flex-col lg:flex-row gap-8 items-center py-10",
        section.flip && "lg:flex-row-reverse"
      )}
    >
      {/* ── Text ── */}
      <motion.div
        className="flex-1 flex flex-col gap-4 will-change-transform"
        variants={textAnim}
        initial="hidden"
        animate={isInView ? "visible" : "hidden"}
      >
        {/* Number + tag */}
        <div className="flex items-center gap-3">
          <span
            className="text-[52px] font-black leading-none select-none"
            style={{
              color: "rgba(255,255,255,0.12)",
              WebkitTextStroke: "1.5px rgba(255,255,255,0.55)",
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
          >
            {section.number}
          </span>
          <div className="flex flex-col gap-1">
            <span
              className="text-[10px] font-bold tracking-[0.22em] uppercase"
              style={{ color: "rgba(255,255,255,0.65)", textShadow }}
            >
              {section.tag}
            </span>
            <div className="w-8 h-px bg-white/35" />
          </div>
        </div>

        {/* Title + subtitle */}
        <div className="flex flex-col gap-1.5">
          <h2
            className="text-2xl md:text-3xl lg:text-[1.85rem] font-black leading-tight tracking-tight"
            style={{ color: "#ffffff", textShadow }}
          >
            {section.title}
          </h2>
          <p
            className="text-xs md:text-sm font-medium leading-snug"
            style={{ color: "rgba(255,255,255,0.6)", textShadow }}
          >
            {section.subtitle}
          </p>
        </div>

        {/* Description */}
        <p
          className="text-xs md:text-sm leading-[1.8]"
          style={{ color: "rgba(255,255,255,0.85)", textShadow: paraTextShadow }}
        >
          {section.description}
        </p>

        {/* Stats: 2 cols on phones, 4 from sm up */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
          {section.highlights.map(({ label, value }) => (
            <div
              key={label}
              className="px-2 py-2.5 rounded-xl flex flex-col items-center text-center"
              style={glassStat}
            >
              <p
                className="text-base md:text-lg font-black leading-none"
                style={{ color: "#ffffff", textShadow }}
              >
                {value}
              </p>
              <p
                className="text-[10px] font-medium mt-1 leading-tight"
                style={{ color: "rgba(255,255,255,0.55)" }}
              >
                {label}
              </p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── Image ── */}
      <motion.div
        className="flex-1 w-full will-change-transform"
        variants={imgAnim}
        initial="hidden"
        animate={isInView ? "visible" : "hidden"}
      >
        <div
          className="relative w-full aspect-[16/10] rounded-2xl overflow-hidden"
          style={glassFrame}
        >
          <div className="absolute inset-x-0 top-0 h-px z-10 bg-gradient-to-r from-transparent via-white/35 to-transparent pointer-events-none" />

          <Image
            src={section.image}
            alt={section.imageAlt}
            fill
            className="object-cover"
            sizes="(max-width: 1024px) 100vw, 50vw"
            quality={75}
            priority={priority}
            loading={priority ? undefined : "lazy"}
            decoding="async"
          />

          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/10 pointer-events-none" />

          <div
            className="absolute bottom-3 left-3 px-2.5 py-1 rounded-lg text-[10px] font-semibold tracking-wide z-10"
            style={{
              color: "rgba(255,255,255,0.85)",
              background: "rgba(0,0,0,0.55)",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            {section.imageAlt}
          </div>
        </div>
      </motion.div>
    </div>
  );
});

export default function AboutSection() {
  // Live-editable MATRIX section image, pulled from Firestore (settings/matrixImage)
  const [matrixImage, setMatrixImage] = useState<string>(MATRIX_FALLBACK_IMAGE);

  useEffect(() => {
    const ref = doc(db, "settings", "matrixImage");
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as { imageUrl?: string };
          if (data.imageUrl) {
            setMatrixImage(optimizeCloudinaryUrl(data.imageUrl));
          }
        }
      },
      (err) => {
        console.error("Failed to load MATRIX section image:", err);
        // Falls back silently to the static image
      }
    );
    return () => unsub();
  }, []);

  // Override only the MATRIX (03) section's image with the live Firestore value.
  // The other two panels stay fully static.
  const liveSections = sections.map((s) =>
    s.number === "03" ? { ...s, image: matrixImage } : s
  );

  return (
    <section className="relative w-full isolate overflow-hidden">
      {/*
        ── Same background recipe as the Hero ──
        The page-level fixed Dither is already rendering behind this section,
        so instead of mounting another WebGL canvas we stack the Hero's exact
        layers on top of it:
          1. bg-black/50 tint
          2. backdrop-blur-sm + bg-white/[0.03]   (ONE blur layer for the whole section)
          3. radial vignette
        No extra canvas, so no extra GPU cost.
      */}
      <div
        aria-hidden
        className="absolute inset-0 w-full h-full -z-20 pointer-events-none"
        style={{ transform: "translateZ(0)", contain: "paint" }}
      >
        <div className="absolute inset-0 bg-black/50" />
        <div className="absolute inset-0 backdrop-blur-sm bg-white/[0.03]" />
      </div>

      {/* Radial vignette (identical to Hero) */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none -z-10"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.65) 100%)",
        }}
      />

      {/* ── Header ── */}
      <div className="relative z-10 max-w-6xl mx-auto px-6 md:px-10 lg:px-16 pt-8 pb-0">
        <motion.div
          className="flex flex-col items-center text-center gap-2.5"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-8%" }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <div
            className="flex items-center gap-2 px-3.5 py-1 rounded-full border border-white/20"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.05) 100%)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12)",
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-white/70" />
            <span
              className="text-[10px] font-semibold tracking-[0.2em] uppercase"
              style={{ color: "rgba(255,255,255,0.65)", textShadow }}
            >
              Our Story
            </span>
          </div>

          <h2
            className="text-3xl md:text-4xl lg:text-5xl font-black tracking-tight leading-tight"
            style={{ color: "#ffffff", textShadow }}
          >
            About
          </h2>

          <p
            className="text-xs md:text-sm max-w-md leading-relaxed"
            style={{ color: "rgba(255,255,255,0.82)", textShadow: paraTextShadow }}
          >
            From a world-class university, to a pioneering department, to a
            community redefining what students can build.
          </p>

          <div className="w-12 h-px mt-1" style={{ background: "rgba(255,255,255,0.28)" }} />
        </motion.div>
      </div>

      {/* ── Panels ── */}
      <div className="relative z-10 max-w-6xl mx-auto px-6 md:px-10 lg:px-16">
        {liveSections.map((section, i) => (
          <div
            key={section.number}
            style={
              i !== liveSections.length - 1
                ? { borderBottom: "1px solid rgba(255,255,255,0.08)" }
                : undefined
            }
          >
            <Panel section={section} priority={i === 0} />
          </div>
        ))}
      </div>
    </section>
  );
}