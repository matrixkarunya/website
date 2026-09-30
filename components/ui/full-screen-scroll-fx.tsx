import React, {
  CSSProperties,
  ReactNode,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

// ============================================================================
// TYPES
// ============================================================================

type Section = {
  id?: string;
  background: string;
  leftLabel?: ReactNode;
  title: string | ReactNode;
  rightLabel?: ReactNode;
  description?: ReactNode; // NEW: For elegant text content
  renderBackground?: (active: boolean, previous: boolean) => ReactNode;
};

type Colors = Partial<{
  text: string;
  overlay: string;
  pageBg: string;
  stageBg: string;
}>;

type Durations = Partial<{
  change: number;
  snap: number;
}>;

export type FullScreenFXAPI = {
  next: () => void;
  prev: () => void;
  goTo: (index: number) => void;
  getIndex: () => number;
  refresh: () => void;
};

export type FullScreenFXProps = {
  sections: Section[];
  className?: string;
  style?: CSSProperties;

  fontFamily?: string;
  header?: ReactNode;
  footer?: ReactNode;
  gap?: number;
  gridPaddingX?: number;

  showProgress?: boolean;
  debug?: boolean;

  durations?: Durations;
  reduceMotion?: boolean;
  smoothScroll?: boolean;

  bgTransition?: "fade" | "wipe";
  parallaxAmount?: number;

  currentIndex?: number;
  onIndexChange?: (index: number) => void;
  initialIndex?: number;

  colors?: Colors;

  apiRef?: React.Ref<FullScreenFXAPI>;
  ariaLabel?: string;
  
  showEntranceTransition?: boolean; // NEW: Control entrance animation
};

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// ============================================================================
// COMPONENT
// ============================================================================

export const FullScreenScrollFX = forwardRef<HTMLDivElement, FullScreenFXProps>(
  (
    {
      sections,
      className,
      style,

      fontFamily = '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
      header,
      footer,
      gap = 1,
      gridPaddingX = 2,

      showProgress = true,
      debug = false,

      durations = { change: 0.7, snap: 800 },
      reduceMotion,
      smoothScroll = false,

      bgTransition = "fade",
      parallaxAmount = 4,

      currentIndex,
      onIndexChange,
      initialIndex = 0,

      colors = {
        text: "rgba(245,245,245,0.95)",
        overlay: "rgba(0,0,0,0.5)",
        pageBg: "#000000",
        stageBg: "#000000",
      },

      apiRef,
      ariaLabel = "Full screen scroll slideshow",
      
      showEntranceTransition = true,
    },
    ref
  ) => {
    const total = sections.length;
    const [localIndex, setLocalIndex] = useState(clamp(initialIndex, 0, Math.max(0, total - 1)));
    const isControlled = typeof currentIndex === "number";
    const index = isControlled ? clamp(currentIndex!, 0, Math.max(0, total - 1)) : localIndex;
    const [hasEntered, setHasEntered] = useState(false);

    // Refs
    const rootRef = useRef<HTMLDivElement | null>(null);
    const fixedRef = useRef<HTMLDivElement | null>(null);
    const fixedSectionRef = useRef<HTMLDivElement | null>(null);
    const entranceOverlayRef = useRef<HTMLDivElement | null>(null);

    const bgRefs = useRef<HTMLImageElement[]>([]);
    const wordRefs = useRef<HTMLSpanElement[][]>([]);
    const descriptionRefs = useRef<HTMLDivElement[]>([]);

    const leftTrackRef = useRef<HTMLDivElement | null>(null);
    const rightTrackRef = useRef<HTMLDivElement | null>(null);
    const leftItemRefs = useRef<HTMLDivElement[]>([]);
    const rightItemRefs = useRef<HTMLDivElement[]>([]);

    const progressFillRef = useRef<HTMLDivElement | null>(null);
    const currentNumberRef = useRef<HTMLSpanElement | null>(null);

    const stRef = useRef<ScrollTrigger | null>(null);
    const lastIndexRef = useRef(index);
    const isAnimatingRef = useRef(false);
    const isSnappingRef = useRef(false);
    const sectionTopRef = useRef<number[]>([]);

    const prefersReduced = useMemo(() => {
      if (typeof window === "undefined") return false;
      return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }, []);
    const motionOff = reduceMotion ?? prefersReduced;

    // ========================================================================
    // ENTRANCE TRANSITION
    // ========================================================================
    useEffect(() => {
      if (!showEntranceTransition || hasEntered) return;
      
      const overlay = entranceOverlayRef.current;
      if (!overlay) return;

      // Dark entrance animation
      const tl = gsap.timeline({
        onComplete: () => setHasEntered(true)
      });

      tl.set(overlay, { opacity: 1 })
        .to(overlay, {
          opacity: 0,
          duration: 1.5,
          ease: "power2.inOut",
          delay: 0.3
        });

    }, [showEntranceTransition, hasEntered]);

    // ========================================================================
    // WORD SPLITTING
    // ========================================================================
    const tempWordBucket = useRef<HTMLSpanElement[]>([]);
    
    const splitWords = (text: string) => {
      const words = text.split(/\s+/).filter(Boolean);
      return words.map((w, i) => (
        <span className="fx-word-mask" key={i}>
          <span className="fx-word" ref={(el) => el && tempWordBucket.current.push(el)}>
            {w}
          </span>
          {i < words.length - 1 ? " " : null}
        </span>
      ));
    };

    const WordsCollector = ({ onReady }: { onReady: () => void }) => {
      useEffect(() => onReady(), []); // eslint-disable-line
      return null;
    };

    // ========================================================================
    // COMPUTE POSITIONS
    // ========================================================================
    const computePositions = () => {
      const el = fixedSectionRef.current;
      if (!el) return;
      const top = el.offsetTop;
      const h = el.offsetHeight;
      const arr: number[] = [];
      for (let i = 0; i < total; i++) arr.push(top + (h * i) / total);
      sectionTopRef.current = arr;
    };

    // ========================================================================
    // CENTER LISTS
    // ========================================================================
    const measureAndCenterLists = (toIndex = index, animate = true) => {
      const centerTrack = (
        container: HTMLDivElement | null,
        items: HTMLDivElement[],
        isRight: boolean
      ) => {
        if (!container || items.length === 0) return;
        const first = items[0];
        const second = items[1];
        const contRect = container.getBoundingClientRect();
        let rowH = first.getBoundingClientRect().height;
        if (second) {
          rowH = second.getBoundingClientRect().top - first.getBoundingClientRect().top;
        }
        const targetY = contRect.height / 2 - rowH / 2 - toIndex * rowH;
        const prop = isRight ? rightTrackRef : leftTrackRef;
        if (!prop.current) return;
        
        if (animate) {
          gsap.to(prop.current, {
            y: targetY,
            duration: (durations.change ?? 0.7) * 0.9,
            ease: "power3.out",
          });
        } else {
          gsap.set(prop.current, { y: targetY });
        }
      };

      measureRAF(() => {
        measureRAF(() => {
          centerTrack(leftTrackRef.current, leftItemRefs.current, false);
          centerTrack(rightTrackRef.current, rightItemRefs.current, true);
        });
      });
    };

    const measureRAF = (fn: () => void) => {
      if (typeof window === "undefined") return;
      requestAnimationFrame(() => requestAnimationFrame(fn));
    };

    // ========================================================================
    // SCROLLTRIGGER SETUP
    // ========================================================================
    useLayoutEffect(() => {
      if (typeof window === "undefined") return;
      const fixed = fixedRef.current;
      const fs = fixedSectionRef.current;
      if (!fixed || !fs || total === 0) return;

      gsap.set(bgRefs.current, { opacity: 0, scale: 1.04, yPercent: 0 });
      if (bgRefs.current[0]) gsap.set(bgRefs.current[0], { opacity: 1, scale: 1 });

      wordRefs.current.forEach((words, sIdx) => {
        words.forEach((w) => {
          gsap.set(w, {
            yPercent: sIdx === index ? 0 : 100,
            opacity: sIdx === index ? 1 : 0,
          });
        });
      });

      // Initialize descriptions
      descriptionRefs.current.forEach((desc, sIdx) => {
        if (desc) {
          gsap.set(desc, {
            opacity: sIdx === index ? 1 : 0,
            y: sIdx === index ? 0 : 30,
          });
        }
      });

      computePositions();
      measureAndCenterLists(index, false);

      const st = ScrollTrigger.create({
        trigger: fs,
        start: "top top",
        end: "bottom bottom",
        pin: fixed,
        pinSpacing: true,
        onUpdate: (self) => {
          if (motionOff || isSnappingRef.current) return;
          const prog = self.progress;
          const target = Math.min(total - 1, Math.floor(prog * total));
          if (target !== lastIndexRef.current && !isAnimatingRef.current) {
            const next = lastIndexRef.current + (target > lastIndexRef.current ? 1 : -1);
            goTo(next, false);
          }
          if (progressFillRef.current) {
            const p = (lastIndexRef.current / (total - 1 || 1)) * 100;
            progressFillRef.current.style.width = `${p}%`;
          }
        },
      });

      stRef.current = st;

      if (initialIndex && initialIndex > 0 && initialIndex < total) {
        requestAnimationFrame(() => goTo(initialIndex, false));
      }

      const ro = new ResizeObserver(() => {
        computePositions();
        measureAndCenterLists(lastIndexRef.current, false);
        ScrollTrigger.refresh();
      });
      ro.observe(fs);

      return () => {
        ro.disconnect();
        st.kill();
        stRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [total, initialIndex, motionOff, bgTransition, parallaxAmount]);

    // ========================================================================
    // SECTION CHANGE
    // ========================================================================
    const changeSection = (to: number) => {
      if (to === lastIndexRef.current || isAnimatingRef.current) return;
      const from = lastIndexRef.current;
      const down = to > from;
      isAnimatingRef.current = true;

      if (!isControlled) setLocalIndex(to);
      onIndexChange?.(to);

      if (currentNumberRef.current) {
        currentNumberRef.current.textContent = String(to + 1).padStart(2, "0");
      }
      if (progressFillRef.current) {
        const p = (to / (total - 1 || 1)) * 100;
        progressFillRef.current.style.width = `${p}%`;
      }

      const D = durations.change ?? 0.7;

      // Title words animation
      const outWords = wordRefs.current[from] || [];
      const inWords = wordRefs.current[to] || [];
      
      if (outWords.length) {
        gsap.to(outWords, {
          yPercent: down ? -100 : 100,
          opacity: 0,
          duration: D * 0.6,
          stagger: down ? 0.03 : -0.03,
          ease: "power3.out",
        });
      }
      
      if (inWords.length) {
        gsap.set(inWords, { yPercent: down ? 100 : -100, opacity: 0 });
        gsap.to(inWords, {
          yPercent: 0,
          opacity: 1,
          duration: D,
          stagger: down ? 0.05 : -0.05,
          ease: "power3.out",
        });
      }

      // Description animation [web:21][web:22]
      const outDesc = descriptionRefs.current[from];
      const inDesc = descriptionRefs.current[to];
      
      if (outDesc) {
        gsap.to(outDesc, {
          opacity: 0,
          y: down ? -20 : 20,
          duration: D * 0.5,
          ease: "power2.out",
        });
      }
      
      if (inDesc) {
        gsap.set(inDesc, { opacity: 0, y: down ? 30 : -30 });
        gsap.to(inDesc, {
          opacity: 1,
          y: 0,
          duration: D * 0.8,
          delay: D * 0.3,
          ease: "power2.out",
        });
      }

      // Backgrounds
      const prevBg = bgRefs.current[from];
      const newBg = bgRefs.current[to];
      
      if (bgTransition === "fade") {
        if (newBg) {
          gsap.set(newBg, { opacity: 0, scale: 1.04, yPercent: down ? 1 : -1 });
          gsap.to(newBg, { opacity: 1, scale: 1, yPercent: 0, duration: D, ease: "power2.out" });
        }
        if (prevBg) {
          gsap.to(prevBg, {
            opacity: 0,
            yPercent: down ? -parallaxAmount : parallaxAmount,
            duration: D,
            ease: "power2.out",
          });
        }
      } else {
        if (newBg) {
          gsap.set(newBg, {
            opacity: 1,
            clipPath: down ? "inset(100% 0 0 0)" : "inset(0 0 100% 0)",
            scale: 1,
            yPercent: 0,
          });
          gsap.to(newBg, { clipPath: "inset(0 0 0 0)", duration: D, ease: "power3.out" });
        }
        if (prevBg) {
          gsap.to(prevBg, { opacity: 0, duration: D * 0.8, ease: "power2.out" });
        }
      }

      measureAndCenterLists(to, true);

      leftItemRefs.current.forEach((el, i) => {
        if (!el) return;
        el.classList.toggle("active", i === to);
        gsap.to(el, {
          opacity: i === to ? 1 : 0.35,
          x: i === to ? 10 : 0,
          duration: D * 0.6,
          ease: "power3.out",
        });
      });
      
      rightItemRefs.current.forEach((el, i) => {
        if (!el) return;
        el.classList.toggle("active", i === to);
        gsap.to(el, {
          opacity: i === to ? 1 : 0.35,
          x: i === to ? -10 : 0,
          duration: D * 0.6,
          ease: "power3.out",
        });
      });

      gsap.delayedCall(D, () => {
        lastIndexRef.current = to;
        isAnimatingRef.current = false;
      });
    };

    // ========================================================================
    // NAVIGATION
    // ========================================================================
    const goTo = (to: number, withScroll = true) => {
      const clamped = clamp(to, 0, total - 1);
      isSnappingRef.current = true;
      changeSection(clamped);

      const pos = sectionTopRef.current[clamped];
      const snapMs = durations.snap ?? 800;

      if (withScroll && typeof window !== "undefined") {
        window.scrollTo({ top: pos, behavior: "smooth" });
        setTimeout(() => (isSnappingRef.current = false), snapMs);
      } else {
        setTimeout(() => (isSnappingRef.current = false), 10);
      }
    };

    const next = () => goTo(index + 1);
    const prev = () => goTo(index - 1);

    useImperativeHandle(apiRef, () => ({
      next,
      prev,
      goTo,
      getIndex: () => index,
      refresh: () => ScrollTrigger.refresh(),
    }));

    const handleJump = (i: number) => goTo(i);
    
    const handleLoadedStagger = () => {
      leftItemRefs.current.forEach((el, i) => {
        if (!el) return;
        gsap.fromTo(
          el,
          { opacity: 0, y: 20 },
          { opacity: i === index ? 1 : 0.35, y: 0, duration: 0.5, delay: i * 0.06, ease: "power3.out" }
        );
      });
      rightItemRefs.current.forEach((el, i) => {
        if (!el) return;
        gsap.fromTo(
          el,
          { opacity: 0, y: 20 },
          { opacity: i === index ? 1 : 0.35, y: 0, duration: 0.5, delay: 0.2 + i * 0.06, ease: "power3.out" }
        );
      });
    };

    useEffect(() => {
      if (hasEntered) {
        handleLoadedStagger();
        measureAndCenterLists(index, false);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasEntered]);

    // ========================================================================
    // CSS VARIABLES
    // ========================================================================
    const cssVars: CSSProperties = {
      ["--fx-font" as any]: fontFamily,
      ["--fx-text" as any]: colors.text ?? "rgba(245,245,245,0.95)",
      ["--fx-overlay" as any]: colors.overlay ?? "rgba(0,0,0,0.5)",
      ["--fx-page-bg" as any]: colors.pageBg ?? "#000",
      ["--fx-stage-bg" as any]: colors.stageBg ?? "#000",
      ["--fx-gap" as any]: `${gap}rem`,
      ["--fx-grid-px" as any]: `${gridPaddingX}rem`,
      ["--fx-row-gap" as any]: "10px",
    };

    // ========================================================================
    // RENDER
    // ========================================================================
    const hasLeftLabels = sections.some(s => s.leftLabel);
    const hasRightLabels = sections.some(s => s.rightLabel);

    return (
      <div
        ref={(node) => {
          (rootRef as any).current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }}
        className={["fx", className].filter(Boolean).join(" ")}
        style={{ ...cssVars, ...style }}
        aria-label={ariaLabel}
      >
        {/* Entrance Overlay */}
        {showEntranceTransition && (
          <div ref={entranceOverlayRef} className="fx-entrance-overlay" />
        )}

        {debug && <div className="fx-debug">Section: {index}</div>}

        <div className="fx-scroll">
          <div className="fx-fixed-section" ref={fixedSectionRef}>
            <div className="fx-fixed" ref={fixedRef}>
              {/* Backgrounds */}
              <div className="fx-bgs" aria-hidden="true">
                {sections.map((s, i) => (
                  <div className="fx-bg" key={s.id ?? i}>
                    {s.renderBackground ? (
                      s.renderBackground(index === i, lastIndexRef.current === i)
                    ) : (
                      <>
                        <img
                          ref={(el) => el && (bgRefs.current[i] = el)}
                          src={s.background}
                          alt=""
                          className="fx-bg-img"
                        />
                        <div className="fx-bg-overlay" />
                      </>
                    )}
                  </div>
                ))}
              </div>

              {/* Grid */}
              <div className="fx-grid">
                {header && <div className="fx-header">{header}</div>}

                <div className="fx-content">
                  {/* Left List - Only if labels exist */}
                  {hasLeftLabels && (
                    <div className="fx-left" role="list">
                      <div className="fx-track" ref={leftTrackRef}>
                        {sections.map((s, i) => (
                          <div
                            key={`L-${s.id ?? i}`}
                            className={`fx-item fx-left-item ${i === index ? "active" : ""}`}
                            ref={(el) => el && (leftItemRefs.current[i] = el)}
                            onClick={() => handleJump(i)}
                            role="button"
                            tabIndex={0}
                            aria-pressed={i === index}
                          >
                            {s.leftLabel}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Center Content */}
                  <div className={`fx-center ${!hasLeftLabels && !hasRightLabels ? 'fx-center-full' : ''}`}>
                    {sections.map((s, sIdx) => {
                      tempWordBucket.current = [];
                      const isString = typeof s.title === "string";
                      return (
                        <div key={`C-${s.id ?? sIdx}`} className={`fx-featured ${sIdx === index ? "active" : ""}`}>
                          <h3 className="fx-featured-title">
                            {isString ? splitWords(s.title as string) : s.title}
                          </h3>
                          <WordsCollector
                            onReady={() => {
                              if (tempWordBucket.current.length) {
                                wordRefs.current[sIdx] = [...tempWordBucket.current];
                              }
                              tempWordBucket.current = [];
                            }}
                          />
                          {/* Description */}
                          {s.description && (
                            <div 
                              className="fx-description" 
                              ref={(el) => el && (descriptionRefs.current[sIdx] = el)}
                            >
                              {s.description}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Right List - Only if labels exist */}
                  {hasRightLabels && (
                    <div className="fx-right" role="list">
                      <div className="fx-track" ref={rightTrackRef}>
                        {sections.map((s, i) => (
                          <div
                            key={`R-${s.id ?? i}`}
                            className={`fx-item fx-right-item ${i === index ? "active" : ""}`}
                            ref={(el) => el && (rightItemRefs.current[i] = el)}
                            onClick={() => handleJump(i)}
                            role="button"
                            tabIndex={0}
                            aria-pressed={i === index}
                          >
                            {s.rightLabel}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer + Progress */}
                <div className="fx-footer">
                  {footer && <div className="fx-footer-title">{footer}</div>}
                  {showProgress && (
                    <div className="fx-progress">
                      <div className="fx-progress-numbers">
                        <span ref={currentNumberRef}>{String(index + 1).padStart(2, "0")}</span>
                        <span>{String(total).padStart(2, "0")}</span>
                      </div>
                      <div className="fx-progress-bar">
                        <div className="fx-progress-fill" ref={progressFillRef} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="fx-end">
            <p className="fx-fin">•</p>
          </div>
        </div>

        <style jsx>{`
          .fx {
            width: 100%;
            overflow: hidden;
            background: var(--fx-page-bg);
            color: #000;
            font-family: var(--fx-font);
            letter-spacing: -0.01em;
          }

          .fx-entrance-overlay {
            position: fixed;
            inset: 0;
            background: #000000;
            z-index: 10000;
            pointer-events: none;
            opacity: 0;
          }

          .fx-debug {
            position: fixed;
            bottom: 10px;
            right: 10px;
            z-index: 9999;
            background: rgba(255, 255, 255, 0.8);
            color: #000;
            padding: 6px 8px;
            font: 12px/1 monospace;
            border-radius: 4px;
          }

          .fx-fixed-section {
            height: ${Math.max(1, total + 1)}00vh;
            position: relative;
          }
          
          .fx-fixed {
            position: sticky;
            top: 0;
            height: 100vh;
            width: 100%;
            overflow: hidden;
            background: var(--fx-page-bg);
          }

          .fx-grid {
            display: grid;
            grid-template-columns: repeat(12, 1fr);
            gap: var(--fx-gap);
            padding: 0 var(--fx-grid-px);
            position: relative;
            height: 100%;
            z-index: 2;
          }

          .fx-bgs {
            position: absolute;
            inset: 0;
            background: var(--fx-stage-bg);
            z-index: 1;
          }
          
          .fx-bg {
            position: absolute;
            inset: 0;
          }
          
          .fx-bg-img {
  position: absolute;
  inset: -10% 0 -10% 0;
  width: 100%;
  height: 120%;
  object-fit: cover;
  filter: brightness(1.1) contrast(1.05);
  opacity: 0;
  will-change: transform, opacity;
}

          
          .fx-bg-overlay {
  position: absolute;
  inset: 0;
  background: var(--fx-overlay);
  opacity: 0.6;
}


          .fx-header {
            grid-column: 1 / 13;
            align-self: start;
            padding-top: 6vh;
            font-size: clamp(2rem, 6vw, 5rem);
            line-height: 1.1;
            text-align: center;
            color: var(--fx-text);
            font-weight: 600;
            text-transform: none;
          }
          
          .fx-header > * {
            display: block;
          }

          .fx-content {
            grid-column: 1 / 13;
            position: absolute;
            inset: 0;
            display: grid;
            grid-template-columns: 1fr 2fr 1fr;
            align-items: center;
            height: 100%;
            padding: 0 var(--fx-grid-px);
          }

          .fx-left,
          .fx-right {
            height: 60vh;
            overflow: hidden;
            display: grid;
            align-content: center;
          }
          
          .fx-left {
            justify-items: start;
          }
          
          .fx-right {
            justify-items: end;
          }
          
          .fx-track {
            will-change: transform;
          }

          .fx-item {
            color: var(--fx-text);
            font-weight: 600;
            letter-spacing: 0em;
            line-height: 1.3;
            margin: calc(var(--fx-row-gap) / 2) 0;
            opacity: 0.35;
            transition: opacity 0.3s ease, transform 0.3s ease;
            position: relative;
            font-size: clamp(0.9rem, 1.8vw, 1.4rem);
            user-select: none;
            cursor: pointer;
            text-transform: none;
          }
          
          .fx-left-item.active,
          .fx-right-item.active {
            opacity: 1;
          }
          
          .fx-left-item.active {
            transform: translateX(10px);
            padding-left: 16px;
          }
          
          .fx-right-item.active {
            transform: translateX(-10px);
            padding-right: 16px;
          }

          .fx-left-item.active::before,
          .fx-right-item.active::after {
            content: "";
            position: absolute;
            top: 50%;
            transform: translateY(-50%);
            width: 6px;
            height: 6px;
            background: var(--fx-text);
            border-radius: 50%;
          }
          
          .fx-left-item.active::before {
            left: 0;
          }
          
          .fx-right-item.active::after {
            right: 0;
          }

          .fx-center {
            display: grid;
            place-items: center;
            text-align: center;
            height: 70vh;
            overflow: hidden;
            padding: 0 2rem;
          }

          .fx-center-full {
            grid-column: 1 / -1;
            max-width: 1200px;
            margin: 0 auto;
            width: 100%;
          }
          
          .fx-featured {
            position: absolute;
            opacity: 0;
            visibility: hidden;
            max-width: 100%;
          }
          
          .fx-featured.active {
            opacity: 1;
            visibility: visible;
          }
          
          .fx-featured-title {
            margin: 0 0 1.5rem 0;
            color: var(--fx-text);
            font-weight: 700;
            letter-spacing: -0.02em;
            font-size: clamp(2.5rem, 6vw, 5rem);
            line-height: 1.1;
            text-transform: none;
          }
          
          .fx-description {
            color: var(--fx-text);
            font-size: clamp(1rem, 1.8vw, 1.3rem);
            line-height: 1.7;
            max-width: 800px;
            margin: 0 auto;
            font-weight: 300;
            text-transform: none;
            opacity: 0.9;
          }

          .fx-description :global(p) {
            margin: 0.8rem 0;
          }

          .fx-description :global(strong) {
            font-weight: 600;
            color: rgba(255, 255, 255, 1);
          }
          
          .fx-word-mask {
            display: inline-block;
            overflow: hidden;
            vertical-align: middle;
          }
          
          .fx-word {
            display: inline-block;
            vertical-align: middle;
          }

          .fx-footer {
            grid-column: 1 / 13;
            align-self: end;
            padding-bottom: 4vh;
            text-align: center;
          }
          
          .fx-footer-title {
            color: var(--fx-text);
            font-size: clamp(1.2rem, 3vw, 2rem);
            font-weight: 600;
            letter-spacing: -0.01em;
            line-height: 1.2;
            margin-bottom: 1rem;
            text-transform: none;
          }
          
          .fx-progress {
            width: 200px;
            height: 2px;
            margin: 1rem auto 0;
            background: rgba(245, 245, 245, 0.2);
            position: relative;
          }
          
          .fx-progress-fill {
            position: absolute;
            inset: 0 auto 0 0;
            width: 0%;
            background: var(--fx-text);
            height: 100%;
            transition: width 0.3s ease;
          }
          
          .fx-progress-numbers {
            position: absolute;
            inset: auto 0 100% 0;
            display: flex;
            justify-content: space-between;
            font-size: 0.75rem;
            color: var(--fx-text);
            margin-bottom: 0.5rem;
            opacity: 0.7;
          }

          .fx-end {
            height: 100vh;
            display: grid;
            place-items: center;
            background: var(--fx-page-bg);
          }
          
          .fx-fin {
            color: var(--fx-text);
            font-size: 2rem;
            opacity: 0.3;
          }

          @media (max-width: 900px) {
            .fx-content {
              grid-template-columns: 1fr;
              row-gap: 2vh;
              place-items: center;
            }
            .fx-left,
            .fx-right,
            .fx-center {
              height: auto;
            }
            .fx-left,
            .fx-right {
              justify-items: center;
              display: none;
            }
            .fx-center {
              grid-column: 1 / -1;
              padding: 1rem;
            }
            .fx-description {
              font-size: clamp(0.95rem, 3vw, 1.1rem);
            }
            .fx-track {
              transform: none !important;
            }
          }
        `}</style>
      </div>
    );
  }
);

FullScreenScrollFX.displayName = "FullScreenScrollFX";
