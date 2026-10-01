// components/EventsSection.tsx
"use client";

import { useState, useEffect, useRef, memo } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { MapPin, ArrowUpRight, ArrowRight } from "lucide-react";
import { EventItem, formatEventDate, getEventCardUrl } from "@/lib/events";

const HOME_EVENT_LIMIT = 4;
const textShadow = "0 2px 12px rgba(0,0,0,0.85), 0 1px 3px rgba(0,0,0,1)";

// ── Event card (same look as the Events page, without the number badge) ──────
const HomeEventCard = memo(function HomeEventCard({
  event,
  index,
}: {
  event: EventItem;
  index: number;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Cached images can finish before React attaches onLoad
  useEffect(() => {
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth > 0) setLoaded(true);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, filter: "blur(12px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-8%" }}
      transition={{
        duration: 0.7,
        ease: [0.22, 1, 0.36, 1],
        delay: Math.min(index * 0.08, 0.3),
      }}
    >
      <Link href={`/Events/${event.id}`} className="group block">
        <div className="relative aspect-[16/10] w-full rounded-2xl overflow-hidden border border-white/10 bg-white/5">
          {!loaded && !failed && (
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-white/5 animate-pulse" />
          )}

          {failed && (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-indigo-900/40 to-purple-900/40">
              <span className="text-xs text-white/40">Image unavailable</span>
            </div>
          )}

          {!failed && (
            <Image
              ref={imgRef}
              src={getEventCardUrl(event.imageUrl)}
              alt={event.title}
              fill
              unoptimized
              sizes="(max-width: 768px) 100vw, 50vw"
              onLoad={() => setLoaded(true)}
              onError={() => setFailed(true)}
              className={`object-cover transition-[opacity,transform] duration-700 group-hover:scale-105 ${
                loaded ? "opacity-100" : "opacity-0"
              }`}
            />
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent pointer-events-none" />

          <div className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center bg-black/40 backdrop-blur-md border border-white/30 text-white transition-all duration-300 group-hover:bg-white group-hover:text-black group-hover:rotate-12">
            <ArrowUpRight className="w-5 h-5" />
          </div>
        </div>

        <div className="px-2 pt-5">
          <p
            className="text-xs font-semibold text-white/55 mb-2"
            style={{ textShadow }}
          >
            {event.category}
          </p>
          <h3
            className="text-2xl md:text-3xl font-bold text-white mb-4 group-hover:text-white/90 transition-colors"
            style={{ textShadow }}
          >
            {event.title}
          </h3>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-white/60">
            <span>{formatEventDate(event.date)}</span>
            <span className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              {event.venue}
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
});

// ── Section ───────────────────────────────────────────────────────────────────
export default function EventsSection() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Only fetch what the home page shows: the 4 latest events
    const q = query(
      collection(db, "events"),
      orderBy("date", "desc"),
      limit(HOME_EVENT_LIMIT)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: EventItem[] = [];
        snap.forEach((d) =>
          list.push({ id: d.id, ...d.data() } as EventItem)
        );
        setEvents(list);
        setLoading(false);
      },
      (error) => {
        console.error("Home events listener error:", error);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // Nothing to show: hide the whole section instead of an empty heading
  if (!loading && events.length === 0) return null;

  return (
    <section className="relative w-full isolate overflow-hidden flex items-center justify-center px-4 sm:px-6 md:px-8 lg:px-12 py-12 sm:py-16 md:py-20">
      {/* Same background recipe as the About section: the page-level fixed
          Dither shows through, with a dark tint + one blur layer on top. */}
      <div
        aria-hidden
        className="absolute inset-0 w-full h-full -z-20 pointer-events-none"
        style={{ transform: "translateZ(0)", contain: "paint" }}
      >
        <div className="absolute inset-0 bg-black/50" />
        <div className="absolute inset-0 backdrop-blur-sm bg-white/[0.03]" />
      </div>

      {/* Radial vignette (identical to About) */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none -z-10"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.65) 100%)",
        }}
      />

      <div className="relative z-10 max-w-6xl w-full mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: 16, filter: "blur(12px)" }}
          whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          viewport={{ once: true, margin: "-8%" }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-8 sm:mb-10 md:mb-12 text-center leading-tight"
          style={{ textShadow }}
        >
          Our Events
        </motion.h2>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-14">
            {Array.from({ length: HOME_EVENT_LIMIT }).map((_, i) => (
              <div key={i}>
                <div className="aspect-[16/10] w-full rounded-2xl bg-white/5 border border-white/10 animate-pulse" />
                <div className="px-2 pt-5 space-y-3">
                  <div className="h-3 w-24 rounded bg-white/10 animate-pulse" />
                  <div className="h-7 w-3/4 rounded bg-white/10 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-14">
            {events.map((event, i) => (
              <HomeEventCard key={event.id} event={event} index={i} />
            ))}
          </div>
        )}

        <div className="flex justify-center pt-12">
          <Link
            href="/Events"
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all group"
            style={{
              background: "rgba(255,255,255,0.10)",
              border: "1.5px solid rgba(255,255,255,0.20)",
              backdropFilter: "blur(20px)",
              color: "#ffffff",
              boxShadow:
                "0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.15)",
              textShadow,
            }}
          >
            View more events
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </section>
  );
}