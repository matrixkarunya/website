// app/admin/about/page.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { doc, onSnapshot, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { AlertCircle, ArrowLeft, Check, ImageIcon, Info, Loader2, Undo2, Upload } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { uploadToCloudinary } from '@/lib/cloudinary';
import Toast from '@/components/admin/Toast';
import {
  DEFAULT_HERO_STATS,
  HERO_STATS_COLLECTION,
  HERO_STATS_DOC,
  normalizeHeroStats,
  saveHeroStats,
  type HeroStatsData,
} from '@/lib/hero';

interface MatrixImageDoc {
  imageUrl: string;
  imagePublicId: string;
  updatedAt?: Timestamp;
}

/* The stats form keeps the number as a string so the field can be empty while typing */
interface FormStat {
  value: string;
  suffix: string;
  label: string;
}

const MAX_MB = 10;
const MAX_VALUE = 9_999_999;
const MAX_LABEL = 24;
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

const formatSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const toForm = (d: HeroStatsData): FormStat[] =>
  d.stats.map((s) => ({ value: String(s.value), suffix: s.suffix, label: s.label }));

const toNumber = (v: string) => Math.min(MAX_VALUE, Math.max(0, parseInt(v, 10) || 0));

// Best-effort: a failed image cleanup should never block the user
const removeImage = (publicId: string) => {
  fetch('/api/cloudinary/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ publicId }),
  }).catch(() => {});
};

export default function AdminAboutPage() {
  const { user, isAdmin, loading } = useAuth();
  const router = useRouter();

  /* ── MATRIX image ── */
  const [current, setCurrent] = useState<MatrixImageDoc | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [localPreview, setLocalPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  /* ── MATRIX stats (shared with the hero: settings/heroStats) ── */
  const [statsSaved, setStatsSaved] = useState<FormStat[]>(toForm(DEFAULT_HERO_STATS));
  const [statsForm, setStatsForm] = useState<FormStat[]>(toForm(DEFAULT_HERO_STATS));
  const [heroTitle, setHeroTitle] = useState(DEFAULT_HERO_STATS.title); // kept as-is when saving
  const [statsPublished, setStatsPublished] = useState(false);
  const [statsUpdatedAt, setStatsUpdatedAt] = useState<Timestamp | null>(null);
  const [statsFetching, setStatsFetching] = useState(true);
  const [statsSaving, setStatsSaving] = useState(false);
  const [statsLoadError, setStatsLoadError] = useState<string | null>(null);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  // Live: current image
  useEffect(() => {
    if (!isAdmin) return;
    return onSnapshot(
      doc(db, 'settings', 'matrixImage'),
      (snap) => {
        setCurrent(snap.exists() ? (snap.data() as MatrixImageDoc) : null);
        setFetching(false);
      },
      (err) => {
        console.error('Error loading MATRIX image:', err);
        setLoadError("We couldn't load the current image. Check your connection and refresh the page.");
        setFetching(false);
      }
    );
  }, [isAdmin]);

  const statsDirty = useMemo(
    () => JSON.stringify(statsForm) !== JSON.stringify(statsSaved),
    [statsForm, statsSaved]
  );

  // Lets the live listener know not to overwrite what you're typing
  const statsDirtyRef = useRef(false);
  statsDirtyRef.current = statsDirty;

  // Live: currently published stats
  useEffect(() => {
    if (!isAdmin) return;
    return onSnapshot(
      doc(db, HERO_STATS_COLLECTION, HERO_STATS_DOC),
      (snap) => {
        const data = normalizeHeroStats(snap.exists() ? snap.data() : DEFAULT_HERO_STATS);
        const next = toForm(data);
        setHeroTitle(data.title);
        setStatsPublished(snap.exists());
        setStatsUpdatedAt(snap.exists() ? ((snap.data().updatedAt as Timestamp) ?? null) : null);
        setStatsSaved(next);
        if (!statsDirtyRef.current) setStatsForm(next);
        setStatsFetching(false);
      },
      (err) => {
        console.error('Error loading MATRIX stats:', err);
        setStatsLoadError("We couldn't load the current stats. Check your connection and refresh the page.");
        setStatsFetching(false);
      }
    );
  }, [isAdmin]);

  // Free the temporary preview URL when it changes or the page closes
  useEffect(
    () => () => {
      if (localPreview) URL.revokeObjectURL(localPreview);
    },
    [localPreview]
  );

  // Warn before leaving with anything unpublished
  const hasUnpublished = !!file || statsDirty;
  useEffect(() => {
    if (!hasUnpublished) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasUnpublished]);

  const acceptFile = (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      showToast('Choose an image file (JPG, PNG or WebP).', 'error');
      return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      showToast(`That image is over ${MAX_MB} MB. Choose a smaller one.`, 'error');
      return;
    }
    setFile(f);
    setLocalPreview(URL.createObjectURL(f));
  };

  const discardSelection = () => {
    setFile(null);
    setLocalPreview('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleSave = async () => {
    if (!file || saving) return;
    setSaving(true);
    let uploaded: { url: string; publicId: string } | null = null;

    try {
      const oldPublicId = current?.imagePublicId;

      uploaded = await uploadToCloudinary(file);

      await setDoc(doc(db, 'settings', 'matrixImage'), {
        imageUrl: uploaded.url,
        imagePublicId: uploaded.publicId,
        updatedAt: serverTimestamp(),
      });

      // Clean up the previous image now that the new one is confirmed saved
      if (oldPublicId) removeImage(oldPublicId);

      discardSelection();
      showToast('MATRIX image published', 'success');
    } catch (err) {
      console.error(err);
      // The save failed, so the freshly uploaded image isn't needed
      if (uploaded) removeImage(uploaded.publicId);
      showToast("Couldn't publish the image. Try again.", 'error');
    } finally {
      setSaving(false);
    }
  };

  const setStat = (i: number, patch: Partial<FormStat>) =>
    setStatsForm((list) => list.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  const handleStatsSave = async () => {
    if (!statsDirty || statsSaving) return;

    for (let i = 0; i < statsForm.length; i++) {
      const s = statsForm[i];
      if (s.value.trim() === '') {
        showToast(`Stat ${i + 1} needs a number.`, 'error');
        return;
      }
      if (!s.label.trim()) {
        showToast(`Stat ${i + 1} needs a label.`, 'error');
        return;
      }
    }

    setStatsSaving(true);
    try {
      await saveHeroStats({
        title: heroTitle, // the hero heading is edited on the Hero page, so it stays as it is
        stats: statsForm.map((s, i) => ({
          id: `stat-${i + 1}`,
          value: toNumber(s.value),
          suffix: s.suffix,
          label: s.label.trim(),
        })),
      });
      showToast('MATRIX stats published', 'success');
    } catch (err) {
      console.error(err);
      showToast("Couldn't publish the stats. Try again.", 'error');
    } finally {
      setStatsSaving(false);
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

  const preview = localPreview || current?.imageUrl || '';
  const updatedLabel = current?.updatedAt ? current.updatedAt.toDate().toLocaleString() : null;
  const statsUpdatedLabel = statsUpdatedAt ? statsUpdatedAt.toDate().toLocaleString() : null;

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
              <ImageIcon className="h-5 w-5 text-white" />
            </div>
            <h1 className="truncate text-lg font-bold text-slate-900 sm:text-xl">About page</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {(loadError || statsLoadError) && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <p>{loadError ?? statsLoadError}</p>
          </div>
        )}

        {/* ───────────── MATRIX image ───────────── */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-900">MATRIX image</h2>
            <p className="mt-1 flex items-start gap-1.5 text-sm text-slate-600">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <span>
                Shown in the MATRIX panel (03) of the homepage About section. The other two panel images are fixed and
                can&rsquo;t be edited here.
              </span>
            </p>
          </div>

          {/* Preview and drop zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              acceptFile(e.dataTransfer.files?.[0]);
            }}
            className={`relative aspect-[16/10] w-full overflow-hidden rounded-xl border-2 transition-colors ${
              dragging
                ? 'border-indigo-600 bg-indigo-50'
                : preview
                  ? 'border-slate-200 bg-slate-100'
                  : 'border-dashed border-slate-300 bg-slate-50'
            }`}
          >
            {fetching ? (
              <div className="h-full w-full animate-pulse bg-slate-100" aria-hidden="true" />
            ) : preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="MATRIX section preview" className="h-full w-full object-cover" />
            ) : (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className={`flex h-full w-full flex-col items-center justify-center gap-2 text-slate-500 ${focusRing}`}
              >
                <ImageIcon className="h-10 w-10 text-slate-400" />
                <span className="text-sm font-medium text-slate-700">Drop an image here or choose a file</span>
                <span className="text-xs">JPG, PNG or WebP, up to {MAX_MB} MB</span>
              </button>
            )}

            {dragging && (
              <div className="absolute inset-0 flex items-center justify-center bg-indigo-50/90 text-sm font-medium text-indigo-700">
                Drop to use this image
              </div>
            )}

            {file && !dragging && (
              <span className="absolute left-3 top-3 rounded-md bg-slate-900/80 px-2.5 py-1 text-xs font-medium text-white">
                Not published yet
              </span>
            )}
          </div>

          {/* Status line */}
          <p className="mt-3 text-sm text-slate-500" aria-live="polite">
            {file
              ? `${file.name} (${formatSize(file.size)})`
              : updatedLabel
                ? `Live now. Last updated ${updatedLabel}.`
                : current
                  ? 'Live now.'
                  : 'No image published yet.'}
          </p>

          {/* Actions */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              tabIndex={-1}
              onChange={(e) => acceptFile(e.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={saving}
              className={`flex min-h-[44px] items-center gap-2 rounded-lg bg-slate-100 px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200 disabled:opacity-60 ${focusRing}`}
            >
              <Upload className="h-4 w-4" />
              {file ? 'Choose a different image' : 'Choose new image'}
            </button>

            {file && (
              <button
                type="button"
                onClick={discardSelection}
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
              disabled={!file || saving}
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

        {/* ───────────── MATRIX stats ───────────── */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-slate-900">MATRIX stats</h2>
            <p className="mt-1 flex items-start gap-1.5 text-sm text-slate-600">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <span>
                The four boxes in the MATRIX panel (03). These are the same numbers as the hero &ldquo;Our
                Impact&rdquo; card, so changing them here updates both. The other two panels are fixed.
              </span>
            </p>
          </div>

          {statsFetching ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2" aria-hidden="true">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-40 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {statsForm.map((s, i) => (
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

              {/* Preview (mirrors the glass stat boxes on the MATRIX panel) */}
              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">Preview</p>
                <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-800 bg-slate-900 p-4 sm:grid-cols-4">
                  {statsForm.map((s, i) => (
                    <div
                      key={i}
                      className="flex flex-col items-center rounded-xl border border-white/15 bg-white/10 px-2 py-2.5 text-center"
                    >
                      <p className="text-base font-black leading-none text-white md:text-lg">
                        {toNumber(s.value).toLocaleString()}
                        {s.suffix}
                      </p>
                      <p className="mt-1 max-w-full truncate text-[10px] font-medium leading-tight text-white/55">
                        {s.label || 'Label'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Status line */}
          <p className="mt-5 text-sm text-slate-500" aria-live="polite">
            {statsDirty
              ? 'You have changes that are not published yet.'
              : statsUpdatedLabel
                ? `Live now. Last updated ${statsUpdatedLabel}.`
                : statsPublished
                  ? 'Live now.'
                  : 'Nothing published yet. The site is showing the default numbers.'}
          </p>

          {/* Actions */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {statsDirty && (
              <button
                type="button"
                onClick={() => setStatsForm(statsSaved)}
                disabled={statsSaving}
                className={`flex min-h-[44px] items-center gap-2 rounded-lg px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-60 ${focusRing}`}
              >
                <Undo2 className="h-4 w-4" />
                Discard
              </button>
            )}

            <button
              type="button"
              onClick={handleStatsSave}
              disabled={!statsDirty || statsSaving || statsFetching}
              className={`flex min-h-[44px] items-center gap-2 rounded-lg bg-indigo-600 px-5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 sm:ml-auto ${focusRing}`}
            >
              {statsSaving ? (
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