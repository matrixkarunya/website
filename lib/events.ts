// lib/events.ts
// Shared types + helpers for the Events feature (admin + public pages)

// A single gallery photo stored inside the event document
export interface MomentImage {
  url: string;
  publicId: string;
  addedAt?: number; // Date.now() at upload time
}

export interface EventItem {
  id: string;
  title: string;
  category: string;
  date: string; // ISO yyyy-mm-dd
  venue: string;
  imageUrl: string;
  imagePublicId: string;
  academicYear: string; // e.g. "2025-26" (derived from date)

  // Detail-page fields (optional so older events keep working)
  description?: string;
  participants?: number | null;
  duration?: string | null;
  moments?: MomentImage[];

  createdAt?: any;
  updatedAt?: any;
}

export interface EventCategory {
  id: string;
  name: string;
  createdAt?: any;
}

// Seeded the first time the admin opens the events page
export const DEFAULT_CATEGORIES = ['Hackathon', 'Exhibition', 'Workshop', 'Seminar'];

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// Academic year runs June -> May. e.g. Sep 2025 => "2025-26", Feb 2026 => "2025-26"
export const getAcademicYearFromDate = (iso: string): string => {
  const [y, m] = iso.split('-').map(Number); // avoids timezone shifts
  const start = m >= 6 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
};

// Timezone-safe date formatting (new Date('2026-09-18') can shift a day in some zones)
export const formatEventDate = (iso: string): string => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export const getWeekday = (iso: string): string => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'long' });
};

export const getMonthName = (iso: string): string => {
  const m = Number(iso.split('-')[1]);
  return MONTHS[m - 1];
};

// ===== Cloudinary URL helpers =====
// Same approach as the Team page: serve a Cloudinary-transformed image directly
// (resized + auto quality/format) instead of the raw original upload.
const isCloudinaryUploadUrl = (url: string) =>
  url.includes('res.cloudinary.com') && url.includes('/upload/');

const withTransform = (url: string, transform: string): string => {
  if (!url || !isCloudinaryUploadUrl(url)) return url;
  if (url.includes(`/upload/${transform}/`)) return url; // don't double-insert
  return url.replace('/upload/', `/upload/${transform}/`);
};

// Event list card: 16:10 crop
export const getEventCardUrl = (url: string) =>
  withTransform(url, 'c_fill,g_auto,w_1000,h_625,q_auto,f_auto');

// Admin grid card
export const getEventThumbUrl = (url: string) =>
  withTransform(url, 'c_fill,g_auto,w_600,h_375,q_auto,f_auto');

// Detail page hero
export const getEventFullUrl = (url: string) =>
  withTransform(url, 'c_limit,w_1800,q_auto,f_auto');

// Gallery tile (4:3 crop, three per row)
export const getMomentThumbUrl = (url: string) =>
  withTransform(url, 'c_fill,g_auto,w_700,h_525,q_auto,f_auto');

// Gallery lightbox
export const getMomentFullUrl = (url: string) =>
  withTransform(url, 'c_limit,w_2000,q_auto,f_auto');

// Detail page hero: tiny blurred copy used as the "ambient glow" behind the uncropped photo
export const getEventAmbientUrl = (url: string) =>
  withTransform(url, 'c_limit,w_320,q_auto:low,f_auto');

// Gallery masonry tile: keeps the ORIGINAL aspect ratio (no crop)
export const getMomentMasonryUrl = (url: string) =>
  withTransform(url, 'c_limit,w_900,q_auto,f_auto');

// Lightbox filmstrip thumbnail
export const getMomentFilmstripUrl = (url: string) =>
  withTransform(url, 'c_fill,g_auto,w_160,h_110,q_auto,f_auto');