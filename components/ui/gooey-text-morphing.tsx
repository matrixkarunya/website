"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface GooeyTextProps {
  texts: string[];
  morphTime?: number;
  cooldownTime?: number;
  className?: string;
  textClassName?: string;
}

export function GooeyText({
  texts,
  morphTime = 2.5,
  cooldownTime = 1,
  className,
  textClassName,
}: GooeyTextProps) {
  const text1Ref = React.useRef<HTMLSpanElement>(null);
  const text2Ref = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    let textIndex = texts.length - 1;
    let time = performance.now();
    let morph = 0;
    let cooldown = cooldownTime;
    let rafId = 0;

    const setMorph = (fraction: number) => {
      if (text1Ref.current && text2Ref.current) {
        // clamp to avoid division by zero / huge blur at the very start
        const f2 = Math.max(fraction, 0.001);
        text2Ref.current.style.filter = `blur(${Math.min(8 / f2 - 8, 100)}px)`;
        text2Ref.current.style.opacity = `${Math.pow(f2, 0.4) * 100}%`;

        const f1 = Math.max(1 - fraction, 0.001);
        text1Ref.current.style.filter = `blur(${Math.min(8 / f1 - 8, 100)}px)`;
        text1Ref.current.style.opacity = `${Math.pow(f1, 0.4) * 100}%`;
      }
    };

    const doCooldown = () => {
      morph = 0;
      if (text1Ref.current && text2Ref.current) {
        text2Ref.current.style.filter = "";
        text2Ref.current.style.opacity = "100%";
        text1Ref.current.style.filter = "";
        text1Ref.current.style.opacity = "0%";
      }
    };

    const doMorph = (dt: number) => {
      morph += dt; // advance by elapsed time
      cooldown = 0;
      let fraction = morph / morphTime;

      if (fraction >= 1) {
        cooldown = cooldownTime;
        fraction = 1;
      }

      setMorph(fraction);
    };

    const animate = (now: number) => {
      rafId = requestAnimationFrame(animate);
      const dt = (now - time) / 1000;
      time = now;

      const shouldIncrementIndex = cooldown > 0;
      cooldown -= dt;

      if (cooldown <= 0) {
        if (shouldIncrementIndex) {
          morph = 0;
          textIndex = (textIndex + 1) % texts.length;
          if (text1Ref.current && text2Ref.current) {
            text1Ref.current.textContent = texts[textIndex % texts.length];
            text2Ref.current.textContent = texts[(textIndex + 1) % texts.length];
          }
        }
        doMorph(dt);
      } else {
        doCooldown();
      }
    };

    rafId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(rafId);
  }, [texts, morphTime, cooldownTime]);

  return (
    <div className={cn("relative w-full", className)}>
      <svg className="absolute h-0 w-0" aria-hidden="true" focusable="false">
        <defs>
          <filter id="threshold">
            <feColorMatrix
              in="SourceGraphic"
              type="matrix"
              values="1 0 0 0 0
                      0 1 0 0 0
                      0 0 1 0 0
                      0 0 0 255 -140"
            />
          </filter>
        </defs>
      </svg>

      <div
        className="flex items-center justify-center px-4 sm:px-6"
        style={{ filter: "url(#threshold)" }}
      >
        <span
          ref={text1Ref}
          className={cn(
            "absolute inline-block select-none text-center",
            "text-3xl xs:text-4xl sm:text-5xl md:text-6xl lg:text-6xl xl:text-7xl",
            "leading-tight max-w-[90vw] break-words text-foreground",
            textClassName
          )}
        />
        <span
          ref={text2Ref}
          className={cn(
            "absolute inline-block select-none text-center",
            "text-3xl xs:text-4xl sm:text-5xl md:text-6xl lg:text-6xl xl:text-7xl",
            "leading-tight max-w-[90vw] break-words text-foreground",
            textClassName
          )}
        />
      </div>
    </div>
  );
}