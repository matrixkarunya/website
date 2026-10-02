// components/admin/AddEventModal.tsx
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  uploadToCloudinary,
  uploadToCloudinaryWithProgress,
  isProgressUploadConfigured,
} from '@/lib/cloudinary';
import { getAcademicYearFromDate, EventCategory } from '@/lib/events';
import {
  X,
  Plus,
  Calendar,
  MapPin,
  Tag,
  Type,
  Info,
  AlignLeft,
  Users,
  Clock,
  ImagePlus,
  RefreshCw,
  Trash2,
  Eye,
} from 'lucide-react';

import type { LucideIcon } from 'lucide-react';

interface AddEventModalProps {
  categories: EventCategory[];
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
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

export default function AddEventModal({
  categories,
  onClose,
  onSuccess,
  onError,
  onManageCategories,
}: AddEventModalProps) {
  const [formData, setFormData] = useState({
    title: '',
    category: categories[0]?.name || '',
    date: '',
    venue: '',
    description: '',
    participants: '',
    duration: '',
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [coverProgress, setCoverProgress] = useState<number | null>(null);
  const [coverIndeterminate, setCoverIndeterminate] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  const set = (patch: Partial<typeof formData>) => setFormData((f) => ({ ...f, ...patch }));

  /* ---- modal behaviour: scroll lock, Esc to close, autofocus ---- */
  const safeClose = useCallback(() => {
    if (!loading) onClose();
  }, [loading, onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => titleRef.current?.focus({ preventScroll: true }), 150);
    return () => {
      document.body.style.overflow = prev;
      clearTimeout(t);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && safeClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [safeClose]);

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

  const removeImage = () => {
    setImageFile(null);
    setImagePreview('');
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

    if (!imageFile) {
      onError('Please select a cover image');
      return;
    }
    if (!formData.category) {
      onError('Please select a category (create one first if none exist)');
      return;
    }

    setLoading(true);
    try {
      const { url, publicId } = await uploadCover(imageFile);

      const participants =
        formData.participants.trim() === ''
          ? null
          : Math.max(0, parseInt(formData.participants, 10) || 0);

      await addDoc(collection(db, 'events'), {
        title: formData.title.trim(),
        category: formData.category,
        date: formData.date,
        venue: formData.venue.trim(),
        description: formData.description.trim(),
        participants,
        duration: formData.duration.trim() || null,
        academicYear: getAcademicYearFromDate(formData.date),
        imageUrl: url,
        imagePublicId: publicId,
        moments: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      onSuccess('Event added! Use "Moments" on the card to add gallery photos.');
    } catch (error) {
      console.error('Error adding event:', error);
      onError('Failed to add event');
    } finally {
      setLoading(false);
    }
  };

  /* ---- live preview card (desktop only) ---- */
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
      onMouseDown={(e) => e.target === e.currentTarget && safeClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-event-title"
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
              <Plus className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 id="add-event-title" className="truncate text-lg font-semibold text-slate-900">
                Add event
              </h2>
              <p className="truncate text-xs text-slate-500">Fill in the details to publish a new event</p>
            </div>
          </div>
          <button
            type="button"
            onClick={safeClose}
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
                  {imagePreview ? (
                    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imagePreview} alt="Cover preview" className="h-44 w-full object-cover sm:h-56" />
                      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-slate-900/70 to-transparent p-3">
                        <p className="min-w-0 truncate text-xs text-white/90">{imageFile?.name}</p>
                        <div className="flex shrink-0 gap-2">
                          <button
                            type="button"
                            onClick={() => fileRef.current?.click()}
                            disabled={loading}
                            className="flex min-h-[40px] items-center gap-1.5 rounded-lg bg-white/90 px-3 text-xs font-medium text-slate-800 backdrop-blur hover:bg-white disabled:opacity-50"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            Replace
                          </button>
                          <button
                            type="button"
                            onClick={removeImage}
                            disabled={loading}
                            aria-label="Remove image"
                            className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/90 text-rose-600 backdrop-blur hover:bg-white disabled:opacity-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOver(true);
                      }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragOver(false);
                        acceptFile(e.dataTransfer.files?.[0]);
                      }}
                      className={`flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-10 text-center transition ${
                        dragOver
                          ? 'border-indigo-400 bg-indigo-50'
                          : 'border-slate-300 bg-white hover:border-indigo-300 hover:bg-indigo-50/40'
                      }`}
                    >
                      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                        <ImagePlus className="h-6 w-6" />
                      </span>
                      <span className="text-sm font-medium text-slate-800">
                        <span className="sm:hidden">Tap to upload a cover image</span>
                        <span className="hidden sm:inline">Drag an image here, or click to browse</span>
                      </span>
                      <span className="text-xs text-slate-500">JPG, PNG or WebP · up to {MAX_IMAGE_MB} MB</span>
                    </button>
                  )}
                </Section>

                {/* Basics */}
                <Section title="Basics">
                  <div>
                    <Label icon={Type} htmlFor="ev-title">Event title *</Label>
                    <input
                      id="ev-title"
                      ref={titleRef}
                      type="text"
                      required
                      value={formData.title}
                      onChange={(e) => set({ title: e.target.value })}
                      className={inputCls}
                      placeholder="Neural Nexus"
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
                    {categories.length === 0 ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        No categories yet. Tap &quot;Manage categories&quot; to create one.
                      </div>
                    ) : (
                      <div role="radiogroup" aria-label="Category" className="flex flex-wrap gap-2">
                        {categories.map((c) => {
                          const active = formData.category === c.name;
                          return (
                            <button
                              key={c.id}
                              type="button"
                              role="radio"
                              aria-checked={active}
                              onClick={() => set({ category: c.name })}
                              className={`min-h-[40px] rounded-full px-4 text-sm font-medium ring-1 transition ${
                                active
                                  ? 'bg-indigo-600 text-white ring-indigo-600 shadow-sm shadow-indigo-600/30'
                                  : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              {c.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
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
                      placeholder="Tech Hub, Karunya University"
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
            <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={safeClose}
                disabled={loading}
                className="min-h-[48px] rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 sm:min-h-[44px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 text-sm font-medium text-white shadow-sm shadow-indigo-600/30 transition hover:bg-indigo-700 disabled:opacity-60 sm:min-h-[44px] sm:min-w-[160px]"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    {coverProgress !== null ? 'Uploading…' : 'Adding…'}
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Add event
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}