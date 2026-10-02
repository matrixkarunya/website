// lib/heroStats.ts
import { useEffect, useState } from 'react';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface HeroStat {
  id: string;
  value: number;
  suffix: string; // e.g. "+", "K+", "%" or ""
  label: string; // e.g. "Workshops"
}

export interface HeroStatsData {
  title: string; // the small "Our Impact" heading
  stats: HeroStat[]; // always exactly HERO_STATS_COUNT items
}

export const HERO_STATS_COUNT = 4;

// Same collection as the MATRIX image: settings/heroStats
export const HERO_STATS_COLLECTION = 'settings';
export const HERO_STATS_DOC = 'heroStats';

/** Used until the admin publishes for the first time. Replace with your real numbers. */
export const DEFAULT_HERO_STATS: HeroStatsData = {
  title: 'Our Impact',
  stats: [
    { id: 'stat-1', value: 20, suffix: '+', label: 'Workshops' },
    { id: 'stat-2', value: 15, suffix: '+', label: 'Events' },
    { id: 'stat-3', value: 200, suffix: '+', label: 'Members' },
    { id: 'stat-4', value: 10, suffix: '+', label: 'Projects' },
  ],
};

/** Makes sure whatever is in Firestore always has a safe shape. */
export function normalizeHeroStats(raw: any): HeroStatsData {
  const stats: HeroStat[] = Array.from({ length: HERO_STATS_COUNT }, (_, i) => {
    const fallback = DEFAULT_HERO_STATS.stats[i];
    const s = raw?.stats?.[i];
    const value = Number(s?.value);
    return {
      id: fallback.id,
      value: Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback.value,
      suffix: typeof s?.suffix === 'string' ? s.suffix : fallback.suffix,
      label: typeof s?.label === 'string' && s.label.trim() ? s.label : fallback.label,
    };
  });
  const title =
    typeof raw?.title === 'string' && raw.title.trim() ? raw.title : DEFAULT_HERO_STATS.title;
  return { title, stats };
}

export async function saveHeroStats(data: HeroStatsData): Promise<void> {
  const clean = normalizeHeroStats(data);
  await setDoc(doc(db, HERO_STATS_COLLECTION, HERO_STATS_DOC), {
    ...clean,
    updatedAt: serverTimestamp(),
  });
}

/** For the public hero: live values, falling back to defaults while loading or on error. */
export function useHeroStats() {
  const [data, setData] = useState<HeroStatsData>(DEFAULT_HERO_STATS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onSnapshot(
      doc(db, HERO_STATS_COLLECTION, HERO_STATS_DOC),
      (snap) => {
        setData(snap.exists() ? normalizeHeroStats(snap.data()) : DEFAULT_HERO_STATS);
        setLoading(false);
      },
      (err) => {
        console.error('Failed to load hero stats:', err);
        setLoading(false); // falls back silently to the defaults
      }
    );
  }, []);

  return { data, loading };
}