// app/admin/timeline/page.tsx
'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { collection, deleteDoc, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Lock,
  MoreHorizontal,
  Pencil,
  Plus,
  Route,
  Trash2,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import {
  academicYearLabel,
  chapterLabel,
  FIRST_EDITABLE_YEAR,
  START_CHAPTER,
  type TimelineEntry,
} from '@/lib/timeline';
import TimelineEntryModal from '@/components/admin/TimelineEntryModal';
import DeleteTimeline from '@/components/admin/DeleteTimeline';
const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600';

interface MenuItem {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  danger?: boolean;
}

function ActionMenu({ label, items }: { label: string; items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 ${focusRing}`}
      >
        <MoreHorizontal className="h-5 w-5" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
          {items.map(({ label: l, icon: Icon, onClick, danger }) => (
            <React.Fragment key={l}>
              {danger && <div className="my-1 h-px bg-slate-100" />}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onClick();
                }}
                className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                  danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Icon className="h-4 w-4" />
                {l}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

function YearCard({
  year,
  chapter,
  title,
  body,
  events,
  badge,
  locked,
  menu,
  onEdit,
}: {
  year: number;
  chapter: string;
  title: string;
  body: string;
  events: number;
  badge?: string | null;
  locked?: boolean;
  menu?: MenuItem[];
  onEdit?: () => void;
}) {
  return (
    <article className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-slate-300">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-2xl font-bold text-slate-900">{year}</p>
          <p className="truncate text-xs text-slate-500">{academicYearLabel(year)}</p>
        </div>
        {locked ? (
          <span className="flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
            <Lock className="h-3 w-3" />
            Fixed
          </span>
        ) : (
          menu && <ActionMenu label={`Actions for ${year}`} items={menu} />
        )}
      </div>

      <p className="mt-4 text-xs font-medium text-indigo-700">{chapter}</p>
      <h4 className="mt-1 font-semibold text-slate-900">{title}</h4>
      <p className="mt-1 line-clamp-3 text-sm text-slate-600">{body}</p>

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
            {events} events
          </span>
          {badge && <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{badge}</span>}
        </div>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className={`flex min-h-[36px] items-center gap-1.5 rounded-lg bg-slate-100 px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200 ${focusRing}`}
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
        )}
      </div>
    </article>
  );
}

export default function AdminTimelinePage() {
  const { user, isAdmin, loading } = useAuth();
  const router = useRouter();

  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<TimelineEntry | null>(null);
  const [deleting, setDeleting] = useState<TimelineEntry | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) router.push('/admin/login');
  }, [user, isAdmin, loading, router]);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    []
  );

  useEffect(() => {
    if (!isAdmin) return;
    const q = query(collection(db, 'timeline'), orderBy('year', 'asc'));
    return onSnapshot(
      q,
      (snap) => {
        setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TimelineEntry));
        setLoaded(true);
      },
      (err) => {
        console.error('Error loading timeline:', err);
        setLoadError("We couldn't load the timeline. Check your connection and refresh the page.");
        setLoaded(true);
      }
    );
  }, [isAdmin]);

  const years = useMemo(() => entries.map((e) => e.year), [entries]);
  const lastYear = years.length ? Math.max(...years) : 2023;
  const totalEvents = START_CHAPTER.events + entries.reduce((s, e) => s + (e.events || 0), 0);

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await deleteDoc(doc(db, 'timeline', deleting.id));
      showToast(`${deleting.year} deleted`, 'success');
      setDeleting(null);
    } catch (error) {
      console.error('Error deleting year:', error);
      showToast("Couldn't delete this year. Try again.", 'error');
    } finally {
      setDeleteBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }
  if (!user || !isAdmin) return null;

  const stats = [
    { label: 'Years', value: String(entries.length + 1) },
    { label: 'Total events', value: String(totalEvents) },
    { label: 'Latest year', value: String(lastYear) },
    { label: 'Intro label', value: `2023 → ${lastYear}` },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white pt-[env(safe-area-inset-top)] shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                href="/admin/dashboard"
                aria-label="Back to dashboard"
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 ${focusRing}`}
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-600">
                <Route className="h-5 w-5 text-white" />
              </div>
              <h1 className="truncate text-lg font-bold text-slate-900 sm:text-xl">Timeline</h1>
            </div>
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className={`flex min-h-[44px] items-center gap-2 rounded-lg bg-indigo-600 px-3.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 sm:px-4 ${focusRing}`}
            >
              <Plus className="h-5 w-5" />
              <span>
                Add<span className="hidden sm:inline"> year</span>
              </span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {loadError && (
          <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <p>{loadError}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 shadow-sm sm:grid-cols-4">
          {stats.map(({ label, value }) => (
            <div key={label} className="bg-white p-4 sm:p-5">
              <p className="text-sm text-slate-500">{label}</p>
              <p className="mt-1 truncate text-xl font-bold text-slate-900 sm:text-2xl">{value}</p>
            </div>
          ))}
        </div>

        <p className="text-sm text-slate-600">
          The intro (“From AIMS to MATRIX”) and {START_CHAPTER.year} are fixed. Years you add here appear after
          2023 in order, and the latest year becomes the end of the intro label.
        </p>

        {!loaded ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-52 animate-pulse rounded-xl border border-slate-200 bg-white" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <YearCard
              year={Number(START_CHAPTER.year)}
              chapter={START_CHAPTER.chapter}
              title={START_CHAPTER.title}
              body={START_CHAPTER.body}
              events={START_CHAPTER.events}
              locked
            />
            {entries
              .filter((e) => e.year >= FIRST_EDITABLE_YEAR)
              .map((e, i) => (
                <YearCard
                  key={e.id}
                  year={e.year}
                  chapter={chapterLabel(i + 2, e.tag)}
                  title={e.title}
                  body={e.body}
                  events={e.events}
                  badge={e.badge}
                  onEdit={() => setEditing(e)}
                  menu={[
                    { label: 'Edit details', icon: Pencil, onClick: () => setEditing(e) },
                    { label: 'Delete year', icon: Trash2, onClick: () => setDeleting(e), danger: true },
                  ]}
                />
              ))}
          </div>
        )}

        {loaded && entries.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
            <h3 className="font-semibold text-slate-900">No years added yet</h3>
            <p className="mx-auto mt-1 max-w-sm text-sm text-slate-600">
              Add 2024 (or later) to extend the timeline beyond the fixed 2023 chapter.
            </p>
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className={`mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white transition-colors hover:bg-indigo-700 ${focusRing}`}
            >
              <Plus className="h-4 w-4" />
              Add year
            </button>
          </div>
        )}
      </main>

      {showAdd && (
        <TimelineEntryModal
          existingYears={years}
          suggestedYear={Math.max(lastYear + 1, FIRST_EDITABLE_YEAR)}
          onClose={() => setShowAdd(false)}
          onSuccess={(m) => {
            showToast(m, 'success');
            setShowAdd(false);
          }}
          onError={(m) => showToast(m, 'error')}
        />
      )}

      {editing && (
        <TimelineEntryModal
          entry={editing}
          existingYears={years}
          suggestedYear={editing.year}
          onClose={() => setEditing(null)}
          onSuccess={(m) => {
            showToast(m, 'success');
            setEditing(null);
          }}
          onError={(m) => showToast(m, 'error')}
        />
      )}

      {deleting && (
  <DeleteTimeline
    year={deleting.year}
    title={deleting.title}
    isLatest={deleting.year === lastYear}
    loading={deleteBusy}
    onClose={() => setDeleting(null)}
    onConfirm={confirmDelete}
  />
)}

      {toast && (
        <div role="status" aria-live="polite" className="fixed inset-x-4 bottom-4 z-50 pb-[env(safe-area-inset-bottom)] sm:inset-x-auto sm:bottom-6 sm:right-6">
          <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-lg">
            {toast.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
            )}
            <p className="text-sm text-slate-900">{toast.message}</p>
            <button
              type="button"
              onClick={() => setToast(null)}
              aria-label="Dismiss notification"
              className={`ml-1 flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 ${focusRing}`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}