// components/admin/ManageMomentsModal.tsx
'use client';

import React, { useEffect } from 'react';
import { X, Images } from 'lucide-react';
import MomentsManager from './MomentsManager';

interface ManageMomentsModalProps {
  eventId: string;
  eventTitle: string;
  onClose: () => void;
  onToast: (message: string, type: 'success' | 'error') => void;
}

export default function ManageMomentsModal({
  eventId,
  eventTitle,
  onClose,
  onToast,
}: ManageMomentsModalProps) {
  /* ---- modal behaviour: scroll lock + Esc to close ---- */
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="manage-moments-title"
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
              <Images className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 id="manage-moments-title" className="truncate text-lg font-semibold text-slate-900">
                Event moments
              </h2>
              <p className="truncate text-xs text-slate-500">{eventTitle}</p>
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

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6 sm:py-6">
          <MomentsManager eventId={eventId} onToast={onToast} />
          <p className="mt-5 text-xs text-slate-400">
            Changes are saved instantly and appear on the public event page straight away.
          </p>
        </div>

        {/* Footer: sticky, respects iPhone home-indicator safe area */}
        <div className="shrink-0 border-t border-slate-200 bg-white px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-4">
          <div className="flex flex-col sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[48px] rounded-xl bg-indigo-600 px-6 text-sm font-medium text-white shadow-sm shadow-indigo-600/30 transition hover:bg-indigo-700 sm:min-h-[44px] sm:min-w-[160px]"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}