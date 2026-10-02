// app/admin/testimony/page.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import {
  AlertCircle,
  ArrowLeft,
  Info,
  Pencil,
  Plus,
  Quote,
  Search,
  SearchX,
  Trash2,
  X,
} from 'lucide-react';

import type { LucideIcon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { removeTestimonyAndCloseGap, HOME_TESTIMONY_COUNT } from '@/lib/testimonyOrder';
import Toast from '@/components/admin/Toast';
import DeleteTestimonyModal from '@/components/admin/DeleteTestimonyModal';
import AddTestimonyModal from '@/components/admin/AddTestimonyModal';
import EditTestimonyModal from '@/components/admin/EditTestimonyModal';

export interface Testimony {
  id: string;
  name: string;
  role: string;
  quote: string;
  imageUrl?: string;
  imagePublicId?: string;
  order: number;
  createdAt: any;
}

const GRID = 'grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4';

const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600';

/* ────────────────────────── Building blocks ────────────────────────── */

function Avatar({ name, src }: { name: string; src?: string }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        aria-hidden="true"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600"
      >
        {name.charAt(0).toUpperCase() || '?'}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-10 w-10 shrink-0 rounded-full bg-slate-100 object-cover"
    />
  );
}

function TestimonyCard({
  testimony,
  onEdit,
  onDelete,
}: {
  testimony: Testimony;
  onEdit: (t: Testimony) => void;
  onDelete: (t: Testimony) => void;
}) {
  return (
    <article className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-slate-300">
      <div className="flex items-center justify-between">
        <Quote className="h-5 w-5 text-slate-300" />
        <span
          className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"
          title="Display order"
        >
          #{testimony.order}
        </span>
      </div>

      <p className="mt-3 line-clamp-4 flex-1 text-sm leading-relaxed text-slate-700">
        &ldquo;{testimony.quote}&rdquo;
      </p>

      <div className="mt-4 flex items-center gap-3 border-t border-slate-100 pt-4">
        <Avatar name={testimony.name} src={testimony.imageUrl} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">{testimony.name}</p>
          <p className="truncate text-xs text-slate-500">{testimony.role}</p>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => onEdit(testimony)}
          className={`flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-lg bg-slate-100 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200 ${focusRing}`}
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </button>
        <button
          type="button"
          onClick={() => onDelete(testimony)}
          className={`flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-lg text-sm font-medium text-red-600 transition-colors hover:bg-red-50 ${focusRing}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </button>
      </div>
    </article>
  );
}

function SkeletonGrid() {
  return (
    <div className={GRID} aria-hidden="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="h-5 w-5 rounded bg-slate-100" />
          <div className="mt-4 space-y-2">
            <div className="h-3 w-full rounded bg-slate-100" />
            <div className="h-3 w-full rounded bg-slate-100" />
            <div className="h-3 w-3/4 rounded bg-slate-100" />
          </div>
          <div className="mt-5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-slate-100" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-1/2 rounded bg-slate-100" />
              <div className="h-3 w-1/3 rounded bg-slate-100" />
            </div>
          </div>
        </div>
      ))}
    </div>
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
  action: { label: string; onClick: () => void; primary?: boolean };
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="font-semibold text-slate-900">{title}</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-slate-600">{body}</p>
      <button
        type="button"
        onClick={action.onClick}
        className={`mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors ${focusRing} ${
          action.primary ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
        }`}
      >
        {action.primary && <Plus className="h-4 w-4" />}
        {action.label}
      </button>
    </div>
  );
}

/* ─────────────────────────────── Page ─────────────────────────────── */

export default function AdminTestimonyPage() {
  const { user, isAdmin, loading } = useAuth();
  const router = useRouter();

  const [testimonies, setTestimonies] = useState<Testimony[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedTestimony, setSelectedTestimony] = useState<Testimony | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const anyModalOpen = showAddModal || showEditModal || showDeleteModal;

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

  // Auth check (admin and superadmin)
  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      router.push('/admin/login');
    }
  }, [user, isAdmin, loading, router]);

  // Press "/" to jump to search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || anyModalOpen) return;
      const t = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [anyModalOpen]);

  // Live: testimonies
  useEffect(() => {
    if (!isAdmin) return;
    const q = query(collection(db, 'testimonies'), orderBy('order', 'asc'));
    return onSnapshot(
      q,
      (snap) => {
        setTestimonies(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Testimony));
        setLoaded(true);
      },
      (err) => {
        console.error('Error loading testimonies:', err);
        setLoadError("We couldn't load the testimonies. Check your connection and refresh the page.");
        setLoaded(true);
      }
    );
  }, [isAdmin]);

  const handleEdit = (t: Testimony) => {
    setSelectedTestimony(t);
    setShowEditModal(true);
  };

  const handleDelete = (t: Testimony) => {
    setSelectedTestimony(t);
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setSelectedTestimony(null);
  };

  const confirmDelete = async () => {
    if (!selectedTestimony || deleting) return;
    setDeleting(true);
    try {
      // Delete the document first and close the gap in the order (atomic).
      // If this fails nothing has been lost; at worst an image is orphaned below.
      await removeTestimonyAndCloseGap(selectedTestimony.id);

      // Then remove the image from Cloudinary (non-blocking if it fails)
      if (selectedTestimony.imagePublicId) {
        try {
          await fetch('/api/cloudinary/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ publicId: selectedTestimony.imagePublicId }),
          });
        } catch (imgErr) {
          console.warn('Testimony deleted but image cleanup failed:', imgErr);
        }
      }

      showToast(`Testimony from ${selectedTestimony.name} deleted`, 'success');
      closeDeleteModal();
    } catch (err) {
      console.error(err);
      showToast("Couldn't delete this testimony. Try again.", 'error');
    } finally {
      setDeleting(false);
    }
  };

  /* ── Derived data ── */

  // Featured/overflow come from the full ordered list, so search never changes which group an item is in
  const featuredAll = useMemo(() => testimonies.slice(0, HOME_TESTIMONY_COUNT), [testimonies]);
  const overflowAll = useMemo(() => testimonies.slice(HOME_TESTIMONY_COUNT), [testimonies]);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (t: Testimony) =>
      !q || [t.name, t.role, t.quote].some((v) => v?.toLowerCase().includes(q));
  }, [search]);

  const featured = featuredAll.filter(matches);
  const overflowItems = overflowAll.filter(matches);
  const shownCount = featured.length + overflowItems.length;
  const searching = search.trim() !== '';

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (!user || !isAdmin) return null;

  const stats = [
    { label: 'Total', value: String(testimonies.length) },
    { label: 'On homepage', value: String(featuredAll.length) },
    { label: 'Additional', value: String(overflowAll.length) },
  ];

  const renderGroup = (title: string, note: string, items: TestimonyGroupItems, badge: string) =>
    items.length === 0 ? null : (
      <section key={title} aria-label={title} className="space-y-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{badge}</span>
          <span className="text-sm text-slate-500">{note}</span>
        </div>
        <div className={GRID}>
          {items.map((t) => (
            <TestimonyCard key={t.id} testimony={t} onEdit={handleEdit} onDelete={handleDelete} />
          ))}
        </div>
      </section>
    );

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
                <Quote className="h-5 w-5 text-white" />
              </div>
              <h1 className="truncate text-lg font-bold text-slate-900 sm:text-xl">Testimonies</h1>
            </div>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className={`flex min-h-[44px] items-center gap-2 rounded-lg bg-indigo-600 px-3.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 sm:px-4 ${focusRing}`}
            >
              <Plus className="h-5 w-5" />
              <span>
                Add<span className="hidden sm:inline"> testimony</span>
              </span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
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

        {overflowAll.length > 0 && (
          <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />
            <p>
              The homepage shows the first {HOME_TESTIMONY_COUNT}.{' '}
              <span className="font-medium text-slate-900">
                {overflowAll.length} more {overflowAll.length === 1 ? 'testimony is' : 'testimonies are'}
              </span>{' '}
              on the Testimony page, so the View More button is active on the homepage.
            </p>
          </div>
        )}

        {/* Search */}
        {testimonies.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full sm:max-w-md">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchRef}
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setSearch('');
                }}
                placeholder="Search by name, role or quote"
                aria-label="Search testimonies"
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
            {searching && (
              <p className="text-sm text-slate-500" aria-live="polite">
                Showing {shownCount} of {testimonies.length}
              </p>
            )}
          </div>
        )}

        {/* Content */}
        {!loaded ? (
          <SkeletonGrid />
        ) : testimonies.length === 0 ? (
          <EmptyState
            icon={Quote}
            title="No testimonies yet"
            body="Add your first testimony to show it in the homepage marquee."
            action={{ label: 'Add testimony', onClick: () => setShowAddModal(true), primary: true }}
          />
        ) : shownCount === 0 ? (
          <EmptyState
            icon={SearchX}
            title="No testimonies match your search"
            body="Try a different name, role or phrase."
            action={{ label: 'Clear search', onClick: () => setSearch('') }}
          />
        ) : (
          <div className="space-y-10">
            {renderGroup(
              'Featured on homepage',
              'Shown in the scrolling marquee.',
              featured,
              `${searching ? featured.length : featuredAll.length} / ${HOME_TESTIMONY_COUNT}`
            )}
            {renderGroup(
              'Additional testimonies',
              'Visible only on the Testimony page.',
              overflowItems,
              String(overflowItems.length)
            )}
          </div>
        )}
      </main>

      {/* Modals */}
      {showAddModal && (
        <AddTestimonyModal
          nextOrder={testimonies.length + 1}
          onClose={() => setShowAddModal(false)}
          onSuccess={(msg) => {
            showToast(msg, 'success');
            setShowAddModal(false);
          }}
          onError={(msg) => showToast(msg, 'error')}
        />
      )}

      {showEditModal && selectedTestimony && (
        <EditTestimonyModal
          testimony={selectedTestimony}
          total={testimonies.length}
          onClose={() => {
            setShowEditModal(false);
            setSelectedTestimony(null);
          }}
          onSuccess={(msg) => {
            showToast(msg, 'success');
            setShowEditModal(false);
            setSelectedTestimony(null);
          }}
          onError={(msg) => showToast(msg, 'error')}
        />
      )}

      {showDeleteModal && selectedTestimony && (
        <DeleteTestimonyModal
          testimonyName={selectedTestimony.name}
          position={selectedTestimony.order}
          loading={deleting}
          onClose={closeDeleteModal}
          onConfirm={confirmDelete}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

type TestimonyGroupItems = Testimony[];