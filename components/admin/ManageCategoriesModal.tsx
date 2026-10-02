// components/admin/ManageCategoriesModal.tsx
'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { EventCategory, EventItem, DEFAULT_CATEGORIES } from '@/lib/events';
import { X, Plus, Tag, Trash2, Lock, Search, Sparkles, Check } from 'lucide-react';

interface ManageCategoriesModalProps {
  categories: EventCategory[];
  events: EventItem[]; // used to block deleting categories that are still in use
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

const MAX_NAME = 30;
const SEARCH_THRESHOLD = 6; // show the filter box once the list gets long

const DOTS = [
  'bg-indigo-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-sky-500',
  'bg-violet-500',
  'bg-teal-500',
  'bg-orange-500',
];
const dotFor = (name: string) => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return DOTS[h % DOTS.length];
};

export default function ManageCategoriesModal({
  categories,
  events,
  onClose,
  onSuccess,
  onError,
}: ManageCategoriesModalProps) {
  const [newName, setNewName] = useState('');
  const [filter, setFilter] = useState('');
  const [adding, setAdding] = useState(false);
  const [addingPreset, setAddingPreset] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  /* ---- modal behaviour ---- */
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Only auto-focus where there is no on-screen keyboard to pop up
    const t = setTimeout(() => {
      if (window.matchMedia('(pointer: fine)').matches) inputRef.current?.focus();
    }, 150);
    return () => {
      document.body.style.overflow = prev;
      clearTimeout(t);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  /* ---- data ---- */
  const usage = useMemo(() => {
    const m: Record<string, number> = {};
    events.forEach((e) => {
      if (e.category) m[e.category] = (m[e.category] ?? 0) + 1;
    });
    return m;
  }, [events]);

  const usageCount = (name: string) => usage[name] ?? 0;
  const maxUsage = Math.max(1, ...categories.map((c) => usageCount(c.name)));

  const existing = useMemo(
    () => new Set(categories.map((c) => c.name.toLowerCase())),
    [categories]
  );

  const suggestions = useMemo(
    () => (DEFAULT_CATEGORIES as readonly string[]).filter((n) => !existing.has(n.toLowerCase())),
    [existing]
  );

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? categories.filter((c) => c.name.toLowerCase().includes(q)) : categories;
  }, [categories, filter]);

  const unusedCount = categories.filter((c) => usageCount(c.name) === 0).length;

  /* ---- actions ---- */
  const createCategory = useCallback(
    async (raw: string, preset = false) => {
      const name = raw.trim();
      if (!name) return;

      if (existing.has(name.toLowerCase())) {
        onError('That category already exists');
        return;
      }

      preset ? setAddingPreset(name) : setAdding(true);
      try {
        await addDoc(collection(db, 'eventCategories'), {
          name,
          createdAt: serverTimestamp(),
        });
        if (!preset) setNewName('');
        onSuccess(`Category "${name}" added`);
      } catch (error) {
        console.error('Error adding category:', error);
        onError('Failed to add category');
      } finally {
        setAdding(false);
        setAddingPreset(null);
      }
    },
    [existing, onError, onSuccess]
  );

  const handleAdd = (e?: React.FormEvent) => {
    e?.preventDefault();
    createCategory(newName);
  };

  const handleDelete = async (category: EventCategory) => {
    if (usageCount(category.name) > 0) return; // guarded in UI too

    setDeletingId(category.id);
    try {
      await deleteDoc(doc(db, 'eventCategories', category.id));
      onSuccess(`Category "${category.name}" deleted`);
    } catch (error) {
      console.error('Error deleting category:', error);
      onError('Failed to delete category');
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cat-modal-title"
    >
      <div className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-slate-50 shadow-2xl sm:max-h-[85dvh] sm:max-w-lg sm:rounded-3xl">
        {/* Mobile drag handle (visual) */}
        <div className="flex justify-center pt-2 sm:hidden">
          <span className="h-1 w-10 rounded-full bg-slate-300" />
        </div>

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3.5 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="rounded-xl bg-indigo-600 p-2 text-white shadow-sm shadow-indigo-600/30">
              <Tag className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 id="cat-modal-title" className="truncate text-lg font-semibold text-slate-900">
                Event categories
              </h2>
              <p className="truncate text-xs text-slate-500">
                {categories.length} categor{categories.length === 1 ? 'y' : 'ies'} · {unusedCount} unused
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Add new */}
        <div className="shrink-0 space-y-3 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
          <form onSubmit={handleAdd} className="flex gap-2">
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="New category, e.g. Competition"
                maxLength={MAX_NAME}
                aria-label="New category name"
                className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 pr-12 text-base text-slate-900 placeholder:text-slate-400 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-100 sm:text-sm"
              />
              {newName.length > 0 && (
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 tabular-nums">
                  {newName.length}/{MAX_NAME}
                </span>
              )}
            </div>
            <button
              type="submit"
              disabled={adding || !newName.trim()}
              className="flex min-h-[44px] items-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-medium text-white shadow-sm shadow-indigo-600/30 transition hover:bg-indigo-700 disabled:opacity-50"
            >
              {adding ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Add
            </button>
          </form>

          {suggestions.length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs text-slate-500">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                Quick add
              </p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => createCategory(name, true)}
                    disabled={addingPreset !== null}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-white px-3 text-xs font-medium text-slate-600 ring-1 ring-slate-200 transition hover:bg-indigo-50 hover:text-indigo-700 hover:ring-indigo-200 disabled:opacity-50"
                  >
                    {addingPreset === name ? (
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                    ) : (
                      <Plus className="h-3 w-3" />
                    )}
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* List */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
          {categories.length > SEARCH_THRESHOLD && (
            <div className="relative mb-3">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter categories…"
                aria-label="Filter categories"
                className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-base text-slate-900 placeholder:text-slate-400 transition focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-100 sm:text-sm"
              />
            </div>
          )}

          {categories.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white py-10 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-500">
                <Tag className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium text-slate-800">No categories yet</p>
              <p className="mt-1 text-xs text-slate-500">Add one above or use a quick-add suggestion.</p>
            </div>
          ) : visible.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No categories match &quot;{filter}&quot;</p>
          ) : (
            <ul className="space-y-2">
              {visible.map((cat) => {
                const count = usageCount(cat.name);
                const inUse = count > 0;
                const confirming = confirmId === cat.id;
                const deleting = deletingId === cat.id;
                return (
                  <li
                    key={cat.id}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotFor(cat.name)}`} />
                        <span className="truncate text-sm font-medium text-slate-900">{cat.name}</span>
                        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 tabular-nums">
                          {count} event{count !== 1 ? 's' : ''}
                        </span>
                      </div>

                      {inUse ? (
                        <span
                          className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium text-slate-400"
                          title="Can't delete: events still use this category"
                        >
                          <Lock className="h-3.5 w-3.5" />
                          In use
                        </span>
                      ) : confirming ? (
                        <div className="flex shrink-0 items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setConfirmId(null)}
                            disabled={deleting}
                            className="min-h-[36px] rounded-lg px-3 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(cat)}
                            disabled={deleting}
                            className="flex min-h-[36px] items-center gap-1.5 rounded-lg bg-rose-600 px-3 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-60"
                          >
                            {deleting ? (
                              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            ) : (
                              <Check className="h-3.5 w-3.5" />
                            )}
                            Delete
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmId(cat.id)}
                          aria-label={`Delete ${cat.name}`}
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    {/* usage bar */}
                    <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${dotFor(cat.name)} transition-all`}
                        style={{ width: `${(count / maxUsage) * 100}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <p className="mt-4 text-xs text-slate-500">
            Categories with events can&apos;t be deleted. Move or delete those events first.
          </p>
        </div>

        {/* Footer: safe-area aware */}
        <div className="shrink-0 border-t border-slate-200 bg-white px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-4">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[48px] w-full rounded-xl bg-slate-900 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 sm:min-h-[44px]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}