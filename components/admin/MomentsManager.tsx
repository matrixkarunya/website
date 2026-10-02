// components/admin/MomentsManager.tsx
// Manages the "moments" gallery of ONE event. Changes are saved to Firestore
// immediately (upload -> arrayUnion, delete -> arrayRemove), independent of any
// surrounding form's Save button.
'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import {
  doc,
  onSnapshot,
  updateDoc,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  uploadToCloudinary,
  uploadToCloudinaryWithProgress,
  isProgressUploadConfigured,
} from '@/lib/cloudinary';
import { MomentImage, getMomentThumbUrl } from '@/lib/events';
import {
  ImagePlus,
  Trash2,
  Image as ImageIcon,
  AlertCircle,
  RotateCw,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface MomentsManagerProps {
  eventId: string;
  onToast: (message: string, type: 'success' | 'error') => void;
}

const MAX_SIZE = 8 * 1024 * 1024; // 8MB per image
const MAX_FILES_PER_BATCH = 30;
const CONCURRENCY = 3;

type UploadStatus = 'queued' | 'uploading' | 'done' | 'error';

interface UploadItem {
  id: string;
  file: File;
  preview: string; // object URL for instant thumbnail
  progress: number; // 0-100
  indeterminate: boolean; // true when we can't measure progress (fallback uploader)
  status: UploadStatus;
  error?: string;
  result?: MomentImage;
}

const PAGE = 8; // thumbnails shown at a time

// Larger, optimised version for the full-screen viewer (keeps aspect ratio)
const viewerUrl = (url: string) => {
  const parts = url.split('/upload/');
  return parts.length === 2 ? `${parts[0]}/upload/q_auto,f_auto,w_1600,c_limit/${parts[1]}` : url;
};

// ----- one thumbnail in the admin grid -----
function ManagerThumb({
  moment,
  confirming,
  deleting,
  onOpen,
  onAskDelete,
  onCancel,
  onConfirm,
}: {
  moment: MomentImage;
  confirming: boolean;
  deleting: boolean;
  onOpen: () => void;
  onAskDelete: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth > 0) setLoaded(true);
  }, []);

  return (
    <div className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
      {!loaded && !failed && <div className="absolute inset-0 animate-pulse bg-slate-200" />}
      {failed ? (
        <div className="absolute inset-0 flex items-center justify-center text-slate-300">
          <ImageIcon className="h-6 w-6" />
        </div>
      ) : (
        <Image
          ref={imgRef}
          src={getMomentThumbUrl(moment.url)}
          alt="Moment"
          fill
          unoptimized
          sizes="200px"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={`object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      )}

      {/* Tap to view full size */}
      <button
        type="button"
        onClick={onOpen}
        aria-label="View photo"
        className="absolute inset-0 cursor-zoom-in focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400"
      />

      {/* Delete button (always visible on touch, hover on desktop) */}
      {!confirming && !deleting && (
        <button
          type="button"
          onClick={onAskDelete}
          aria-label="Delete photo"
          className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-rose-600 shadow-md transition hover:bg-rose-600 hover:text-white sm:h-8 sm:w-8 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}

      {/* Inline confirm */}
      {(confirming || deleting) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900/75 p-2 backdrop-blur-sm">
          {deleting ? (
            <>
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              <p className="text-xs text-white/80">Deleting…</p>
            </>
          ) : (
            <>
              <p className="text-xs font-medium text-white">Delete this photo?</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onCancel}
                  className="min-h-[36px] rounded-lg border border-white/30 bg-white/10 px-3 text-xs text-white hover:bg-white/20"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onConfirm}
                  className="min-h-[36px] rounded-lg bg-rose-600 px-3 text-xs font-medium text-white hover:bg-rose-700"
                >
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ----- manager -----
export default function MomentsManager({ eventId, onToast }: MomentsManagerProps) {
  const [moments, setMoments] = useState<MomentImage[]>([]);
  const [ready, setReady] = useState(false);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [running, setRunning] = useState(false); // uploading + saving
  const [saving, setSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<UploadItem[]>([]);
  itemsRef.current = items;
  const [visible, setVisible] = useState(PAGE);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const touchX = useRef<number | null>(null);

  // newest first, so a fresh upload is never hidden behind "show more"
  const ordered = [...moments].reverse();
  const shown = ordered.slice(0, visible);
  const hiddenCount = ordered.length - shown.length;
  const current = lightbox !== null ? ordered[lightbox] : undefined;
  const n = ordered.length;

  // Lightbox keys. Capture phase + stopImmediatePropagation so Esc closes only
  // the viewer, not the whole edit modal underneath.
  useEffect(() => {
    if (lightbox === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (!['Escape', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      e.stopImmediatePropagation();
      e.preventDefault();
      if (e.key === 'Escape') setLightbox(null);
      else setLightbox((i) => (i === null || n === 0 ? null : (i + (e.key === 'ArrowRight' ? 1 : -1) + n) % n));
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [lightbox, n]);

  const step = (d: number) => setLightbox((i) => (i === null || n === 0 ? null : (i + d + n) % n));

  // Live moments for this event
  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'events', eventId),
      (snap) => {
        const data = snap.data();
        setMoments((data?.moments as MomentImage[]) || []);
        setReady(true);
      },
      (error) => {
        console.error('Moments listener error:', error);
        setReady(true);
      }
    );
    return () => unsubscribe();
  }, [eventId]);

  // Free object URLs on unmount
  useEffect(() => {
    return () => itemsRef.current.forEach((i) => URL.revokeObjectURL(i.preview));
  }, []);

  const patch = (id: string, p: Partial<UploadItem>) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...p } : i)));

  const dropItems = (pred: (i: UploadItem) => boolean) =>
    setItems((prev) => {
      prev.filter(pred).forEach((i) => URL.revokeObjectURL(i.preview));
      return prev.filter((i) => !pred(i));
    });

  /** Upload a set of items (3 at a time), then save all successes to Firestore in one write. */
  const runUploads = async (batch: UploadItem[]) => {
    setRunning(true);
    const withProgress = isProgressUploadConfigured();
    let cursor = 0;

    // Results are tracked in plain local variables on purpose. React state updates
    // are async, so reading them right after the uploads finish can miss files.
    const savedByItem = new Map<string, MomentImage>();
    const failedIds = new Set<string>();

    const worker = async () => {
      while (cursor < batch.length) {
        const item = batch[cursor++];
        patch(item.id, { status: 'uploading', progress: 0, indeterminate: !withProgress, error: undefined });
        try {
          const { url, publicId } = withProgress
            ? await uploadToCloudinaryWithProgress(item.file, (pct) => patch(item.id, { progress: pct }))
            : await uploadToCloudinary(item.file); // fallback: no measurable progress
          const moment: MomentImage = { url, publicId, addedAt: Date.now() };
          savedByItem.set(item.id, moment);
          patch(item.id, { status: 'done', progress: 100, result: moment });
        } catch (error) {
          console.error('Upload failed:', error);
          failedIds.add(item.id);
          patch(item.id, {
            status: 'error',
            error: error instanceof Error ? error.message : 'Upload failed',
          });
        }
      }
    };

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, batch.length) }, () => worker()));

    const uploaded = Array.from(savedByItem.values());
    const savedIds = new Set(savedByItem.keys());
    const failed = failedIds.size;

    try {
      if (uploaded.length > 0) {
        setSaving(true);
        await updateDoc(doc(db, 'events', eventId), {
          moments: arrayUnion(...uploaded),
          updatedAt: serverTimestamp(),
        });
        dropItems((i) => savedIds.has(i.id)); // they now live in the grid
      }
      if (failed > 0) {
        onToast(`Added ${uploaded.length}, ${failed} failed. Use retry on the failed ones.`, 'error');
      } else if (uploaded.length > 0) {
        onToast(`${uploaded.length} photo${uploaded.length > 1 ? 's' : ''} added to gallery`, 'success');
      }
    } catch (error) {
      console.error('Saving moments failed:', error);
      dropItems((i) => savedIds.has(i.id));
      onToast('Photos uploaded but could not be saved to the event', 'error');
    } finally {
      setSaving(false);
      setRunning(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleFiles = (fileList: FileList | File[] | null) => {
    if (!fileList || running) return;
    const all = Array.from(fileList);
    if (all.length === 0) return;

    let valid = all.filter((f) => f.type.startsWith('image/') && f.size <= MAX_SIZE);
    const skipped = all.length - valid.length;

    if (valid.length > MAX_FILES_PER_BATCH) {
      onToast(`Only the first ${MAX_FILES_PER_BATCH} images were used`, 'error');
      valid = valid.slice(0, MAX_FILES_PER_BATCH);
    }
    if (skipped > 0) {
      onToast(`${skipped} file${skipped > 1 ? 's' : ''} skipped (images under 8MB only)`, 'error');
    }
    if (valid.length === 0) return;

    // Clear old failed cards from a previous batch
    dropItems((i) => i.status === 'error');

    const batch: UploadItem[] = valid.map((file, idx) => ({
      id: `${Date.now()}-${idx}-${file.name}`,
      file,
      preview: URL.createObjectURL(file),
      progress: 0,
      indeterminate: false,
      status: 'queued',
    }));
    setItems((prev) => [...prev, ...batch]);
    itemsRef.current = [...itemsRef.current, ...batch];
    runUploads(batch);
  };

  const retryOne = (id: string) => {
    if (running) return;
    const item = itemsRef.current.find((i) => i.id === id);
    if (!item) return;
    patch(id, { status: 'queued', progress: 0, error: undefined });
    runUploads([{ ...item, status: 'queued', progress: 0 }]);
  };

  const retryAllFailed = () => {
    if (running) return;
    const failedItems = itemsRef.current.filter((i) => i.status === 'error');
    if (failedItems.length === 0) return;
    setItems((prev) => prev.map((i) => (i.status === 'error' ? { ...i, status: 'queued', progress: 0, error: undefined } : i)));
    runUploads(failedItems.map((i) => ({ ...i, status: 'queued' as const, progress: 0 })));
  };

  const handleDelete = async (moment: MomentImage) => {
    setDeletingId(moment.publicId);
    try {
      if (moment.publicId) {
        await fetch('/api/cloudinary/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ publicId: moment.publicId }),
        }).catch((err) => console.warn('Cloudinary cleanup failed:', err));
      }
      await updateDoc(doc(db, 'events', eventId), {
        moments: arrayRemove(moment),
        updatedAt: serverTimestamp(),
      });
      onToast('Photo deleted', 'success');
    } catch (error) {
      console.error('Delete moment failed:', error);
      onToast('Failed to delete photo', 'error');
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  };

  // Overall progress across the visible queue
  const total = items.length;
  const doneCount = items.filter((i) => i.status === 'done').length;
  const failedCount = items.filter((i) => i.status === 'error').length;
  const indeterminate = items.some((i) => i.status === 'uploading' && i.indeterminate);
  const overall =
    total === 0
      ? 0
      : Math.round(
          items.reduce((n, i) => n + (i.status === 'done' ? 100 : i.status === 'error' ? 0 : i.progress), 0) / total
        );

  return (
    <div>
      <style>{`@keyframes momentSlide{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}`}</style>

      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setIsDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`rounded-2xl border-2 border-dashed p-5 text-center transition ${
          isDragging ? 'border-indigo-400 bg-indigo-50' : 'border-slate-300 bg-slate-50'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/jpg,image/webp"
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />
        <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <ImagePlus className="h-6 w-6" />
        </div>
        <p className="text-sm text-slate-700">
          <span className="hidden sm:inline">{isDragging ? 'Drop photos here…' : 'Drag photos here or'}</span>
          <span className="sm:hidden">Add photos to the gallery</span>
        </p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={running}
          className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-medium text-white shadow-sm shadow-indigo-600/30 transition hover:bg-indigo-700 disabled:opacity-50"
        >
          <ImagePlus className="h-4 w-4" />
          {running ? 'Uploading…' : 'Choose photos'}
        </button>
        <p className="mt-3 text-xs text-slate-500">
          PNG, JPG, WEBP · Max 8MB each · Up to {MAX_FILES_PER_BATCH} at a time
        </p>
      </div>

      {/* Upload progress: ONE bar, gone as soon as the upload finishes */}
      {total > 0 && (running || failedCount > 0) && (
        <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3">
          {running ? (
            <div
              role="progressbar"
              aria-label="Uploading photos"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={indeterminate ? undefined : overall}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-800">
                  {saving ? 'Saving to gallery…' : `Uploading ${Math.min(doneCount + 1, total)} of ${total}`}
                </p>
                {!indeterminate && (
                  <span className="text-sm font-semibold tabular-nums text-indigo-700">{overall}%</span>
                )}
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white">
                {indeterminate && !saving ? (
                  <div className="h-full w-1/3 animate-[momentSlide_1.1s_ease-in-out_infinite] rounded-full bg-indigo-500" />
                ) : (
                  <div
                    className="h-full rounded-full bg-indigo-600 transition-all duration-200"
                    style={{ width: `${saving ? 100 : overall}%` }}
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-sm font-medium text-rose-700">
                <AlertCircle className="h-4 w-4" />
                {failedCount} upload{failedCount > 1 ? 's' : ''} failed
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={retryAllFailed}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-white px-3 text-xs font-medium text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-50"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                  Retry
                </button>
                <button
                  type="button"
                  onClick={() => dropItems((i) => i.status === 'error')}
                  className="min-h-[40px] rounded-lg px-3 text-xs font-medium text-slate-600 hover:bg-white"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Grid */}
      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium text-slate-800">Gallery</p>
          <p className="text-xs text-slate-500">
            {moments.length > PAGE
              ? `Showing ${shown.length} of ${moments.length} photos`
              : `${moments.length} photo${moments.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        {!ready ? (
          <div className="flex justify-center py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" />
          </div>
        ) : moments.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 py-10 text-center">
            <ImageIcon className="mx-auto mb-2 h-8 w-8 text-slate-300" />
            <p className="text-sm font-medium text-slate-600">No photos yet</p>
            <p className="mt-1 text-xs text-slate-400">Upload photos above to build the gallery</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {shown.map((moment, idx) => (
                <ManagerThumb
                  key={moment.publicId || moment.url}
                  moment={moment}
                  confirming={confirmId === moment.publicId}
                  deleting={deletingId === moment.publicId}
                  onOpen={() => setLightbox(idx)}
                  onAskDelete={() => setConfirmId(moment.publicId)}
                  onCancel={() => setConfirmId(null)}
                  onConfirm={() => handleDelete(moment)}
                />
              ))}
            </div>

            {(hiddenCount > 0 || visible > PAGE) && (
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                {hiddenCount > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setVisible((v) => v + PAGE)}
                      className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                    >
                      <ChevronDown className="h-4 w-4" />
                      Show {Math.min(PAGE, hiddenCount)} more
                    </button>
                    {hiddenCount > PAGE && (
                      <button
                        type="button"
                        onClick={() => setVisible(ordered.length)}
                        className="min-h-[44px] rounded-xl px-4 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
                      >
                        View all {ordered.length}
                      </button>
                    )}
                  </>
                )}
                {visible > PAGE && hiddenCount === 0 && (
                  <button
                    type="button"
                    onClick={() => setVisible(PAGE)}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-xl px-4 text-sm font-medium text-slate-600 hover:bg-slate-100"
                  >
                    <ChevronUp className="h-4 w-4" />
                    Show less
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
      {/* Full-screen viewer */}
      {current && lightbox !== null && (
        <div
          className="fixed inset-0 z-[70] flex flex-col bg-slate-950/95"
          role="dialog"
          aria-modal="true"
          aria-label="Photo viewer"
          onClick={() => setLightbox(null)}
          onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (touchX.current === null) return;
            const dx = e.changedTouches[0].clientX - touchX.current;
            touchX.current = null;
            if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
          }}
        >
          <div className="flex items-center justify-between px-4 py-3 text-white" onClick={(e) => e.stopPropagation()}>
            <span className="text-sm tabular-nums text-white/80">
              {lightbox + 1} / {n}
            </span>
            <button
              type="button"
              onClick={() => setLightbox(null)}
              aria-label="Close viewer"
              className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-white/10"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-16">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={current.url}
              src={viewerUrl(current.url)}
              alt="Gallery photo"
              className="max-h-full max-w-full rounded-lg object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            {n > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    step(-1);
                  }}
                  aria-label="Previous photo"
                  className="absolute left-2 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 sm:flex"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    step(1);
                  }}
                  aria-label="Next photo"
                  className="absolute right-2 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 sm:flex"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}