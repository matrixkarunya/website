// app/hall-of-fame/page.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { ArrowRight, Search, Star, Trophy, X } from 'lucide-react';
import { db } from '@/lib/firebase';
import {
  ACHIEVEMENTS_COLLECTION,
  Achievement,
  formatDate,
  stackPeople,
  summarizeWinners,
  toAchievement,
  yearOf,
} from '@/lib/hallOfFame';
import {
  AvatarStack,
  LoadingDots,
  PageBackground,
  RankPill,
  glassCard,
  textShadow,
} from '@/components/hall-of-fame/shared';

/* ────────────────────────── Building blocks ────────────────────────── */

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition-colors"
      style={{
        color: active ? '#ffffff' : 'rgba(255,255,255,0.62)',
        background: active ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.06)',
        border: `1px solid ${active ? 'rgba(255,255,255,0.40)' : 'rgba(255,255,255,0.14)'}`,
      }}
    >
      {children}
    </button>
  );
}

function CoverImage({ a, sizes }: { a: Achievement; sizes: string }) {
  const [failed, setFailed] = useState(false);

  if (!a.coverImageUrl || failed) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-white/5">
        <Trophy className="h-10 w-10" style={{ color: 'rgba(255,255,255,0.22)' }} />
      </div>
    );
  }
  return (
    <Image
      src={a.coverImageUrl}
      alt=""
      fill
      sizes={sizes}
      onError={() => setFailed(true)}
      className="object-cover"
    />
  );
}

function WinnersPreview({ a }: { a: Achievement }) {
  const { primary, secondary } = summarizeWinners(a);
  const single = a.winners.length === 1 ? a.winners[0] : null;

  return (
    <div className="flex items-center gap-3">
      {/* Teams show their members' photos; individuals show themselves */}
      <AvatarStack winners={stackPeople(a)} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-bold text-white" style={{ textShadow }}>
            {primary}
          </p>
          {a.showRanks && single?.rank && <RankPill>{single.rank}</RankPill>}
        </div>
        {secondary && (
          <p className="truncate text-xs" style={{ color: 'rgba(255,255,255,0.48)' }}>
            {secondary}
          </p>
        )}
      </div>
    </div>
  );
}

function AchievementCard({ a, index }: { a: Achievement; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.05, 0.3) }}
      whileHover={{ y: -3 }}
      className="h-full"
    >
      <Link
        href={`/hall-of-fame/${a.id}`}
        className="group relative flex h-full flex-col overflow-hidden rounded-3xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
        style={glassCard}
      >
        <div className="relative h-40 w-full shrink-0 overflow-hidden">
          <CoverImage a={a} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" />
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/60 to-transparent" />
          {a.featured && (
            <span
              className="absolute left-3 top-3 flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white"
              style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)' }}
            >
              <Star className="h-3 w-3 fill-current" />
              Featured
            </span>
          )}
          <span
            className="absolute right-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)' }}
          >
            {a.category}
          </span>
        </div>

        <div className="flex flex-1 flex-col gap-3 p-5">
          <div>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.48)' }}>
              {formatDate(a.date)}
            </p>
            <h3
              className="mt-1 line-clamp-2 text-base font-bold leading-snug text-white"
              style={{ textShadow }}
            >
              {a.title}
            </h3>
            {a.summary && (
              <p className="mt-1.5 line-clamp-2 text-sm" style={{ color: 'rgba(255,255,255,0.62)' }}>
                {a.summary}
              </p>
            )}
          </div>

          <div
            className="mt-auto pt-4"
            style={{ borderTop: '1px solid rgba(255,255,255,0.10)' }}
          >
            <WinnersPreview a={a} />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function Spotlight({ a }: { a: Achievement }) {
  const { primary, secondary } = summarizeWinners(a);
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link
        href={`/hall-of-fame/${a.id}`}
        className="group grid overflow-hidden rounded-3xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 md:grid-cols-2"
        style={glassCard}
      >
        <div className="relative h-56 w-full md:h-full md:min-h-[300px]">
          <CoverImage a={a} sizes="(min-width: 768px) 50vw, 100vw" />
        </div>
        <div className="flex flex-col justify-center gap-4 p-6 sm:p-8">
          <span
            className="flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white"
            style={{ background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.25)' }}
          >
            <Star className="h-3 w-3 fill-current" />
            Spotlight
          </span>
          <div>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>
              {[formatDate(a.date), a.category].filter(Boolean).join(' · ')}
            </p>
            <h2
              className="mt-1.5 text-2xl font-black leading-tight text-white sm:text-3xl"
              style={{ textShadow }}
            >
              {a.title}
            </h2>
            {a.summary && (
              <p className="mt-2 text-sm leading-relaxed sm:text-base" style={{ color: 'rgba(255,255,255,0.72)' }}>
                {a.summary}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <AvatarStack winners={stackPeople(a)} size={40} />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white" style={{ textShadow }}>
                {primary}
              </p>
              {secondary && (
                <p className="truncate text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  {secondary}
                </p>
              )}
            </div>
          </div>
          <span className="flex items-center gap-1.5 text-sm font-semibold text-white">
            See the full story
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </span>
        </div>
      </Link>
    </motion.div>
  );
}

/* ─────────────────────────────── Page ─────────────────────────────── */

export default function HallOfFamePage() {
  const [items, setItems] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [year, setYear] = useState('all');
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const q = query(collection(db, ACHIEVEMENTS_COLLECTION), orderBy('date', 'desc'));
    return onSnapshot(
      q,
      (snap) => {
        setItems(snap.docs.map((d) => toAchievement(d.id, d.data())));
        setLoading(false);
      },
      (err) => {
        console.error('Error loading Hall of Fame:', err);
        setError(true);
        setLoading(false);
      }
    );
  }, []);

  const years = useMemo(() => [...new Set(items.map((a) => yearOf(a.date)))], [items]);
  const categories = useMemo(() => [...new Set(items.map((a) => a.category))].sort(), [items]);

  const filtersActive = year !== 'all' || category !== 'all' || search.trim() !== '';

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((a) => {
      if (year !== 'all' && yearOf(a.date) !== year) return false;
      if (category !== 'all' && a.category !== category) return false;
      if (!q) return true;
      return [
        a.title,
        a.organizer,
        a.category,
        ...a.winners.flatMap((w) => [w.name, ...w.members.map((m) => m.name)]),
      ].some((v) => v?.toLowerCase().includes(q));
    });
  }, [items, year, category, search]);

  // The latest featured achievement gets the banner (hidden while filtering).
  // It also stays in the normal feed below.
  const spotlight = !filtersActive ? items.find((a) => a.featured) ?? null : null;

  const groups = useMemo(() => {
    const map = new Map<string, Achievement[]>();
    filtered.forEach((a) => {
      const y = yearOf(a.date);
      map.set(y, [...(map.get(y) ?? []), a]);
    });
    return [...map.entries()];
  }, [filtered]);

  const clearFilters = () => {
    setYear('all');
    setCategory('all');
    setSearch('');
  };

  if (loading) {
    return (
      <>
        <PageBackground />
        <LoadingDots />
      </>
    );
  }

  return (
    <>
      <PageBackground />
      <div className="relative min-h-screen">
        <main className="mx-auto max-w-6xl px-4 pb-16 pt-16 sm:px-6 sm:pt-24">
          {/* Header */}
          <motion.div
            className="mb-10 flex flex-col items-center gap-3 text-center sm:mb-12"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <div
              className="flex items-center gap-2 rounded-full border border-white/20 px-4 py-1.5 backdrop-blur-sm"
              style={{ background: 'rgba(255,255,255,0.07)' }}
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/60" />
              <span
                className="text-[10px] font-semibold uppercase tracking-[0.22em]"
                style={{ color: 'rgba(255,255,255,0.62)', textShadow }}
              >
                Celebrating Our Community
              </span>
            </div>

            <h1
              className="text-3xl font-black tracking-tight text-white sm:text-4xl md:text-5xl lg:text-6xl"
              style={{ textShadow }}
            >
              Hall of Fame
            </h1>
          </motion.div>

          {error ? (
            <div className="py-20 text-center">
              <p className="mb-2 text-lg" style={{ color: 'rgba(255,255,255,0.55)' }}>
                We couldn&apos;t load the Hall of Fame
              </p>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Check your connection and refresh the page
              </p>
            </div>
          ) : items.length === 0 ? (
            <div className="py-20 text-center">
              <p className="mb-2 text-lg" style={{ color: 'rgba(255,255,255,0.55)' }}>
                No achievements yet
              </p>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Check back soon
              </p>
            </div>
          ) : (
            <>
              {spotlight && (
                <div className="mb-10">
                  <Spotlight a={spotlight} />
                </div>
              )}

              {/* Filters */}
              <div className="mb-8 space-y-3">
                <div className="relative mx-auto w-full max-w-md">
                  <Search
                    className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2"
                    style={{ color: 'rgba(255,255,255,0.4)' }}
                  />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setSearch('');
                    }}
                    placeholder="Search events or winners"
                    aria-label="Search the Hall of Fame"
                    className="w-full rounded-full py-2.5 pl-11 pr-10 text-base text-white placeholder:text-white/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 sm:text-sm [&::-webkit-search-cancel-button]:hidden"
                    style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)' }}
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      aria-label="Clear search"
                      className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full hover:bg-white/10"
                    >
                      <X className="h-4 w-4 text-white/60" />
                    </button>
                  )}
                </div>

                <div
                  className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:justify-center sm:overflow-visible"
                  role="group"
                  aria-label="Filter by year"
                >
                  <Chip active={year === 'all'} onClick={() => setYear('all')}>
                    All years
                  </Chip>
                  {years.map((y) => (
                    <Chip key={y} active={year === y} onClick={() => setYear(y)}>
                      {y}
                    </Chip>
                  ))}
                </div>

                {categories.length > 1 && (
                  <div
                    className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:justify-center sm:overflow-visible"
                    role="group"
                    aria-label="Filter by category"
                  >
                    <Chip active={category === 'all'} onClick={() => setCategory('all')}>
                      All categories
                    </Chip>
                    {categories.map((c) => (
                      <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
                        {c}
                      </Chip>
                    ))}
                  </div>
                )}
              </div>

              {/* Feed */}
              {filtered.length === 0 ? (
                <div className="py-16 text-center">
                  <p className="mb-2 text-lg" style={{ color: 'rgba(255,255,255,0.55)' }}>
                    Nothing matches those filters
                  </p>
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="text-sm font-semibold text-white underline underline-offset-4"
                  >
                    Clear filters
                  </button>
                </div>
              ) : (
                <div className="space-y-12">
                  {groups.map(([y, list]) => (
                    <section key={y} aria-label={y}>
                      <div className="mb-5 flex items-center gap-4">
                        <h2 className="text-2xl font-black text-white" style={{ textShadow }}>
                          {y}
                        </h2>
                        <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.14)' }} />
                      </div>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {list.map((a, i) => (
                          <AchievementCard key={a.id} a={a} index={i} />
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </>
  );
}