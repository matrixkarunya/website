"use client";

import { memo, useEffect, useRef } from "react";
import { animate, useInView, useReducedMotion } from "framer-motion";

interface StatItem {
  value: number;
  suffix?: string;
  label: string;
}

const STATS: StatItem[] = [
  { value: 20, suffix: "+", label: "Events Hosted" },
  { value: 10, suffix: "+", label: "Workshops Conducted" },
  { value: 100, suffix: "+", label: "Alumni Network" },
  { value: 2, suffix: "k+", label: "Students Reached" },
];

/**
 * Counts up by writing straight into the DOM node.
 * No React state, so zero re-renders while the number animates.
 */
const AnimatedCounter = memo(function AnimatedCounter({
  value,
  suffix = "",
}: {
  value: number;
  suffix?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el || !isInView) return;

    // Reduced motion: jump straight to the final number
    if (reduceMotion) {
      el.textContent = `${value.toLocaleString()}${suffix}`;
      return;
    }

    const controls = animate(0, value, {
      duration: 1.6,
      ease: [0.22, 1, 0.36, 1], // fast start, soft landing (like the old spring)
      onUpdate: (latest) => {
        el.textContent = `${Math.floor(latest).toLocaleString()}${suffix}`;
      },
      onComplete: () => {
        el.textContent = `${value.toLocaleString()}${suffix}`;
      },
    });

    return () => controls.stop();
  }, [isInView, value, suffix, reduceMotion]);

  return (
    <span
      ref={ref}
      className="tabular-nums text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white"
    >
      {/* Real final value in the initial HTML: no layout shift, good for SEO / no-JS */}
      {`0${suffix}`}
    </span>
  );
});

export default function StatsCounter() {
  return (
    <div className="stats-wrap w-full px-4 sm:px-6 md:px-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 md:gap-8 lg:gap-10">
        {STATS.map((stat, index) => (
          <div
            key={stat.label}
            className="stat-item text-center space-y-1 sm:space-y-2 group"
            style={{ animationDelay: `${0.15 + index * 0.08}s` }}
          >
            {/* Number with underline on hover */}
            <div className="relative inline-block">
              <AnimatedCounter value={stat.value} suffix={stat.suffix} />
              {/* <div className="absolute -bottom-1 left-0 h-0.5 w-full origin-left scale-x-0 bg-gradient-to-r from-cyan-400 to-blue-500 transition-transform duration-500 group-hover:scale-x-100" /> */}
            </div>

            {/* Label */}
            <p className="text-xs sm:text-sm md:text-base text-gray-400 font-light tracking-wide leading-tight">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* Entrance animation in CSS: runs on the compositor, no JS per frame */}
      <style jsx>{`
        .stat-item {
          opacity: 0;
          transform: translate3d(0, 24px, 0);
          animation: statIn 0.7s cubic-bezier(0.22, 1, 0.36, 1) forwards;
          will-change: opacity, transform;
        }
        @keyframes statIn {
          to {
            opacity: 1;
            transform: translate3d(0, 0, 0);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .stat-item {
            animation: none;
            opacity: 1;
            transform: none;
          }
        }
      `}</style>
    </div>
  );
}