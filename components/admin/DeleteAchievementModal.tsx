// components/admin/DeleteAchievementModal.tsx
'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface DeleteAchievementModalProps {
  /** Title of the achievement being deleted. */
  title: string;
  /** How many winners it lists (shown in the warning). */
  winnerCount: number;
  onClose: () => void;
  onConfirm: () => void;
  /** Pass true while the delete is running to lock the dialog and show a spinner. */
  loading?: boolean;
}

export default function DeleteAchievementModal({
  title,
  winnerCount,
  onClose,
  onConfirm,
  loading = false,
}: DeleteAchievementModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  const safeClose = useCallback(() => {
    if (!loading) onClose();
  }, [loading, onClose]);

  // Scroll lock + Esc to close + focus the SAFE button (Cancel) by default
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    cancelRef.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && safeClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [safeClose]);

  const consequences = [
    winnerCount > 0
      ? `The achievement and its ${winnerCount} ${winnerCount === 1 ? 'winner' : 'winners'} will be permanently deleted`
      : 'The achievement will be permanently deleted',
    'All its photos will be removed',
    'It will disappear from the public Hall of Fame',
    'This cannot be recovered later',
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && safeClose()}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="delete-achievement-title"
      aria-describedby="delete-achievement-desc"
    >
      <div className="relative max-h-[94dvh] w-full overflow-y-auto overscroll-contain rounded-t-3xl bg-white shadow-2xl sm:max-w-md sm:rounded-3xl">
        {/* Mobile drag handle (visual) */}
        <div className="flex justify-center pt-2 sm:hidden">
          <span className="h-1 w-10 rounded-full bg-slate-300" />
        </div>

        <button
          type="button"
          onClick={safeClose}
          disabled={loading}
          aria-label="Close"
          className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="px-5 pb-5 pt-6 sm:px-6 sm:pt-8">
          <div className="mb-5 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 ring-8 ring-rose-50/60">
              <AlertTriangle className="h-8 w-8 text-rose-600" />
            </div>
          </div>

          <h2 id="delete-achievement-title" className="mb-2 text-center text-xl font-semibold text-slate-900">
            Delete achievement?
          </h2>

          <p id="delete-achievement-desc" className="mb-5 text-center leading-relaxed text-slate-600">
            You are about to permanently delete{' '}
            <span className="break-words font-semibold text-slate-900">{title}</span>.
          </p>

          <div className="mb-6 rounded-2xl border border-rose-100 bg-rose-50/70 p-4">
            <p className="mb-2 text-sm font-semibold text-rose-800">This action cannot be undone</p>
            <ul className="space-y-1.5 text-sm text-rose-700/90">
              {consequences.map((t) => (
                <li key={t} className="flex items-start gap-2">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-rose-400" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-2.5 pb-[max(0rem,env(safe-area-inset-bottom))] sm:flex-row-reverse">
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-medium text-white shadow-sm shadow-rose-600/30 transition hover:bg-rose-700 disabled:opacity-60 sm:min-h-[44px]"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Deleting…
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Delete permanently
                </>
              )}
            </button>
            <button
              ref={cancelRef}
              type="button"
              onClick={safeClose}
              disabled={loading}
              className="min-h-[48px] flex-1 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 sm:min-h-[44px]"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}