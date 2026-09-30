"use client";

import React from "react";
import { ScrollRevealText } from "./ScrollRevealText";
import { cn } from "@/lib/utils";

interface ScrollRevealSectionProps {
  lines: string[];
  className?: string;
  lineClassName?: string;
  subtitle?: string;
  subtitleClassName?: string;
}

export const ScrollRevealSection = ({
  lines,
  className,
  lineClassName,
  subtitle,
  subtitleClassName,
}: ScrollRevealSectionProps) => {
  return (
    <section className={cn("relative min-h-[300vh] py-32", className)}>
      <div className="sticky top-0 h-screen flex flex-col items-center justify-center overflow-hidden px-6">
        {/* Main animated text lines */}
        <div className="flex flex-col items-center justify-center space-y-8">
          {lines.map((line, index) => (
            <ScrollRevealText
              key={index}
              text={line}
              className={lineClassName}
              startOpacity={0.05}
              endOpacity={index === 1 ? 0.4 : 1} // Middle line slightly dimmed
              startScale={0.85}
              endScale={1}
              triggerPoint={0.5 + index * 0.1} // Stagger the animations
            />
          ))}
        </div>

        {/* Subtitle */}
        {subtitle && (
          <p
            className={cn(
              "mt-16 text-slate-400 text-lg md:text-xl text-center max-w-3xl",
              subtitleClassName
            )}
          >
            {subtitle}
          </p>
        )}
      </div>
    </section>
  );
};
