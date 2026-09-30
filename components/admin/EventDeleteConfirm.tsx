// components/admin/EventDeleteConfirm.tsx
import React, { useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';

interface EventDeleteConfirmProps {
  eventTitle: string;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}

export default function EventDeleteConfirm({
  eventTitle,
  onClose,
  onConfirm,
}: EventDeleteConfirmProps) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl max-w-md w-full p-6 shadow-2xl">
        <div className="flex items-center justify-center mb-5">
          <div className="w-20 h-20 bg-red-500/20 backdrop-blur-xl border-2 border-red-500/30 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-10 h-10 text-red-400" />
          </div>
        </div>

        <h2 className="text-2xl font-bold text-white text-center mb-3">Delete Event?</h2>

        <p className="text-white/70 text-center mb-6 leading-relaxed">
          Are you sure you want to permanently delete{' '}
          <span className="font-semibold text-white">{eventTitle}</span>?
        </p>

        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 backdrop-blur-xl">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-300 mb-2">
                This action cannot be undone
              </p>
              <ul className="text-sm text-red-200/80 space-y-1.5">
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-0.5">•</span>
                  <span>Event data will be permanently deleted</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-0.5">•</span>
                  <span>Event image will be removed from storage</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-0.5">•</span>
                  <span>This cannot be recovered later</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg font-medium transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 px-4 py-3 bg-red-700 hover:bg-red-800 text-white rounded-lg font-medium transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-500/20 disabled:opacity-50"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            {loading ? 'Deleting...' : 'Delete Permanently'}
          </button>
        </div>
      </div>
    </div>
  );
}