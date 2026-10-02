// lib/timeline.ts
// Shared by the public TimelineSection and the admin timeline page.

export interface TimelineEntry {
  id: string; // doc id === String(year)
  year: number;
  tag: string; // e.g. "Growth" -> shown as "Chapter 02 · Growth"
  title: string;
  body: string;
  events: number;
  badge?: string | null;
  createdAt: any;
  updatedAt: any;
}

export interface Chapter {
  year: string;
  academicYear: string;
  chapter: string;
  title: string;
  body: string;
  events: number;
  badge?: string;
}

// Max characters (enforced in admin inputs, sized to fit the card layout)
export const TIMELINE_LIMITS = {
  tag: 24,
  title: 30,
  body: 180,
  badge: 12,
  eventsMax: 999,
} as const;

// 2023 is the fixed starting chapter and lives in code, not in the database.
export const START_YEAR = 2023;
export const FIRST_EDITABLE_YEAR = START_YEAR + 1;
export const REBRAND_YEAR = 2025; // MATRIX ghost word takes over from this year

export const academicYearLabel = (y: number) =>
  `Academic Year ${y}–${String((y + 1) % 100).padStart(2, '0')}`;

export const chapterLabel = (number: number, tag: string) =>
  `Chapter ${String(number).padStart(2, '0')} · ${tag}`;

export const START_CHAPTER: Chapter = {
  year: String(START_YEAR),
  academicYear: academicYearLabel(START_YEAR),
  chapter: chapterLabel(1, 'The Beginning'),
  title: 'Born as AIMS',
  body: 'A small group of students came together and founded AIMS — the seed of everything that followed. Year one: 4 events.',
  events: 4,
};

/** 2023 (fixed) + every admin entry after it, sorted by year. */
export function buildChapters(entries: TimelineEntry[]): Chapter[] {
  const sorted = entries
    .filter((e) => e.year >= FIRST_EDITABLE_YEAR)
    .sort((a, b) => a.year - b.year);

  return [
    START_CHAPTER,
    ...sorted.map((e, i) => ({
      year: String(e.year),
      academicYear: academicYearLabel(e.year),
      chapter: chapterLabel(i + 2, e.tag),
      title: e.title,
      body: e.body,
      events: e.events,
      ...(e.badge ? { badge: e.badge } : {}),
    })),
  ];
}