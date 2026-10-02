// components/admin/MoveToPastModal.tsx
'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Archive, Calendar, GraduationCap, User } from 'lucide-react';
import { db } from '@/lib/firebase';
import { TeamMember } from '@/app/admin/team/page';

interface MoveToPastModalProps {
  member: TeamMember;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600';

function Avatar({ name, src }: { name: string; src?: string }) {
  const [failed, setFailed] = useState(false);
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  if (!src || failed) {
    return (
      <div
        aria-hidden="true"
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-200 text-sm font-semibold text-slate-600"
      >
        {initials || '?'}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      onError={() => setFailed(true)}
      className="h-12 w-12 shrink-0 rounded-xl bg-slate-200 object-cover"
    />
  );
}

export default function MoveToPastModal({ member, onClose, onSuccess, onError }: MoveToPastModalProps) {
  const [loading, setLoading] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);

  const requestClose = useCallback(() => {
    if (!loading) onClose();
  }, [loading, onClose]);

  // Esc closes, body scroll is locked, confirm button is focused so Enter confirms
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [requestClose]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    confirmRef.current?.focus();
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const handleConfirm = async () => {
    if (loading) return;
    setLoading(true);

    try {
      // Update member status to past (isCurrent = false)
      await updateDoc(doc(db, 'team', member.id), {
        isCurrent: false,
        updatedAt: serverTimestamp(),
      });

      onSuccess(`${member.name} moved to History`);
    } catch (error) {
      console.error('Error moving member to past:', error);
      onError("Couldn't move this member to History. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const isFaculty = member.category === 'faculty';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="move-member-title"
        aria-describedby="move-member-desc"
        className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl sm:p-6"
      >
        {/* Title */}
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <Archive className="h-5 w-5" />
          </div>
          <div>
            <h2 id="move-member-title" className="text-lg font-bold text-slate-900">
              Move to History?
            </h2>
            <p id="move-member-desc" className="mt-1 text-sm text-slate-600">
              <span className="font-medium text-slate-900">{member.name}</span> will leave the current team and appear
              under History.
            </p>
          </div>
        </div>

        {/* Member summary */}
        <div className="mt-5 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <Avatar name={member.name} src={member.imageUrl} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-slate-900">{member.name}</p>
            <p className="truncate text-sm text-slate-600">{member.role}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-200">
                <Calendar className="h-3 w-3" />
                {member.academicYear}
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${
                  isFaculty ? 'bg-indigo-50 text-indigo-700' : 'bg-white text-slate-700 ring-1 ring-inset ring-slate-200'
                }`}
              >
                {isFaculty ? <GraduationCap className="h-3 w-3" /> : <User className="h-3 w-3" />}
                {isFaculty ? 'Faculty' : 'Student'}
              </span>
            </div>
          </div>
        </div>

        {/* What changes */}
        <ul className="mt-4 space-y-1.5 text-sm text-slate-600">
          <li className="flex gap-2">
            <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
            Their academic year ({member.academicYear}) stays the same.
          </li>
          <li className="flex gap-2">
            <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
            You can move them back anytime by editing their status.
          </li>
        </ul>

        {/* Buttons */}
        <div className="mt-6 flex flex-col-reverse gap-3 pb-[env(safe-area-inset-bottom)] sm:flex-row sm:justify-end sm:pb-0">
          <button
            type="button"
            onClick={requestClose}
            disabled={loading}
            className={`min-h-[44px] rounded-lg bg-slate-100 px-5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200 disabled:opacity-60 ${focusRing}`}
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className={`flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-60 ${focusRing}`}
          >
            {loading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/60 border-t-transparent" />
                Moving…
              </>
            ) : (
              <>
                <Archive className="h-4 w-4" />
                Move to History
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}