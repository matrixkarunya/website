// components/admin/EditEventModal.tsx
'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  uploadToCloudinary,
  uploadToCloudinaryWithProgress,
  isProgressUploadConfigured,
} from '@/lib/cloudinary';
import { getAcademicYearFromDate, EventCategory, EventItem } from '@/lib/events';
import MomentsManager from './MomentsManager';
import {
  X,
  Save,
  Calendar,
  MapPin,
  Tag,
  Type,
  Info,
  AlignLeft,
  Users,
  Clock,
  Images,
  ImagePlus,
  RefreshCw,
  Undo2,
  Eye,
  Pencil,
  LucideIcon,
} from 'lucide-react';

interface EditEventModalProps {
  event: EventItem;
  categories: EventCategory[];
  onClose: () => void;
  onSuccess: (message: string) => void; // closes the modal (after Save)
  onError: (message: string) => void;
  onToast: (message: string, type: 'success' | 'error') => void; // does NOT close (gallery actions)
  onManageCategories: () => void;
}

const MAX_IMAGE_MB = 10;
const MAX_DESC = 2000;
const DURATION_PRESETS = ['2 hours', '1 day', '2 days', '24 hours'];

/* 16px text on mobile prevents iOS zoom-on-focus; 44px min height for touch */
const inputCls =
  'w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-base text-slate-900 placeholder:text-slate-400 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-100 sm:text-sm';

const Label = ({
  icon: Icon,
  children,
  htmlFor,
}: {
  icon: LucideIcon;
  children: React.ReactNode;
  htmlFor?: string;
}) => (
  <label htmlFor={htmlFor} className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700">
    <Icon className="h-4 w-4 text-slate-400" />
    {children}
  </label>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="space-y-4">
    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</h3>
    {children}
  </section>
);

export default function EditEventModal({
  event,
  categories,
  onClose,
  onSuccess,
  onError,
  onToast,
  onManageCategories,
}: EditEventModalProps) {
  const initial = useMemo(
    () => ({
      title: event.title,
      category: event.category,
      date: event.date,
      venue: event.venue,
      description: event.description || '',
      participants:
        event.participants !== undefined && event.participants !== null
          ? String(event.participants)
          : '',
      duration: event.duration || '',
    }),
    // snapshot at open; later live updates from Firestore must not reset the form
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const [formData, setFormData] = useState(initial);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState(event.imageUrl);
  const [loading, setLoading] = useState(false);
  const [discardPrompt, setDiscardPrompt] = useState(false);
  const [coverProgress, setCoverProgress] = useState<number | null>(null);
  const [coverIndeterminate, setCoverIndeterminate] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  const set = (patch: Partial<typeof formData>) => setFormData((f) => ({ ...f, ...patch }));

  const dirty =
    !!imageFile || (Object.keys(initial) as (keyof typeof initial)[]).some((k) => formData[k] !== initial[k]);

  /* ---- modal behaviour ---- */
  const requestClose = useCallback(() => {
    if (loading) return;
    if (dirty) setDiscardPrompt(true);
    else onClose();
  }, [loading, dirty, onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && requestClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [requestClose]);

  /* ---- image handling ---- */
  const acceptFile = (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      onError('Please choose an image file (JPG, PNG or WebP)');
      return;
    }
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
      onError(`Image is too large. Keep it under ${MAX_IMAGE_MB} MB`);
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  // "Undo" in edit mode just reverts to the existing cover image
  const handleImageRevert = () => {
    setImageFile(null);
    setImagePreview(event.imageUrl);
    if (fileRef.current) fileRef.current.value = '';
  };

  const derivedYear = formData.date ? getAcademicYearFromDate(formData.date) : '';

  const prettyDate = formData.date
    ? new Date(`${formData.date}T00:00:00`).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : 'Pick a date';

  // If the event's category was deleted/renamed, still show it so nothing is blank
  const categoryOptions = categories.some((c) => c.name === event.category)
    ? categories.map((c) => c.name)
    : [event.category, ...categories.map((c) => c.name)];

  /* ---- cover upload with a single progress bar (hidden again when done) ---- */
  const uploadCover = async (file: File) => {
    const measurable = isProgressUploadConfigured();
    setCoverIndeterminate(!measurable);
    setCoverProgress(0);
    try {
      return measurable
        ? await uploadToCloudinaryWithProgress(file, setCoverProgress)
        : await uploadToCloudinary(file);
    } finally {
      setCoverProgress(null); // bar disappears as soon as the upload ends
    }
  };

  /* ---- submit ---- */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let imageUrl = event.imageUrl;
      let imagePublicId = event.imagePublicId;

      if (imageFile) {
        const uploaded = await uploadCover(imageFile);
        imageUrl = uploaded.url;
        imagePublicId = uploaded.publicId;

        // Remove the old cover (best-effort; don't fail the edit if this fails)
        if (event.imagePublicId) {
          fetch('/api/cloudinary/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ publicId: event.imagePublicId }),
          }).catch((err) => console.warn('Old image cleanup failed:', err));
        }
      }

      const participants =
        formData.participants.trim() === ''
          ? null
          : Math.max(0, parseInt(formData.participants, 10) || 0);

      // NOTE: `moments` is intentionally NOT written here. The gallery below saves
      // itself instantly, so Save can never overwrite gallery changes.
      await updateDoc(doc(db, 'events', event.id), {
        title: formData.title.trim(),
        category: formData.category,
        date: formData.date,
        venue: formData.venue.trim(),
        description: formData.description.trim(),
        participants,
        duration: formData.duration.trim() || null,
        academicYear: getAcademicYearFromDate(formData.date),
        imageUrl,
        imagePublicId,
        updatedAt: serverTimestamp(),
      });

      onSuccess('Event updated successfully!');
    } catch (error) {
      console.error('Error updating event:', error);
      onError('Failed to update event');
    } finally {
      setLoading(false);
    }
  };

  /* ---- live preview (desktop only) ---- */
  const Preview = (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="relative h-36 bg-gradient-to-br from-slate-100 to-slate-200">
        {imagePreview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imagePreview} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-300">
            <ImagePlus className="h-10 w-10" />
          </div>
        )}
      </div>
      <div className="space-y-2 p-4">
        {formData.category && (
          <span className="inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 ring-1 ring-indigo-200">
            {formData.category}
          </span>
        )}
        <p className={`line-clamp-2 font-semibold ${formData.title ? 'text-slate-900' : 'text-slate-300'}`}>
          {formData.title || 'Event title'}
        </p>
        <div className="space-y-1 text-xs text-slate-500">
          <p className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            {prettyDate}
            {derivedYear && <span className="text-slate-400">· AY {derivedYear}</span>}
          </p>
          <p className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{formData.venue || 'Venue'}</span>
          </p>
          {formData.participants && (
            <p className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 shrink-0" />
              {formData.participants}+ participants
            </p>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && requestClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-event-title"
    >
      <div className="flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-slate-50 shadow-2xl sm:max-h-[90dvh] sm:max-w-4xl sm:rounded-3xl">
        {/* Mobile drag handle (visual) */}
        <div className="flex justify-center pt-2 sm:hidden">
          <span className="h-1 w-10 rounded-full bg-slate-300" />
        </div>

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3.5 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="rounded-xl bg-indigo-600 p-2 text-white shadow-sm shadow-indigo-600/30">
              <Pencil className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 id="edit-event-title" className="truncate text-lg font-semibold text-slate-900">
                  Edit event
                </h2>
                {dirty && (
                  <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-amber-200">
                    Unsaved
                  </span>
                )}
              </div>
              <p className="truncate text-xs text-slate-500">{event.title}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={requestClose}
            disabled={loading}
            aria-label="Close"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6 sm:py-6">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-8">
              {/* Left: fields */}
              <div className="space-y-7">
                {/* Cover image */}
                <Section title="Cover image">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => acceptFile(e.target.files?.[0])}
                  />
                  <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    {imagePreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imagePreview} alt="Cover" className="h-44 w-full object-cover sm:h-56" />
                    ) : (
                      <div className="flex h-44 items-center justify-center text-slate-300 sm:h-56">
                        <ImagePlus className="h-10 w-10" />
                      </div>
                    )}
                    {imageFile && (
                      <span className="absolute left-3 top-3 rounded-full bg-emerald-500 px-2.5 py-1 text-[11px] font-medium text-white shadow">
                        New image · saves with changes
                      </span>
                    )}
                    <div className="absolute inset-x-0 bottom-0 flex items-center justify-end gap-2 bg-gradient-to-t from-slate-900/70 to-transparent p-3">
                      {imageFile && (
                        <button
                          type="button"
                          onClick={handleImageRevert}
                          disabled={loading}
                          className="flex min-h-[40px] items-center gap-1.5 rounded-lg bg-white/90 px-3 text-xs font-medium text-slate-800 backdrop-blur hover:bg-white disabled:opacity-50"
                        >
                          <Undo2 className="h-3.5 w-3.5" />
                          Undo
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        disabled={loading}
                        className="flex min-h-[40px] items-center gap-1.5 rounded-lg bg-white/90 px-3 text-xs font-medium text-slate-800 backdrop-blur hover:bg-white disabled:opacity-50"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Replace
                      </button>
                    </div>
                  </div>
                </Section>

                {/* Basics */}
                <Section title="Basics">
                  <div>
                    <Label icon={Type} htmlFor="ev-title">Event title *</Label>
                    <input
                      id="ev-title"
                      type="text"
                      required
                      value={formData.title}
                      onChange={(e) => set({ title: e.target.value })}
                      className={inputCls}
                    />
                  </div>

                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
                        <Tag className="h-4 w-4 text-slate-400" />
                        Category *
                      </span>
                      <button
                        type="button"
                        onClick={onManageCategories}
                        className="min-h-[32px] text-xs font-medium text-indigo-600 hover:text-indigo-700"
                      >
                        Manage categories
                      </button>
                    </div>
                    <div role="radiogroup" aria-label="Category" className="flex flex-wrap gap-2">
                      {categoryOptions.map((name) => {
                        const active = formData.category === name;
                        return (
                          <button
                            key={name}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() => set({ category: name })}
                            className={`min-h-[40px] rounded-full px-4 text-sm font-medium ring-1 transition ${
                              active
                                ? 'bg-indigo-600 text-white ring-indigo-600 shadow-sm shadow-indigo-600/30'
                                : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            {name}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <Label icon={AlignLeft} htmlFor="ev-desc">Description *</Label>
                    <textarea
                      id="ev-desc"
                      required
                      rows={5}
                      maxLength={MAX_DESC}
                      value={formData.description}
                      onChange={(e) => set({ description: e.target.value })}
                      className={`${inputCls} resize-none`}
                      placeholder="What is this event about? Line breaks are kept on the public page."
                    />
                    <p className="mt-1 text-right text-xs text-slate-400 tabular-nums">
                      {formData.description.length}/{MAX_DESC}
                    </p>
                  </div>
                </Section>

                {/* When & where */}
                <Section title="When and where">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <Label icon={Calendar} htmlFor="ev-date">Date *</Label>
                      <input
                        id="ev-date"
                        type="date"
                        required
                        value={formData.date}
                        onChange={(e) => set({ date: e.target.value })}
                        className={inputCls}
                      />
                    </div>
                    <div className="flex flex-col justify-center rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3">
                      <p className="text-xs text-slate-500">Academic year</p>
                      <p className="text-lg font-semibold leading-tight text-indigo-700">{derivedYear || '—'}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                        <Info className="h-3 w-3" />
                        Auto-set from date (June – May)
                      </p>
                    </div>
                  </div>

                  <div>
                    <Label icon={MapPin} htmlFor="ev-venue">Venue *</Label>
                    <input
                      id="ev-venue"
                      type="text"
                      required
                      value={formData.venue}
                      onChange={(e) => set({ venue: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                </Section>

                {/* Extras */}
                <Section title="Extras (optional)">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <Label icon={Users} htmlFor="ev-participants">Participants</Label>
                      <input
                        id="ev-participants"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={formData.participants}
                        onChange={(e) => set({ participants: e.target.value.replace(/\D/g, '') })}
                        className={inputCls}
                        placeholder="250"
                      />
                      <p className="mt-1.5 text-xs text-slate-400">Shown publicly as &quot;250+&quot;</p>
                    </div>
                    <div>
                      <Label icon={Clock} htmlFor="ev-duration">Duration</Label>
                      <input
                        id="ev-duration"
                        type="text"
                        value={formData.duration}
                        onChange={(e) => set({ duration: e.target.value })}
                        className={inputCls}
                        placeholder="24 hours"
                      />
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {DURATION_PRESETS.map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => set({ duration: d })}
                            className={`min-h-[32px] rounded-full px-3 text-xs font-medium ring-1 transition ${
                              formData.duration === d
                                ? 'bg-slate-900 text-white ring-slate-900'
                                : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            {d}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </Section>

                {/* Gallery */}
                <section className="space-y-3">
                  <div className="flex items-start gap-3 rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3">
                    <Images className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <div>
                      <h3 className="text-sm font-medium text-slate-800">Gallery moments</h3>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                        <Info className="h-3 w-3 shrink-0" />
                        Gallery changes save instantly. No need to click Save.
                      </p>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                    <MomentsManager eventId={event.id} onToast={onToast} />
                  </div>
                </section>
              </div>

              {/* Right: live preview (desktop) */}
              <aside className="hidden lg:block">
                <div className="sticky top-0 space-y-3">
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    <Eye className="h-3.5 w-3.5" />
                    Live preview
                  </p>
                  {Preview}
                  <p className="text-xs text-slate-400">
                    A rough look at how the event will appear in the admin list.
                  </p>
                </div>
              </aside>
            </div>
          </div>

          {/* Footer: sticky, respects iPhone home-indicator safe area */}
          <div className="shrink-0 border-t border-slate-200 bg-white px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-4">
            {coverProgress !== null && (
              <div
                className="mb-3"
                role="progressbar"
                aria-label="Uploading cover image"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={coverIndeterminate ? undefined : coverProgress}
              >
                <style>{`@keyframes coverSlide{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}`}</style>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700">Uploading cover image…</span>
                  {!coverIndeterminate && (
                    <span className="font-semibold tabular-nums text-indigo-700">{coverProgress}%</span>
                  )}
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  {coverIndeterminate ? (
                    <div className="h-full w-1/3 animate-[coverSlide_1.1s_ease-in-out_infinite] rounded-full bg-indigo-500" />
                  ) : (
                    <div
                      className="h-full rounded-full bg-indigo-600 transition-all duration-200"
                      style={{ width: `${coverProgress}%` }}
                    />
                  )}
                </div>
              </div>
            )}
            {discardPrompt ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-medium text-slate-800">Discard your unsaved changes?</p>
                <div className="flex flex-col-reverse gap-2.5 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => setDiscardPrompt(false)}
                    className="min-h-[48px] rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 sm:min-h-[44px]"
                  >
                    Keep editing
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="min-h-[48px] rounded-xl bg-rose-600 px-5 text-sm font-medium text-white shadow-sm hover:bg-rose-700 sm:min-h-[44px]"
                  >
                    Discard
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={requestClose}
                  disabled={loading}
                  className="min-h-[48px] rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 sm:min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !dirty}
                  className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 text-sm font-medium text-white shadow-sm shadow-indigo-600/30 transition hover:bg-indigo-700 disabled:opacity-50 sm:min-h-[44px] sm:min-w-[170px]"
                >
                  {loading ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      {coverProgress !== null ? 'Uploading…' : 'Saving…'}
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Save changes
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}