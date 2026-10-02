// app/admin/hero/page.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { doc, onSnapshot, Timestamp } from 'firebase/firestore';
import { AlertCircle, ArrowLeft, BarChart3, Check, Info, Loader2, Undo2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import Toast from '@/components/admin/Toast';
import {
  DEFAULT_HERO_STATS,
  HERO_STATS_COLLECTION,
  HERO_STATS_DOC,
  normalizeHeroStats,
  saveHeroStats,
  type HeroStatsData,
} from '@/lib/hero';

const MAX_VALUE = 9_999_999;
const MAX_LABEL = 24;
const MAX_TITLE = 30;
const SUFFIX_PRESETS = [
  { label: 'None', value: '' },
  { label: '+', value: '+' },
  { label: 'K+', value: 'K+' },
  { label: '%', value: '%' },
];

const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600';

const inputCls =
  'min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 sm:text-sm';

/* The form keeps the number as a string so the field can be empty while typing */
interface FormStat {
  value: string;
  suffix: string;
  label: string;
}
interface FormState {
  title: string;
  stats: FormStat[];
}

const toForm = (d: HeroStatsData): FormState => ({
  title: d.title,
  stats: d.stats.map((s) => ({ value: String(s.value), suffix: s.suffix, label: s.label })),
});

const toNumber = (v: string) => Math.min(MAX_VALUE, Math.max(0, parseInt(v, 10) || 0));

export default function AdminHeroPage() {
  const { user, isAdmin, loading } = useAuth();
  const router = useRouter();

  const [saved, setSaved] = useState<FormState>(toForm(DEFAULT_HERO_STATS));
  const [form, setForm] = useState<FormState>(toForm(DEFAULT_HERO_STATS));
  const [published, setPublished] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Timestamp | null>(null);
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(saved), [form, saved]);

  // Lets the live listener know not to overwrite what you're typing
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;

  // Live: currently published stats
  useEffect(() => {
    if (!isAdmin) return;
    return onSnapshot(
      doc(db, HERO_STATS_COLLECTION, HERO_STATS_DOC),
      (snap) => {
        const next = toForm(snap.exists() ? normalizeHeroStats(snap.data()) : DEFAULT_HERO_STATS);
        setPublished(snap.exists());
        setUpdatedAt(snap.exists() ? ((snap.data().updatedAt as Timestamp) ?? null) : null);
        setSaved(next);
        if (!dirtyRef.current) setForm(next);
        setFetching(false);
      },
      (err) => {
        console.error('Error loading hero stats:', err);
        setLoadError("We couldn't load the current stats. Check your connection and refresh the page.");
        setFetching(false);
      }
    );
  }, [isAdmin]);

  // Warn before leaving with unpublished edits
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const setStat = (i: number, patch: Partial<FormStat>) =>
    setForm((f) => ({ ...f, stats: f.stats.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) }));

  const handleSave = async () => {
    if (!dirty || saving) return;

    if (!form.title.trim()) {
      showToast('Add a heading for the stats section.', 'error');
      return;
    }
    for (let i = 0; i < form.stats.length; i++) {
      const s = form.stats[i];
      if (s.value.trim() === '') {
        showToast(`Stat ${i + 1} needs a number.`, 'error');
        return;
      }
      if (!s.label.trim()) {
        showToast(`Stat ${i + 1} needs a label.`, 'error');
        return;
      }
    }

    setSaving(true);
    try {
      await saveHeroStats({
        title: form.title.trim(),
        stats: form.stats.map((s, i) => ({
          id: `stat-${i + 1}`,
          value: toNumber(s.value),
          suffix: s.suffix,
          label: s.label.trim(),
        })),
      });
      showToast('Hero stats published', 'success');
    } catch (err) {
      console.error(err);
      showToast("Couldn't publish the stats. Try again.", 'error');
    } finally {
      setSaving(false);
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

  const updatedLabel = updatedAt ? updatedAt.toDate().toLocaleString() : null;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white pt-[env(safe-area-inset-top)] shadow-sm">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center gap-3">
            <Link
              href="/admin/dashboard"
              aria-label="Back to dashboard"
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 ${focusRing}`}
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-600">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <h1 className="truncate text-lg font-bold text-slate-900 sm:text-xl">Hero page</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {loadError && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <p>{loadError}</p>
          </div>
        )}

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-slate-900">Our Impact stats</h2>
            <p className="mt-1 flex items-start gap-1.5 text-sm text-slate-600">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <span>
                Shown in the stats card at the bottom of the homepage hero. Set the heading and the four numbers with
                their labels.
              </span>
            </p>
          </div>

          {fetching ? (
            <div className="space-y-3" aria-hidden="true">
              <div className="h-11 animate-pulse rounded-lg bg-slate-100" />
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-28 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : (
            <div className="space-y-5">
              {/* Heading */}
              <div>
                <label htmlFor="hero-title" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Section heading
                </label>
                <input
                  id="hero-title"
                  type="text"
                  maxLength={MAX_TITLE}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Our Impact"
                  className={`${inputCls} sm:max-w-sm`}
                />
              </div>

              {/* Stats */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {form.stats.map((s, i) => (
                  <fieldset key={i} className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <legend className="sr-only">Stat {i + 1}</legend>
                    <p className="text-sm font-semibold text-slate-900">Stat {i + 1}</p>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor={`stat-value-${i}`} className="mb-1.5 block text-sm font-medium text-slate-700">
                          Number
                        </label>
                        <input
                          id={`stat-value-${i}`}
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={s.value}
                          onChange={(e) => setStat(i, { value: e.target.value.replace(/\D/g, '').slice(0, 7) })}
                          placeholder="20"
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label htmlFor={`stat-label-${i}`} className="mb-1.5 block text-sm font-medium text-slate-700">
                          Label
                        </label>
                        <input
                          id={`stat-label-${i}`}
                          type="text"
                          maxLength={MAX_LABEL}
                          value={s.label}
                          onChange={(e) => setStat(i, { label: e.target.value })}
                          placeholder="Workshops"
                          className={inputCls}
                        />
                      </div>
                    </div>

                    <div>
                      <span className="mb-1.5 block text-sm font-medium text-slate-700">After the number</span>
                      <div role="radiogroup" aria-label={`Stat ${i + 1} suffix`} className="flex flex-wrap gap-2">
                        {SUFFIX_PRESETS.map((p) => {
                          const active = s.suffix === p.value;
                          return (
                            <button
                              key={p.label}
                              type="button"
                              role="radio"
                              aria-checked={active}
                              onClick={() => setStat(i, { suffix: p.value })}
                              className={`min-h-[40px] rounded-full px-4 text-sm font-medium ring-1 transition-colors ${focusRing} ${
                                active
                                  ? 'bg-indigo-600 text-white ring-indigo-600'
                                  : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              {p.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </fieldset>
                ))}
              </div>

              {/* Preview (mirrors the dark glass stats card on the hero) */}
              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">Preview</p>
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
                  <p className="mb-3 text-center text-[10px] font-bold uppercase tracking-[0.28em] text-white/70">
                    {form.title || 'Heading'}
                  </p>
                  <div className="grid grid-cols-2 gap-4 rounded-xl border border-white/10 bg-black/30 p-4 sm:grid-cols-4">
                    {form.stats.map((s, i) => (
                      <div key={i} className="text-center">
                        <p className="text-2xl font-extrabold tabular-nums text-white">
                          {toNumber(s.value).toLocaleString()}
                          {s.suffix}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-white/60">{s.label || 'Label'}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="mt-2 text-xs text-slate-500">Numbers count up on the real homepage.</p>
              </div>
            </div>
          )}

          {/* Status line */}
          <p className="mt-5 text-sm text-slate-500" aria-live="polite">
            {dirty
              ? 'You have changes that are not published yet.'
              : updatedLabel
                ? `Live now. Last updated ${updatedLabel}.`
                : published
                  ? 'Live now.'
                  : 'Nothing published yet. The homepage is showing the default numbers.'}
          </p>

          {/* Actions */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {dirty && (
              <button
                type="button"
                onClick={() => setForm(saved)}
                disabled={saving}
                className={`flex min-h-[44px] items-center gap-2 rounded-lg px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-60 ${focusRing}`}
              >
                <Undo2 className="h-4 w-4" />
                Discard
              </button>
            )}

            <button
              type="button"
              onClick={handleSave}
              disabled={!dirty || saving || fetching}
              className={`flex min-h-[44px] items-center gap-2 rounded-lg bg-indigo-600 px-5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 sm:ml-auto ${focusRing}`}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Publishing…
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Publish
                </>
              )}
            </button>
          </div>
        </section>
      </main>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}