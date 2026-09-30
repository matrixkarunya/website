// app/Events/page.tsx
'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  MapPin,
  ArrowUpRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Dither from '@/components/ui/Dither';
import {
  EventItem,
  EventCategory,
  MONTHS,
  formatEventDate,
  getMonthName,
  getEventCardUrl,
} from '@/lib/events';

const PAGE_SIZE = 6;

// ===== BACKGROUND =====
const LandingBackground = ({ className }: { className?: string }) => (
  <div className={cn('fixed inset-0 w-full h-full -z-10', className)}>
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
    <div className="absolute inset-0 bg-black/50 z-10" />
    <div className="absolute inset-0 backdrop-blur-sm bg-white/3 z-20" />
  </div>
);

// ===== FILTER DROPDOWN =====
function FilterDropdown({
  label,
  options,
  value,
  onChange,
  allLabel,
  badgeFirst,
}: {
  label: string;
  options: string[];
  value: string; // '' = all
  onChange: (v: string) => void;
  allLabel: string;
  badgeFirst?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const all = ['', ...options];

  return (
    <div ref={ref} className="relative w-full sm:w-auto">
      <button
        onClick={() => setIsOpen((o) => !o)}
        className="flex items-center justify-between gap-3 w-full sm:min-w-[190px] px-4 py-2.5 bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl text-white hover:bg-white/10 hover:border-white/20 transition-all shadow-lg"
      >
        <div className="flex flex-col items-start leading-tight">
          <span className="text-[10px] uppercase tracking-wider text-white/40">{label}</span>
          <span className="text-sm font-medium">{value || allLabel}</span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-white/60 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="absolute top-full mt-2 w-full min-w-[190px] bg-white/10 backdrop-blur-2xl border border-white/20 rounded-xl shadow-2xl overflow-hidden z-50"
          >
            <div className="py-1 max-h-[280px] overflow-y-auto">
              {all.map((opt, i) => {
                const selected = opt === value;
                return (
                  <button
                    key={opt || 'all'}
                    onClick={() => {
                      onChange(opt);
                      setIsOpen(false);
                    }}
                    className={`w-full px-4 py-2.5 text-left text-sm flex items-center justify-between transition-colors ${
                      selected
                        ? 'bg-white/20 text-white font-medium'
                        : 'text-white/70 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span>{opt || allLabel}</span>
                      {badgeFirst && i === 1 && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded-full border border-blue-400/30">
                          {badgeFirst}
                        </span>
                      )}
                    </div>
                    {selected && <Check className="w-4 h-4" />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ===== EVENT CARD =====
function EventCard({ event, number, index }: { event: EventItem; number: number; index: number }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // If the image was cached / finished before React attached onLoad, show it right away
  useEffect(() => {
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth > 0) setLoaded(true);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
    >
      <Link href={`/Events/${event.id}`} className="group block">
        <div className="relative aspect-[16/10] w-full rounded-2xl overflow-hidden border border-white/10 bg-white/5">
          {/* Skeleton while loading */}
          {!loaded && !failed && (
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-white/5 animate-pulse" />
          )}

          {/* Fallback if the image can't load */}
          {failed && (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-indigo-900/40 to-purple-900/40">
              <span className="text-xs tracking-widest uppercase text-white/40">
                Image unavailable
              </span>
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
              priority={index < 2}
              onLoad={() => setLoaded(true)}
              onError={() => setFailed(true)}
              className={`object-cover transition-[opacity,transform] duration-700 group-hover:scale-105 ${
                loaded ? 'opacity-100' : 'opacity-0'
              }`}
            />
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent pointer-events-none" />

          <span className="absolute top-5 left-6 text-sm font-semibold tracking-widest text-white/90 drop-shadow">
            {String(number).padStart(2, '0')}
          </span>

          <div className="absolute top-5 right-5 w-11 h-11 rounded-full flex items-center justify-center bg-black/40 backdrop-blur-md border border-white/30 text-white transition-all duration-300 group-hover:bg-white group-hover:text-black group-hover:rotate-12">
            <ArrowUpRight className="w-5 h-5" />
          </div>
        </div>

        <div className="px-2 pt-6">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-white/50 mb-3">
            {event.category}
          </p>
          <h3 className="text-3xl md:text-4xl font-bold text-white mb-6 group-hover:text-white/90 transition-colors">
            {event.title}
          </h3>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-white/50">
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
}

// ===== PAGINATION =====
function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;

  const btn =
    'w-10 h-10 flex items-center justify-center rounded-xl text-sm font-medium border transition-all';

  return (
    <div className="flex items-center justify-center gap-2 mt-16">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
        className={`${btn} bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:pointer-events-none`}
        aria-label="Previous page"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`${btn} ${
            p === page
              ? 'bg-white/20 border-white/30 text-white shadow-lg'
              : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white'
          }`}
        >
          {p}
        </button>
      ))}

      <button
        onClick={() => onChange(page + 1)}
        disabled={page === totalPages}
        className={`${btn} bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:pointer-events-none`}
        aria-label="Next page"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

// ===== EVENTS PAGE =====
export default function EventsPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [categories, setCategories] = useState<EventCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);

  // Live events (latest first)
  useEffect(() => {
    const q = query(collection(db, 'events'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: EventItem[] = [];
        snapshot.forEach((d) => list.push({ id: d.id, ...d.data() } as EventItem));
        setEvents(list);
        setLoading(false);
      },
      (error) => {
        console.error('Events listener error:', error);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Live categories (managed from admin)
  useEffect(() => {
    const q = query(collection(db, 'eventCategories'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: EventCategory[] = [];
      snapshot.forEach((d) => list.push({ id: d.id, ...d.data() } as EventCategory));
      setCategories(list);
    });
    return () => unsubscribe();
  }, []);

  const academicYears = useMemo(
    () =>
      [...new Set(events.map((e) => e.academicYear))]
        .filter(Boolean)
        .sort()
        .reverse(),
    [events]
  );

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return events.filter((e) => {
      if (
        q &&
        !(
          e.title.toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q) ||
          e.venue.toLowerCase().includes(q)
        )
      )
        return false;
      if (year && e.academicYear !== year) return false;
      if (month && getMonthName(e.date) !== month) return false;
      if (category && e.category !== category) return false;
      return true;
    });
  }, [events, searchQuery, year, month, category]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageEvents = filtered.slice(start, start + PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, year, month, category]);

  const handlePageChange = (p: number) => {
    setPage(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const hasFilters = searchQuery || year || month || category;
  const clearAll = () => {
    setSearchQuery('');
    setYear('');
    setMonth('');
    setCategory('');
  };

  if (loading) {
    return (
      <>
        <LandingBackground />
        <div className="relative min-h-screen flex items-center justify-center">
          <div className="flex items-center gap-3">
            {[0, 150, 300].map((d) => (
              <div
                key={d}
                className="w-2 h-2 bg-white/80 rounded-full animate-bounce"
                style={{ animationDelay: `${d}ms` }}
              />
            ))}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <LandingBackground />

      <div className="relative min-h-screen">
        <main className="max-w-7xl mx-auto px-6 pt-24 pb-16 flex flex-col items-center">
          {/* Filter bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-5xl mb-12"
          >
            <div className="flex flex-col lg:flex-row items-stretch gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <input
                  type="text"
                  placeholder="Search events..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-full min-h-[52px] pl-11 pr-10 text-sm bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20 transition-all shadow-lg"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10 rounded-md transition-colors group"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5 text-white/40 group-hover:text-white/70" />
                  </button>
                )}
              </div>

              <FilterDropdown
                label="Academic Year"
                options={academicYears}
                value={year}
                onChange={setYear}
                allLabel="All Years"
                badgeFirst="Latest"
              />
              <FilterDropdown
                label="Month"
                options={MONTHS}
                value={month}
                onChange={setMonth}
                allLabel="All Months"
              />
              <FilterDropdown
                label="Category"
                options={categories.map((c) => c.name)}
                value={category}
                onChange={setCategory}
                allLabel="All Categories"
              />
            </div>

            <div className="flex items-center justify-between mt-4 px-1">
              <p className="text-xs text-white/50">
                {filtered.length} event{filtered.length !== 1 ? 's' : ''}
              </p>
              {hasFilters && (
                <button
                  onClick={clearAll}
                  className="text-xs text-blue-300 hover:text-blue-200 transition-colors"
                >
                  Clear all filters
                </button>
              )}
            </div>
          </motion.div>

          {/* Grid */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`${safePage}-${searchQuery}-${year}-${month}-${category}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="w-full"
            >
              {pageEvents.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-16 w-full">
                  {pageEvents.map((event, i) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      number={start + i + 1}
                      index={i}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-24">
                  <p className="text-white/60 mb-2 text-lg">
                    {events.length === 0 ? 'No events yet' : 'No events found'}
                  </p>
                  <p className="text-sm text-white/40">
                    {events.length === 0
                      ? 'Check back soon for upcoming events'
                      : 'Try adjusting your search or filters'}
                  </p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <Pagination page={safePage} totalPages={totalPages} onChange={handlePageChange} />
        </main>
      </div>
    </>
  );
}