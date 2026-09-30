"use client";

import React, { useRef, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface ScrollRevealTextProps {
  text: string;
  className?: string;
  startOpacity?: number;
  endOpacity?: number;
  startScale?: number;
  endScale?: number;
  triggerPoint?: number; // 0 to 1, where animation starts (0.5 = middle of viewport)
}

export const ScrollRevealText = ({
  text,
  className,
  startOpacity = 0.1,
  endOpacity = 1,
  startScale = 0.8,
  endScale = 1,
  triggerPoint = 0.6,
}: ScrollRevealTextProps) => {
  const textRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      if (!textRef.current) return;

      const rect = textRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const triggerPosition = windowHeight * triggerPoint;

      // Calculate how far the element has scrolled past the trigger point
      const elementTop = rect.top;
      const elementHeight = rect.height;

      // Progress from 0 to 1 as element moves through viewport
      let progress = 0;
      
      if (elementTop < triggerPosition) {
        // Element has crossed trigger point
        const scrollDistance = triggerPosition - elementTop;
        const maxScroll = elementHeight + (windowHeight * (1 - triggerPoint));
        progress = Math.min(scrollDistance / maxScroll, 1);
      }

      setScrollProgress(progress);
    };

    handleScroll(); // Initial check
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, [triggerPoint]);

  const currentOpacity = startOpacity + (endOpacity - startOpacity) * scrollProgress;
  const currentScale = startScale + (endScale - startScale) * scrollProgress;

  return (
    <div
      ref={textRef}
      className={cn(
        "text-[12rem] md:text-[16rem] lg:text-[20rem] font-bold tracking-tighter text-white uppercase leading-none select-none",
        className
      )}
      style={{
        opacity: currentOpacity,
        transform: `scale(${currentScale})`,
        transition: "none", // Smooth scroll-linked animation
      }}
    >
      {text}
    </div>
  );
};
