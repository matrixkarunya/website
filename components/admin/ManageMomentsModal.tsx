// components/admin/ManageMomentsModal.tsx
import React from 'react';
import { X, Images } from 'lucide-react';
import MomentsManager from './MomentsManager';
import styles from './adminModal.module.css';

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
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div
        className="flex w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-white/20 bg-white/10 shadow-2xl backdrop-blur-2xl"
        style={{ maxHeight: '100%' }}
      >
        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-white/10 bg-white/5 px-6 py-4 backdrop-blur-xl">
          <div className="min-w-0">
            <h2 className="flex items-center gap-3 text-2xl font-bold text-white">
              <div className="rounded-lg bg-blue-500/20 p-2">
                <Images className="h-5 w-5 text-blue-400" />
              </div>
              Event Moments
            </h2>
            <p className="ml-11 mt-1 truncate text-sm text-white/60">{eventTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-white/60 transition-all hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div
          className={`flex-1 overflow-y-auto px-6 py-6 ${styles.scroll}`}
          style={{ minHeight: 0 }}
        >
          <MomentsManager eventId={eventId} onToast={onToast} />
          <p className="mt-5 text-xs text-white/40">
            Changes are saved instantly and appear on the public event page straight away.
          </p>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-white/10 bg-white/5 px-6 py-4 backdrop-blur-xl">
          <button
            onClick={onClose}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 font-medium text-white transition-all hover:bg-white/10"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}