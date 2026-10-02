// components/admin/TimelineEntryModal.tsx
'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { Info, Pencil, Plus, X } from 'lucide-react';
import { db } from '@/lib/firebase';
import {
  chapterLabel,
  FIRST_EDITABLE_YEAR,
  TIMELINE_LIMITS as L,
  type TimelineEntry,
} from '@/lib/timeline';

interface Props {
  /** Pass an entry to edit it; omit to add a new year */
  entry?: TimelineEntry;
  existingYears: number[];
  suggestedYear: number;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

const inputClass =
  'min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 disabled:bg-slate-50 disabled:text-slate-500';

const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600';

function Field({
  id,
  label,
  required,
  hint,
  count,
  max,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  count?: number;
  max?: number;
  children: React.ReactNode;
}) {
  const near = max !== undefined && count !== undefined && count >= max * 0.9;
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-slate-700">
          {label}
          {required && <span className="text-red-600"> *</span>}
        </label>
        {max !== undefined && count !== undefined && (
          <span className={`text-xs tabular-nums ${near ? 'text-amber-600' : 'text-slate-500'}`}>
            {count}/{max}
          </span>
        )}
      </div>
      {children}
      {hint && (
        <p className="mt-1.5 flex items-start gap-1.5 text-xs text-slate-500">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {hint}
        </p>
      )}
    </div>
  );
}

export default function TimelineEntryModal({
  entry,
  existingYears,
  suggestedYear,
  onClose,
  onSuccess,
  onError,
}: Props) {
  const isEdit = !!entry;

  const initial = useRef({
    year: String(entry?.year ?? suggestedYear),
    tag: entry?.tag ?? '',
    title: entry?.title ?? '',
    body: entry?.body ?? '',
    events: String(entry?.events ?? 0),
    badge: entry?.badge ?? '',
  });
  const [form, setForm] = useState(initial.current);
  const [loading, setLoading] = useState(false);
  const firstRef = useRef<HTMLInputElement>(null);

  const update = (key: keyof typeof form, value: string) =>
    setForm((p) => ({ ...p, [key]: value }));

  const dirty = JSON.stringify(form) !== JSON.stringify(initial.current);

  const requestClose = useCallback(() => {
    if (loading) return;
    if (dirty && !window.confirm('Discard your changes?')) return;
    onClose();
  }, [loading, dirty, onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && requestClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [requestClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    firstRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const yearNum = parseInt(form.year, 10);
  // Chapter number = position among all years (2023 is chapter 01)
  const chapterNumber = existingYears.filter((y) => y < yearNum && y !== entry?.year).length + 2;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || (isEdit && !dirty)) return;

    if (!Number.isInteger(yearNum) || yearNum < FIRST_EDITABLE_YEAR || yearNum > 2100) {
      onError(`Year must be ${FIRST_EDITABLE_YEAR} or later (2023 is fixed).`);
      return;
    }
    if (!isEdit && existingYears.includes(yearNum)) {
      onError(`${yearNum} already exists. Edit it instead.`);
      return;
    }
    const events = parseInt(form.events, 10);
    if (!Number.isInteger(events) || events < 0 || events > L.eventsMax) {
      onError(`Events must be between 0 and ${L.eventsMax}.`);
      return;
    }

    const data = {
      year: yearNum,
      tag: form.tag.trim(),
      title: form.title.trim(),
      body: form.body.trim(),
      events,
      badge: form.badge.trim() || null,
      updatedAt: serverTimestamp(),
    };

    setLoading(true);
    try {
      if (isEdit) {
        await updateDoc(doc(db, 'timeline', entry!.id), data);
        onSuccess(`${yearNum} updated`);
      } else {
        // Doc id = year, so a year can never be duplicated
        await setDoc(doc(db, 'timeline', String(yearNum)), { ...data, createdAt: serverTimestamp() });
        onSuccess(`${yearNum} added to the timeline`);
      }
    } catch (error) {
      console.error('Error saving timeline entry:', error);
      onError("Couldn't save this year. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const formId = 'timeline-entry-form';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && requestClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="timeline-modal-title"
        className="flex max-h-[94vh] w-full max-w-xl flex-col rounded-t-2xl bg-white shadow-xl sm:max-h-[90vh] sm:rounded-2xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-600">
              {isEdit ? <Pencil className="h-5 w-5 text-white" /> : <Plus className="h-5 w-5 text-white" />}
            </div>
            <div className="min-w-0">
              <h2 id="timeline-modal-title" className="text-lg font-bold text-slate-900">
                {isEdit ? `Edit ${entry!.year}` : 'Add year'}
              </h2>
              <p className="text-sm text-slate-500">Fields marked * are required.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={requestClose}
            disabled={loading}
            aria-label="Close"
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 ${focusRing}`}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form id={formId} onSubmit={handleSubmit} className="flex-1 space-y-5 overflow-y-auto px-5 py-6 sm:px-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              id="tl-year"
              label="Year"
              required
              hint={isEdit ? 'The year can’t be changed. Delete and re-add to move it.' : 'Academic year label is generated for you.'}
            >
              <input
                id="tl-year"
                ref={firstRef}
                type="number"
                required
                min={FIRST_EDITABLE_YEAR}
                max={2100}
                inputMode="numeric"
                disabled={isEdit}
                value={form.year}
                onChange={(e) => update('year', e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field id="tl-events" label="Event count" required hint={`0 to ${L.eventsMax}`}>
              <input
                id="tl-events"
                type="number"
                required
                min={0}
                max={L.eventsMax}
                inputMode="numeric"
                value={form.events}
                onChange={(e) => update('events', e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>

          <Field
            id="tl-tag"
            label="Chapter tag"
            required
            count={form.tag.length}
            max={L.tag}
            hint={`Shown as “${chapterLabel(chapterNumber, form.tag.trim() || 'Your tag')}”`}
          >
            <input
              id="tl-tag"
              type="text"
              required
              maxLength={L.tag}
              value={form.tag}
              onChange={(e) => update('tag', e.target.value)}
              className={inputClass}
              placeholder="Growth"
            />
          </Field>

          <Field id="tl-title" label="Title" required count={form.title.length} max={L.title}>
            <input
              id="tl-title"
              type="text"
              required
              maxLength={L.title}
              value={form.title}
              onChange={(e) => update('title', e.target.value)}
              className={inputClass}
              placeholder="Finding Our Rhythm"
            />
          </Field>

          <Field id="tl-body" label="Content" required count={form.body.length} max={L.body}>
            <textarea
              id="tl-body"
              required
              rows={5}
              maxLength={L.body}
              value={form.body}
              onChange={(e) => update('body', e.target.value)}
              className={`${inputClass} resize-none`}
              placeholder="What happened this year?"
            />
          </Field>

          <Field
            id="tl-badge"
            label="Badge (optional)"
            count={form.badge.length}
            max={L.badge}
            hint="Small pill next to the event count, e.g. “Rebrand”."
          >
            <input
              id="tl-badge"
              type="text"
              maxLength={L.badge}
              value={form.badge}
              onChange={(e) => update('badge', e.target.value)}
              className={inputClass}
              placeholder="Rebrand"
            />
          </Field>
        </form>

        <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:rounded-b-2xl sm:px-6">
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
            {isEdit && dirty && !loading && (
              <p className="text-center text-sm text-slate-500 sm:mr-auto sm:text-left">Unsaved changes</p>
            )}
            <button
              type="button"
              onClick={requestClose}
              disabled={loading}
              className={`min-h-[44px] rounded-lg bg-slate-100 px-5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200 disabled:opacity-60 ${focusRing}`}
            >
              Cancel
            </button>
            <button
              type="submit"
              form={formId}
              disabled={loading || (isEdit && !dirty)}
              className={`flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-60 ${focusRing}`}
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/60 border-t-transparent" />
                  Saving…
                </>
              ) : isEdit ? (
                'Save changes'
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Add year
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}