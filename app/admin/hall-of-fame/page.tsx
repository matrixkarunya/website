// app/admin/hall-of-fame/page.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import {
  AlertCircle,
  ArrowLeft,
  ExternalLink,
  Pencil,
  Plus,
  Search,
  SearchX,
  Star,
  Trash2,
  Trophy,
  X,
  type LucideIcon,
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { useAdminGuard } from '@/lib/useAdminGuard';
import {
  ACHIEVEMENTS_COLLECTION,
  Achievement,
  collectImageIds,
  countPeople,
  formatDate,
  removeCloudinaryImages,
  summarizeWinners,
  toAchievement,
  yearOf,
} from '@/lib/hallOfFame';
import Toast from '@/components/admin/Toast';
import DeleteAchievementModal from '@/components/admin/DeleteAchievementModal';

const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600';

/* ────────────────────────── Building blocks ────────────────────────── */

function Thumb({ a }: { a: Achievement }) {
  const [failed, setFailed] = useState(false);
  if (!a.coverImageUrl || failed) {
    return (
      <div
        aria-hidden="true"
        className="flex h-14 w-20 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400"
      >
        <Trophy className="h-5 w-5" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={a.coverImageUrl}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-14 w-20 shrink-0 rounded-lg bg-slate-100 object-cover"
    />
  );
}

function AchievementRow({
  a,
  busy,
  onToggleFeatured,
  onDelete,
}: {
  a: Achievement;
  busy: boolean;
  onToggleFeatured: (a: Achievement) => void;
  onDelete: (a: Achievement) => void;
}) {
  const { primary, secondary } = summarizeWinners(a);
  const hasTeam = a.winners.some((w) => w.kind === 'team');

  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <Thumb a={a} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-slate-900">{a.title}</p>
            {a.featured && (
              <span className="shrink-0 rounded-md bg-indigo-50 px-1.5 py-0.5 text-[11px] font-medium text-indigo-700">
                Featured
              </span>
            )}
          </div>
          <p className="truncate text-xs text-slate-500">
            {[formatDate(a.date), a.category, a.organizer].filter(Boolean).join(' · ')}
          </p>
          <p className="truncate text-xs text-slate-600">
            {primary}
            {secondary && <span className="text-slate-400"> · {secondary}</span>}
            {hasTeam && a.winners.length > 1 && <span className="text-slate-400"> · includes a team</span>}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 self-end sm:self-auto">
        <button
          type="button"
          onClick={() => onToggleFeatured(a)}
          disabled={busy}
          aria-pressed={a.featured}
          aria-label={a.featured ? 'Remove from spotlight' : 'Feature in spotlight'}
          title={a.featured ? 'Remove from spotlight' : 'Feature in spotlight'}
          className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors hover:bg-slate-100 disabled:opacity-50 ${focusRing} ${
            a.featured ? 'text-indigo-600' : 'text-slate-400'
          }`}
        >
          <Star className={`h-4 w-4 ${a.featured ? 'fill-current' : ''}`} />
        </button>
        <Link
          href={`/hall-of-fame/${a.id}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`View ${a.title} on the public site`}
          title="View on the public site"
          className={`flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 ${focusRing}`}
        >
          <ExternalLink className="h-4 w-4" />
        </Link>
        <Link
          href={`/admin/hall-of-fame/${a.id}`}
          aria-label={`Edit ${a.title}`}
          title="Edit"
          className={`flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 ${focusRing}`}
        >
          <Pencil className="h-4 w-4" />
        </Link>
        <button
          type="button"
          onClick={() => onDelete(a)}
          aria-label={`Delete ${a.title}`}
          title="Delete"
          className={`flex h-10 w-10 items-center justify-center rounded-lg text-rose-600 transition-colors hover:bg-rose-50 ${focusRing}`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}

function SkeletonList() {
  return (
    <ul
      aria-hidden="true"
      className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white shadow-sm"
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <li key={i} className="flex animate-pulse items-center gap-4 p-4">
          <div className="h-14 w-20 rounded-lg bg-slate-100" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/2 rounded bg-slate-100" />
            <div className="h-3 w-1/3 rounded bg-slate-100" />
            <div className="h-3 w-1/4 rounded bg-slate-100" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
icon: LucideIcon;
  title: string;
  body: string;
  action: { label: string; href?: string; onClick?: () => void; primary?: boolean };
}) {
  const cls = `mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors ${focusRing} ${
    action.primary ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
  }`;
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="font-semibold text-slate-900">{title}</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-slate-600">{body}</p>
      {action.href ? (
        <Link href={action.href} className={cls}>
          {action.primary && <Plus className="h-4 w-4" />}
          {action.label}
        </Link>
      ) : (
        <button type="button" onClick={action.onClick} className={cls}>
          {action.label}
        </button>
      )}
    </div>
  );
}

/* ─────────────────────────────── Page ─────────────────────────────── */

export default function AdminHallOfFamePage() {
  const { loading, ready } = useAdminGuard();

  const [items, setItems] = useState<Achievement[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [selected, setSelected] = useState<Achievement | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  };

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    []
  );

  // Show the message left by the add/edit form, if any
  useEffect(() => {
    try {
      const message = sessionStorage.getItem('hofToast');
      if (message) {
        sessionStorage.removeItem('hofToast');
        showToast(message, 'success');
      }
    } catch {
      /* storage unavailable */
    }
  }, []);

  // Press "/" to jump to search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || selected) return;
      const t = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selected]);

  // Live: achievements, newest first
  useEffect(() => {
    if (!ready) return;
    const q = query(collection(db, ACHIEVEMENTS_COLLECTION), orderBy('date', 'desc'));
    return onSnapshot(
      q,
      (snap) => {
        setItems(snap.docs.map((d) => toAchievement(d.id, d.data())));
        setLoaded(true);
      },
      (err) => {
        console.error('Error loading achievements:', err);
        setLoadError("We couldn't load the achievements. Check your connection and refresh the page.");
        setLoaded(true);
      }
    );
  }, [ready]);

  const toggleFeatured = async (a: Achievement) => {
    if (busyId) return;
    setBusyId(a.id);
    try {
      await updateDoc(doc(db, ACHIEVEMENTS_COLLECTION, a.id), {
        featured: !a.featured,
        updatedAt: serverTimestamp(),
      });
      showToast(a.featured ? 'Removed from the spotlight' : 'Featured in the spotlight', 'success');
    } catch (err) {
      console.error(err);
      showToast("Couldn't update this achievement. Try again.", 'error');
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!selected || deleting) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, ACHIEVEMENTS_COLLECTION, selected.id));
      removeCloudinaryImages(collectImageIds(selected));
      showToast(`${selected.title} deleted`, 'success');
      setSelected(null);
    } catch (err) {
      console.error(err);
      showToast("Couldn't delete this achievement. Try again.", 'error');
    } finally {
      setDeleting(false);
    }
  };

  /* ── Derived data ── */

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((a) => {
      if (featuredOnly && !a.featured) return false;
      if (!q) return true;
      return [
        a.title,
        a.organizer,
        a.category,
        ...a.winners.flatMap((w) => [w.name, ...w.members.map((m) => m.name)]),
      ].some((v) => v?.toLowerCase().includes(q));
    });
  }, [items, search, featuredOnly]);

  const groups = useMemo(() => {
    const map = new Map<string, Achievement[]>();
    filtered.forEach((a) => {
      const y = yearOf(a.date);
      map.set(y, [...(map.get(y) ?? []), a]);
    });
    return [...map.entries()];
  }, [filtered]);

  const filtersActive = search.trim() !== '' || featuredOnly;
  const clearFilters = () => {
    setSearch('');
    setFeaturedOnly(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }
  if (!ready) return null;

  const stats = [
    { label: 'Achievements', value: String(items.length) },
    { label: 'Featured', value: String(items.filter((a) => a.featured).length) },
    { label: 'People recognised', value: String(items.reduce((n, a) => n + countPeople(a), 0)) },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
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
                <Trophy className="h-5 w-5 text-white" />
              </div>
              <h1 className="truncate text-lg font-bold text-slate-900 sm:text-xl">Hall of Fame</h1>
            </div>
            <Link
              href="/admin/hall-of-fame/new"
              className={`flex min-h-[44px] items-center gap-2 rounded-lg bg-indigo-600 px-3.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 sm:px-4 ${focusRing}`}
            >
              <Plus className="h-5 w-5" />
              <span>
                Add<span className="hidden sm:inline"> achievement</span>
              </span>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {loadError && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <p>{loadError}</p>
          </div>
        )}

        {/* Summary */}
        <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 shadow-sm">
          {stats.map(({ label, value }) => (
            <div key={label} className="bg-white p-4 sm:p-5">
              <p className="text-sm text-slate-500">{label}</p>
              <p className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">{value}</p>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        {items.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:max-w-md sm:flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchRef}
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setSearch('');
                }}
                placeholder="Search by event, winner or category"
                aria-label="Search achievements"
                className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white pl-11 pr-14 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 [&::-webkit-search-cancel-button]:hidden"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    searchRef.current?.focus();
                  }}
                  aria-label="Clear search"
                  className={`absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 ${focusRing}`}
                >
                  <X className="h-4 w-4" />
                </button>
              ) : (
                <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-slate-200 bg-slate-50 px-1.5 text-xs text-slate-500 sm:block">
                  /
                </kbd>
              )}
            </div>

            <button
              type="button"
              onClick={() => setFeaturedOnly((v) => !v)}
              aria-pressed={featuredOnly}
              className={`flex min-h-[44px] items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors ${focusRing} ${
                featuredOnly
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              <Star className={`h-4 w-4 ${featuredOnly ? 'fill-current' : ''}`} />
              Featured only
            </button>

            {filtersActive && (
              <p className="text-sm text-slate-500" aria-live="polite">
                Showing {filtered.length} of {items.length}{' '}
                <button
                  type="button"
                  onClick={clearFilters}
                  className={`rounded font-medium text-indigo-600 hover:text-indigo-700 hover:underline ${focusRing}`}
                >
                  Clear filters
                </button>
              </p>
            )}
          </div>
        )}

        {/* Content */}
        {!loaded ? (
          <SkeletonList />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title="No achievements yet"
            body="Add the first win to start the Hall of Fame."
            action={{ label: 'Add achievement', href: '/admin/hall-of-fame/new', primary: true }}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="No achievements match your filters"
            body="Try a different search term."
            action={{ label: 'Clear filters', onClick: clearFilters }}
          />
        ) : (
          <div className="space-y-8">
            {groups.map(([year, list]) => (
              <section key={year} aria-label={year} className="space-y-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-slate-900">{year}</h2>
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                    {list.length}
                  </span>
                </div>
                <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white shadow-sm">
                  {list.map((a) => (
                    <AchievementRow
                      key={a.id}
                      a={a}
                      busy={busyId === a.id}
                      onToggleFeatured={toggleFeatured}
                      onDelete={setSelected}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </main>

      {selected && (
        <DeleteAchievementModal
          title={selected.title}
          winnerCount={selected.winners.length}
          loading={deleting}
          onClose={() => setSelected(null)}
          onConfirm={confirmDelete}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}