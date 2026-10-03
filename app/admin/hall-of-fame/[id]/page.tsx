// app/admin/hall-of-fame/[id]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAdminGuard } from '@/lib/useAdminGuard';
import { ACHIEVEMENTS_COLLECTION, Achievement, toAchievement } from '@/lib/hallOfFame';
import AchievementForm from '@/components/admin/AchievementForm';

function Spinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
    </div>
  );
}

export default function EditAchievementPage() {
  const { loading, ready } = useAdminGuard();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [achievement, setAchievement] = useState<Achievement | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');

  // Loaded once (not live) so changes elsewhere never overwrite what you are typing
  useEffect(() => {
    if (!ready || !id) return;
    let alive = true;
    getDoc(doc(db, ACHIEVEMENTS_COLLECTION, id))
      .then((snap) => {
        if (!alive) return;
        if (!snap.exists()) {
          setState('missing');
          return;
        }
        setAchievement(toAchievement(snap.id, snap.data()));
        setState('ready');
      })
      .catch((err) => {
        console.error('Error loading achievement:', err);
        if (alive) setState('error');
      });
    return () => {
      alive = false;
    };
  }, [ready, id]);

  if (loading) return <Spinner />;
  if (!ready) return null;
  if (state === 'loading') return <Spinner />;

  if (state !== 'ready' || !achievement) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="max-w-sm rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="font-semibold text-slate-900">
            {state === 'missing' ? 'Achievement not found' : "Couldn't load this achievement"}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {state === 'missing'
              ? 'It may have been deleted.'
              : 'Check your connection and try again.'}
          </p>
          <Link
            href="/admin/hall-of-fame"
            className="mt-5 inline-flex min-h-[44px] items-center rounded-lg bg-slate-100 px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200"
          >
            Back to achievements
          </Link>
        </div>
      </div>
    );
  }

  return <AchievementForm mode="edit" initial={achievement} />;
}