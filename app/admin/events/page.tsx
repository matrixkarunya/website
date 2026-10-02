// app/admin/events/page.tsx
'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

import {
  collection,
  query,
  orderBy,
  onSnapshot,
  deleteDoc,
  doc,
  addDoc,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import AddEventModal from '@/components/admin/AddEventModal';
import EditEventModal from '@/components/admin/EditEventModal';
import EventDeleteConfirm from '@/components/admin/EventDeleteConfirm';
import ManageCategoriesModal from '@/components/admin/ManageCategoriesModal';
import ManageMomentsModal from '@/components/admin/ManageMomentsModal';
import Toast from '@/components/admin/Toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Plus,
  CalendarDays,
  Search,
  X,
  Tag,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List as ListIcon,
  MapPin,
  Images,
  Pencil,
  Trash2,
  Clock,
  CalendarCheck,
  Layers,
  SlidersHorizontal,
} from 'lucide-react';

import type { LucideIcon } from 'lucide-react';
import { EventItem, EventCategory, DEFAULT_CATEGORIES } from '@/lib/events';

const PAGE_SIZE = 12;

type SortKey = 'newest' | 'oldest' | 'title';
type ViewMode = 'grid' | 'list';

/* ---------- helpers ---------- */

const toDate = (v: any): Date | null => {
  if (!v) return null;
  if (typeof v?.toDate === 'function') return v.toDate();
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

const fmtDate = (v: any) => {
  const d = toDate(v);
  return d
    ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'No date';
};

const PALETTE = [
  'bg-indigo-50 text-indigo-700 ring-indigo-200',
  'bg-emerald-50 text-emerald-700 ring-emerald-200',
  'bg-amber-50 text-amber-700 ring-amber-200',
  'bg-rose-50 text-rose-700 ring-rose-200',
  'bg-sky-50 text-sky-700 ring-sky-200',
  'bg-violet-50 text-violet-700 ring-violet-200',
  'bg-teal-50 text-teal-700 ring-teal-200',
  'bg-orange-50 text-orange-700 ring-orange-200',
];
const catColor = (name: string) => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
};

const getPageList = (total: number, current: number): (number | '…')[] => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | '…')[] = [1];
  if (current > 3) pages.push('…');
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) pages.push(p);
  if (current < total - 2) pages.push('…');
  pages.push(total);
  return pages;
};

const eventImage = (e: EventItem): string | undefined => {
  const x = e as any;
  return x.imageUrl ?? x.image ?? x.coverImage ?? undefined;
};

/* ---------- background ---------- */

const AdminBackground = () => (
  <div className="fixed inset-0 -z-10 bg-slate-50">
    <div className="absolute -top-40 -left-32 h-[28rem] w-[28rem] rounded-full bg-indigo-200/40 blur-3xl" />
    <div className="absolute top-1/3 -right-40 h-[26rem] w-[26rem] rounded-full bg-sky-200/40 blur-3xl" />
    <div className="absolute inset-0 bg-[radial-gradient(#0f172a0d_1px,transparent_1px)] [background-size:22px_22px]" />
  </div>
);

/* ---------- small UI pieces ---------- */

const StatCard = ({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  tone: string;
}) => (
  <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${tone}`}>
      <Icon className="h-5 w-5" />
    </div>
    <div>
      <p className="text-2xl font-semibold leading-none text-slate-900 tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{label}</p>
    </div>
  </div>
);

const Skeleton = ({ view }: { view: ViewMode }) => (
  <div
    className={
      view === 'grid'
        ? 'grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3'
        : 'flex flex-col gap-3'
    }
  >
    {Array.from({ length: view === 'grid' ? 6 : 5 }).map((_, i) => (
      <div
        key={i}
        className={`animate-pulse rounded-2xl border border-slate-200 bg-white ${
          view === 'grid' ? 'h-72' : 'h-24'
        }`}
      />
    ))}
  </div>
);

interface TileProps {
  event: EventItem;
  view: ViewMode;
  onEdit: (e: EventItem) => void;
  onMoments: (e: EventItem) => void;
  onDelete: (e: EventItem) => void;
}

const EventTile = ({ event, view, onEdit, onMoments, onDelete }: TileProps) => {
  const d = toDate(event.date);
  const upcoming = d ? d.getTime() >= new Date().setHours(0, 0, 0, 0) : false;
  const img = eventImage(event);
  const momentCount = event.moments?.length ?? 0;

  const actions = (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => onMoments(event)}
        title="Manage gallery"
        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
      >
        <Images className="h-3.5 w-3.5" />
        {momentCount}
      </button>
      <button
        onClick={() => onEdit(event)}
        title="Edit event"
        className="rounded-lg p-2 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600"
      >
        <Pencil className="h-4 w-4" />
      </button>
      <button
        onClick={() => onDelete(event)}
        title="Delete event"
        className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );

  const badge = (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${
        upcoming
          ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
          : 'bg-slate-100 text-slate-600 ring-slate-200'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${upcoming ? 'bg-emerald-500' : 'bg-slate-400'}`} />
      {upcoming ? 'Upcoming' : 'Past'}
    </span>
  );

  const catBadge = (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${catColor(
        event.category || ''
      )}`}
    >
      {event.category || 'Uncategorised'}
    </span>
  );

  if (view === 'list') {
    return (
      <div className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-indigo-200 hover:shadow-md">
        <div className="h-16 w-24 shrink-0 overflow-hidden rounded-xl bg-slate-100">
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-slate-300">
              <CalendarDays className="h-6 w-6" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-semibold text-slate-900">{event.title}</h3>
            {badge}
            {catBadge}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {fmtDate(event.date)}
            </span>
            {event.venue && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {event.venue}
              </span>
            )}
            {event.academicYear && <span>AY {event.academicYear}</span>}
          </div>
        </div>
        {actions}
      </div>
    );
  }

  return (
    <div className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-lg">
      <div className="relative h-44 overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img}
            alt=""
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-300">
            <CalendarDays className="h-12 w-12" />
          </div>
        )}
        <div className="absolute left-3 top-3">{badge}</div>
        {momentCount > 0 && (
          <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-medium text-slate-700 shadow-sm backdrop-blur">
            <Images className="h-3 w-3" />
            {momentCount}
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="mb-2">{catBadge}</div>
        <h3 className="line-clamp-2 font-semibold text-slate-900">{event.title}</h3>
        <div className="mt-2 space-y-1 text-xs text-slate-500">
          <p className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            {fmtDate(event.date)}
            {event.academicYear && <span className="text-slate-400">· AY {event.academicYear}</span>}
          </p>
          {event.venue && (
            <p className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{event.venue}</span>
            </p>
          )}
        </div>
        <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-3">
          <button
            onClick={() => onMoments(event)}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
          >
            Manage gallery
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onEdit(event)}
              title="Edit event"
              className="rounded-lg p-2 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={() => onDelete(event)}
              title="Delete event"
              className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ---------- page ---------- */

export default function AdminEventsPage() {
  const { user, isAdmin, loading } = useAuth();
  const router = useRouter();

  const [events, setEvents] = useState<EventItem[]>([]);
  const [categories, setCategories] = useState<EventCategory[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sort, setSort] = useState<SortKey>('newest');
  const [view, setView] = useState<ViewMode>('grid');
  const [page, setPage] = useState(1);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);
  const [showMomentsModal, setShowMomentsModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);

  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    type: 'success' | 'error';
  }>({ show: false, message: '', type: 'success' });

  const seededRef = useRef(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Auth check
  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      router.push('/admin/login');
    }
  }, [user, isAdmin, loading, router]);

  // Press "/" to focus search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Events listener
  useEffect(() => {
    const q = query(collection(db, 'events'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: EventItem[] = [];
        snapshot.forEach((d) => list.push({ id: d.id, ...d.data() } as EventItem));
        setEvents(list);
        setDataLoading(false);
      },
      (error) => {
        console.error('Events listener error:', error);
        setDataLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Categories listener + one-time seeding of defaults
  useEffect(() => {
    const q = query(collection(db, 'eventCategories'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const list: EventCategory[] = [];
      snapshot.forEach((d) => list.push({ id: d.id, ...d.data() } as EventCategory));
      setCategories(list);

      // Seed defaults only if the collection is truly empty (server-confirmed)
      if (snapshot.empty && !snapshot.metadata.fromCache && !seededRef.current) {
        seededRef.current = true;
        try {
          const check = await getDocs(collection(db, 'eventCategories'));
          if (check.empty) {
            await Promise.all(
              DEFAULT_CATEGORIES.map((name) =>
                addDoc(collection(db, 'eventCategories'), {
                  name,
                  createdAt: serverTimestamp(),
                })
              )
            );
          }
        } catch (err) {
          console.error('Failed to seed categories:', err);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  }, []);

  const handleEdit = (event: EventItem) => {
    setSelectedEvent(event);
    setShowEditModal(true);
  };
  const handleMoments = (event: EventItem) => {
    setSelectedEvent(event);
    setShowMomentsModal(true);
  };
  const handleDelete = (event: EventItem) => {
    setSelectedEvent(event);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!selectedEvent) return;
    try {
      // Use the live copy so we also clean up gallery photos added after selection
      const live = events.find((e) => e.id === selectedEvent.id) ?? selectedEvent;
      const publicIds = [
        live.imagePublicId,
        ...(live.moments ?? []).map((m) => m.publicId),
      ].filter(Boolean);

      await Promise.allSettled(
        publicIds.map((publicId) =>
          fetch('/api/cloudinary/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ publicId }),
          })
        )
      );
      await deleteDoc(doc(db, 'events', selectedEvent.id));
      showToast('Event deleted successfully', 'success');
      setShowDeleteModal(false);
      setSelectedEvent(null);
    } catch (error) {
      console.error('Error deleting event:', error);
      showToast('Failed to delete event', 'error');
    }
  };

  // Academic years derived from events (latest first)
  const academicYears = useMemo(
    () =>
      [...new Set(events.map((e) => e.academicYear))]
        .filter(Boolean)
        .sort()
        .reverse(),
    [events]
  );

  // Stats
  const stats = useMemo(() => {
    const today = new Date().setHours(0, 0, 0, 0);
    return {
      total: events.length,
      upcoming: events.filter((e) => {
        const d = toDate(e.date);
        return d && d.getTime() >= today;
      }).length,
      photos: events.reduce((n, e) => n + (e.moments?.length ?? 0), 0),
      categories: categories.length,
    };
  }, [events, categories]);

  // Per-category counts (for chips)
  const categoryCounts = useMemo(() => {
    const m: Record<string, number> = {};
    events.forEach((e) => {
      if (e.category) m[e.category] = (m[e.category] ?? 0) + 1;
    });
    return m;
  }, [events]);

  // Filter + sort
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = events.filter((e) => {
      if (
        q &&
        !(
          e.title.toLowerCase().includes(q) ||
          e.venue.toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q)
        )
      )
        return false;
      if (yearFilter && e.academicYear !== yearFilter) return false;
      if (categoryFilter && e.category !== categoryFilter) return false;
      return true;
    });
    if (sort === 'oldest') return [...list].reverse(); // source is date desc
    if (sort === 'title') return [...list].sort((a, b) => a.title.localeCompare(b.title));
    return list;
  }, [events, searchQuery, yearFilter, categoryFilter, sort]);

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [searchQuery, yearFilter, categoryFilter, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages); // if last item on last page was deleted
  const pageEvents = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const rangeStart = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(safePage * PAGE_SIZE, filtered.length);

  const hasFilters = !!(searchQuery || yearFilter || categoryFilter);
  const clearAll = () => {
    setSearchQuery('');
    setYearFilter('');
    setCategoryFilter('');
  };

  if (loading) {
    return (
      <>
        <AdminBackground />
        <div className="relative flex min-h-screen items-center justify-center">
          <div className="flex items-center gap-3">
            {[0, 150, 300].map((d) => (
              <div
                key={d}
                className="h-2.5 w-2.5 animate-bounce rounded-full bg-indigo-500"
                style={{ animationDelay: `${d}ms` }}
              />
            ))}
          </div>
        </div>
      </>
    );
  }

  if (!user || !isAdmin) return null;

  const selectCls =
    'rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-100 cursor-pointer hover:border-slate-300';

  return (
    <>
      <AdminBackground />
      <div className="relative min-h-screen text-slate-900">
        {/* Header */}
        <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur-xl">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => router.push('/admin/dashboard')}
                  aria-label="Back to dashboard"
                  className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-indigo-600 p-2 text-white shadow-sm shadow-indigo-600/30">
                    <CalendarDays className="h-5 w-5" />
                  </div>
                  <div>
                    <h1 className="text-lg font-semibold leading-tight text-slate-900">
                      Events
                    </h1>
                    <p className="hidden text-xs text-slate-500 sm:block">
                      Dashboard / Events management
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowCategoriesModal(true)}
                  className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 sm:flex"
                >
                  <Tag className="h-4 w-4" />
                  Categories
                </button>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="group flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm shadow-indigo-600/30 transition hover:bg-indigo-700"
                >
                  <Plus className="h-4 w-4 transition-transform duration-300 group-hover:rotate-90" />
                  Add event
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
          {/* Stats */}
          <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard icon={CalendarDays} label="Total events" value={stats.total} tone="bg-indigo-50 text-indigo-600" />
            <StatCard icon={CalendarCheck} label="Upcoming" value={stats.upcoming} tone="bg-emerald-50 text-emerald-600" />
            <StatCard icon={Images} label="Gallery photos" value={stats.photos} tone="bg-amber-50 text-amber-600" />
            <StatCard icon={Layers} label="Categories" value={stats.categories} tone="bg-sky-50 text-sky-600" />
          </section>

          {/* Toolbar */}
          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  ref={searchRef}
                  type="text"
                  placeholder="Search by title, venue or category…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-11 pr-16 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-100"
                />
                {searchQuery ? (
                  <button
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear search"
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 hover:bg-slate-200"
                  >
                    <X className="h-3.5 w-3.5 text-slate-500" />
                  </button>
                ) : (
                  <kbd className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] text-slate-400 sm:block">
                    /
                  </kbd>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4 text-slate-400" />
                  <select
                    value={yearFilter}
                    onChange={(e) => setYearFilter(e.target.value)}
                    className={selectCls}
                    aria-label="Academic year"
                  >
                    <option value="">All years</option>
                    {academicYears.map((y, i) => (
                      <option key={y} value={y}>
                        {y} {i === 0 ? '(Latest)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  className={selectCls}
                  aria-label="Sort"
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="title">Title A–Z</option>
                </select>

                <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1">
                  {(['grid', 'list'] as ViewMode[]).map((v) => {
                    const Icon = v === 'grid' ? LayoutGrid : ListIcon;
                    return (
                      <button
                        key={v}
                        onClick={() => setView(v)}
                        aria-label={`${v} view`}
                        aria-pressed={view === v}
                        className={`rounded-lg p-2 transition ${
                          view === v
                            ? 'bg-white text-indigo-600 shadow-sm'
                            : 'text-slate-400 hover:text-slate-700'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setShowCategoriesModal(true)}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 shadow-sm sm:hidden"
                >
                  <Tag className="h-4 w-4" />
                  Categories
                </button>
              </div>
            </div>

            {/* Category chips */}
            {categories.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setCategoryFilter('')}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition ${
                    !categoryFilter
                      ? 'bg-slate-900 text-white ring-slate-900'
                      : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'
                  }`}
                >
                  All
                  <span className="ml-1.5 opacity-60">{events.length}</span>
                </button>
                {categories.map((c) => {
                  const active = categoryFilter === c.name;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setCategoryFilter(active ? '' : c.name)}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition ${
                        active
                          ? 'bg-indigo-600 text-white ring-indigo-600'
                          : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {c.name}
                      <span className="ml-1.5 opacity-60">{categoryCounts[c.name] ?? 0}</span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
              <p className="text-xs text-slate-500">
                {filtered.length === 0
                  ? 'No events'
                  : `Showing ${rangeStart}–${rangeEnd} of ${filtered.length} event${
                      filtered.length !== 1 ? 's' : ''
                    }`}
                {hasFilters && ` (${events.length} total)`}
              </p>
              {hasFilters && (
                <button
                  onClick={clearAll}
                  className="text-xs font-medium text-indigo-600 transition hover:text-indigo-700"
                >
                  Clear all filters
                </button>
              )}
            </div>
          </section>

          {/* Content */}
          {dataLoading ? (
            <Skeleton view={view} />
          ) : pageEvents.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white/70 py-20 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-500">
                <CalendarDays className="h-8 w-8" />
              </div>
              <p className="text-lg font-semibold text-slate-800">
                {events.length === 0 ? 'No events yet' : 'No events match your filters'}
              </p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                {events.length === 0
                  ? 'Create your first event to start building the events timeline.'
                  : 'Try a different search term or clear the filters.'}
              </p>
              <div className="mt-6">
                {events.length === 0 ? (
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
                  >
                    <Plus className="h-4 w-4" />
                    Add event
                  </button>
                ) : (
                  <button
                    onClick={clearAll}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              <div
                className={
                  view === 'grid'
                    ? 'grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3'
                    : 'flex flex-col gap-3'
                }
              >
                {pageEvents.map((event, index) => (
                  <motion.div
                    key={event.id}
                    layout
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ delay: Math.min(index, 8) * 0.03 }}
                  >
                    <EventTile
                      event={event}
                      view={view}
                      onEdit={handleEdit}
                      onMoments={handleMoments}
                      onDelete={handleDelete}
                    />
                  </motion.div>
                ))}
              </div>
            </AnimatePresence>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <nav className="flex items-center justify-center gap-1.5 pt-4" aria-label="Pagination">
              <button
                onClick={() => setPage(safePage - 1)}
                disabled={safePage === 1}
                aria-label="Previous page"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {getPageList(totalPages, safePage).map((p, i) =>
                p === '…' ? (
                  <span key={`gap-${i}`} className="px-1 text-slate-400">
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    aria-current={p === safePage ? 'page' : undefined}
                    className={`h-10 w-10 rounded-xl border text-sm font-medium transition ${
                      p === safePage
                        ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {p}
                  </button>
                )
              )}
              <button
                onClick={() => setPage(safePage + 1)}
                disabled={safePage === totalPages}
                aria-label="Next page"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </nav>
          )}
        </main>

        {/* Modals */}
        {showAddModal && (
          <AddEventModal
            categories={categories}
            onClose={() => setShowAddModal(false)}
            onSuccess={(message) => {
              showToast(message, 'success');
              setShowAddModal(false);
            }}
            onError={(message) => showToast(message, 'error')}
            onManageCategories={() => setShowCategoriesModal(true)}
          />
        )}

        {showEditModal && selectedEvent && (
          <EditEventModal
            event={selectedEvent}
            categories={categories}
            onClose={() => {
              setShowEditModal(false);
              setSelectedEvent(null);
            }}
            onSuccess={(message) => {
              showToast(message, 'success');
              setShowEditModal(false);
              setSelectedEvent(null);
            }}
            onError={(message) => showToast(message, 'error')}
            onToast={showToast}
            onManageCategories={() => setShowCategoriesModal(true)}
          />
        )}

        {showMomentsModal && selectedEvent && (
          <ManageMomentsModal
            eventId={selectedEvent.id}
            eventTitle={selectedEvent.title}
            onClose={() => {
              setShowMomentsModal(false);
              setSelectedEvent(null);
            }}
            onToast={showToast}
          />
        )}

        {showDeleteModal && selectedEvent && (
          <EventDeleteConfirm
            eventTitle={selectedEvent.title}
            onClose={() => {
              setShowDeleteModal(false);
              setSelectedEvent(null);
            }}
            onConfirm={confirmDelete}
          />
        )}

        {showCategoriesModal && (
          <ManageCategoriesModal
            categories={categories}
            events={events}
            onClose={() => setShowCategoriesModal(false)}
            onSuccess={(message) => showToast(message, 'success')}
            onError={(message) => showToast(message, 'error')}
          />
        )}

        {toast.show && <Toast message={toast.message} type={toast.type} />}
      </div>
    </>
  );
}