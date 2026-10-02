// components/admin/AddTestimonyModal.tsx
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  uploadToCloudinary,
  uploadToCloudinaryWithProgress,
  isProgressUploadConfigured,
} from '@/lib/cloudinary';
import { saveTestimonyAtPosition, HOME_TESTIMONY_COUNT } from '@/lib/testimonyOrder';
import {
  X,
  Plus,
  User,
  GraduationCap,
  Quote,
  ListOrdered,
  Info,
  ImagePlus,
  RefreshCw,
  Trash2,
  Eye,
} from 'lucide-react';

import type { LucideIcon } from 'lucide-react';

interface AddTestimonyModalProps {
  nextOrder: number; // current count + 1 (the last possible position)
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

const MAX_IMAGE_MB = 10;
const MAX_QUOTE = 600;

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

export default function AddTestimonyModal({
  nextOrder,
  onClose,
  onSuccess,
  onError,
}: AddTestimonyModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    role: '',
    quote: '',
    order: String(nextOrder),
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [photoProgress, setPhotoProgress] = useState<number | null>(null);
  const [photoIndeterminate, setPhotoIndeterminate] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const set = (patch: Partial<typeof formData>) => setFormData((f) => ({ ...f, ...patch }));

  /* ---- modal behaviour: scroll lock, Esc to close, autofocus ---- */
  const safeClose = useCallback(() => {
    if (!loading) onClose();
  }, [loading, onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => nameRef.current?.focus({ preventScroll: true }), 150);
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

  /* ---- position helpers ---- */
  const clampOrder = (value: string) => {
    const n = parseInt(value, 10);
    if (Number.isNaN(n)) return nextOrder;
    return Math.min(nextOrder, Math.max(1, n));
  };

  const orderNumber = clampOrder(formData.order);
  const onHomepage = orderNumber <= HOME_TESTIMONY_COUNT;

  /* ---- photo upload with a single progress bar (hidden again when done) ---- */
  const uploadPhoto = async (file: File) => {
    const measurable = isProgressUploadConfigured();
    setPhotoIndeterminate(!measurable);
    setPhotoProgress(0);
    try {
      return measurable
        ? await uploadToCloudinaryWithProgress(file, setPhotoProgress)
        : await uploadToCloudinary(file);
    } finally {
      setPhotoProgress(null);
    }
  };

  /* ---- submit ---- */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.role.trim() || !formData.quote.trim()) {
      onError('Name, role and quote are required');
      return;
    }

    setLoading(true);
    try {
      let imageUrl = '';
      let imagePublicId = '';

      if (imageFile) {
        const result = await uploadPhoto(imageFile);
        imageUrl = result.url;
        imagePublicId = result.publicId;
      }

      // Inserts at the chosen position and shifts the others down (atomic)
      const placedAt = await saveTestimonyAtPosition({
        fields: {
          name: formData.name.trim(),
          role: formData.role.trim(),
          quote: formData.quote.trim(),
          imageUrl,
          imagePublicId,
        },
        position: orderNumber,
      });

      onSuccess(
        placedAt < nextOrder
          ? `Testimony added at position ${placedAt}. Others moved down.`
          : 'Testimony added successfully'
      );
    } catch (error) {
      console.error('Error adding testimony:', error);
      onError('Failed to add testimony. Check your photo and try again.');
    } finally {
      setLoading(false);
    }
  };

  /* ---- live preview card (desktop only) ---- */
  const initials = formData.name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

  const Preview = (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <Quote className="h-5 w-5 text-indigo-200" />
      <p
        className={`mt-2 line-clamp-6 whitespace-pre-line text-sm leading-relaxed ${
          formData.quote ? 'text-slate-700' : 'text-slate-300'
        }`}
      >
        {formData.quote || 'Their experience with MATRIX will appear here.'}
      </p>
      <div className="mt-4 flex items-center gap-3 border-t border-slate-100 pt-4">
        {imagePreview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imagePreview} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200">
            {initials || <User className="h-4 w-4 text-indigo-300" />}
          </span>
        )}
        <div className="min-w-0">
          <p className={`truncate text-sm font-semibold ${formData.name ? 'text-slate-900' : 'text-slate-300'}`}>
            {formData.name || 'Full name'}
          </p>
          <p className={`truncate text-xs ${formData.role ? 'text-slate-500' : 'text-slate-300'}`}>
            {formData.role || 'Role / batch'}
          </p>
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
      aria-labelledby="add-testimony-title"
    >
      <div className="flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-slate-50 shadow-2xl sm:max-h-[90dvh] sm:max-w-3xl sm:rounded-3xl">
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
              <h2 id="add-testimony-title" className="truncate text-lg font-semibold text-slate-900">
                Add testimony
              </h2>
              <p className="truncate text-xs text-slate-500">Share what someone says about MATRIX</p>
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
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-8">
              {/* Left: fields */}
              <div className="space-y-7">
                {/* Photo */}
                <Section title="Photo (optional)">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => acceptFile(e.target.files?.[0])}
                  />
                  {imagePreview ? (
                    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imagePreview}
                        alt="Photo preview"
                        className="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-indigo-100"
                      />
                      <p className="min-w-0 flex-1 truncate text-sm text-slate-600">{imageFile?.name}</p>
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={() => fileRef.current?.click()}
                          disabled={loading}
                          className="flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          Replace
                        </button>
                        <button
                          type="button"
                          onClick={removeImage}
                          disabled={loading}
                          aria-label="Remove photo"
                          className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-rose-600 shadow-sm transition hover:bg-rose-50 disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
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
                      className={`flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition ${
                        dragOver
                          ? 'border-indigo-400 bg-indigo-50'
                          : 'border-slate-300 bg-white hover:border-indigo-300 hover:bg-indigo-50/40'
                      }`}
                    >
                      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                        <ImagePlus className="h-6 w-6" />
                      </span>
                      <span className="text-sm font-medium text-slate-800">
                        <span className="sm:hidden">Tap to upload a photo</span>
                        <span className="hidden sm:inline">Drag a photo here, or click to browse</span>
                      </span>
                      <span className="text-xs text-slate-500">JPG, PNG or WebP · up to {MAX_IMAGE_MB} MB</span>
                    </button>
                  )}
                </Section>

                {/* Person */}
                <Section title="Person">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <Label icon={User} htmlFor="ts-name">Full name *</Label>
                      <input
                        id="ts-name"
                        ref={nameRef}
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => set({ name: e.target.value })}
                        className={inputCls}
                        placeholder="Gethsia Jennifer"
                      />
                    </div>
                    <div>
                      <Label icon={GraduationCap} htmlFor="ts-role">Role / batch *</Label>
                      <input
                        id="ts-role"
                        type="text"
                        required
                        value={formData.role}
                        onChange={(e) => set({ role: e.target.value })}
                        className={inputCls}
                        placeholder="B.Tech AI & ML, 2026"
                      />
                    </div>
                  </div>
                </Section>

                {/* Quote */}
                <Section title="Testimony">
                  <div>
                    <Label icon={Quote} htmlFor="ts-quote">Quote *</Label>
                    <textarea
                      id="ts-quote"
                      required
                      rows={5}
                      maxLength={MAX_QUOTE}
                      value={formData.quote}
                      onChange={(e) => set({ quote: e.target.value })}
                      className={`${inputCls} resize-none`}
                      placeholder="Share their experience with MATRIX..."
                    />
                    <p className="mt-1 text-right text-xs text-slate-400 tabular-nums">
                      {formData.quote.length}/{MAX_QUOTE}
                    </p>
                  </div>
                </Section>

                {/* Position */}
                <Section title="Display order">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <Label icon={ListOrdered} htmlFor="ts-order">Position</Label>
                      <input
                        id="ts-order"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={formData.order}
                        onChange={(e) => set({ order: e.target.value.replace(/\D/g, '') })}
                        onBlur={() => set({ order: String(clampOrder(formData.order)) })}
                        className={inputCls}
                        placeholder={String(nextOrder)}
                      />
                      <p className="mt-1.5 text-xs text-slate-400">
                        1 is first. Last available: {nextOrder}
                      </p>
                    </div>
                    <div
                      className={`flex flex-col justify-center rounded-xl border px-4 py-3 ${
                        onHomepage ? 'border-indigo-100 bg-indigo-50/60' : 'border-slate-200 bg-white'
                      }`}
                    >
                      <p className="text-xs text-slate-500">Where it shows</p>
                      <p
                        className={`text-lg font-semibold leading-tight ${
                          onHomepage ? 'text-indigo-700' : 'text-slate-700'
                        }`}
                      >
                        {onHomepage ? 'Homepage' : 'Testimonies page'}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                        <Info className="h-3 w-3 shrink-0" />
                        First {HOME_TESTIMONY_COUNT} appear on the homepage
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400">
                    Taking an existing position moves that testimony and the ones after it down by one.
                  </p>
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
                    A rough look at how the testimony will appear.
                  </p>
                </div>
              </aside>
            </div>
          </div>

          {/* Footer: sticky, respects iPhone home-indicator safe area */}
          <div className="shrink-0 border-t border-slate-200 bg-white px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-4">
            {photoProgress !== null && (
              <div
                className="mb-3"
                role="progressbar"
                aria-label="Uploading photo"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={photoIndeterminate ? undefined : photoProgress}
              >
                <style>{`@keyframes photoSlide{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}`}</style>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700">Uploading photo…</span>
                  {!photoIndeterminate && (
                    <span className="font-semibold tabular-nums text-indigo-700">{photoProgress}%</span>
                  )}
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  {photoIndeterminate ? (
                    <div className="h-full w-1/3 animate-[photoSlide_1.1s_ease-in-out_infinite] rounded-full bg-indigo-500" />
                  ) : (
                    <div
                      className="h-full rounded-full bg-indigo-600 transition-all duration-200"
                      style={{ width: `${photoProgress}%` }}
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
                    {photoProgress !== null ? 'Uploading…' : 'Adding…'}
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Add testimony
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