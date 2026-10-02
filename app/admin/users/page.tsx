// app/admin/users/page.tsx
// Superadmin only. Reads/writes the `admins` collection.
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import { ArrowLeft, ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';

interface AdminRecord {
  email: string;
  role: 'admin' | 'superadmin';
  addedBy?: string;
  addedAt?: Timestamp;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ManageAdminsPage() {
  const { user, isAdmin, isSuperAdmin, loading } = useAuth();
  const router = useRouter();

  const [admins, setAdmins] = useState<AdminRecord[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Only the superadmin may be here
  useEffect(() => {
    if (loading) return;
    if (!user || !isAdmin) router.push('/admin/login');
    else if (!isSuperAdmin) router.push('/admin/dashboard');
  }, [user, isAdmin, isSuperAdmin, loading, router]);

  // Live list of admins (sorted client-side so docs missing addedAt still show)
  useEffect(() => {
    if (!isSuperAdmin) return;
    const unsub = onSnapshot(
      collection(db, 'admins'),
      (snap) => {
        const rows = snap.docs.map((d) => d.data() as AdminRecord);
        rows.sort((a, b) => {
          if (a.role !== b.role) return a.role === 'superadmin' ? -1 : 1;
          return (b.addedAt?.toMillis() ?? 0) - (a.addedAt?.toMillis() ?? 0);
        });
        setAdmins(rows);
        setListLoading(false);
      },
      (err) => {
        console.error('Error loading admins:', err);
        setError('Could not load admins.');
        setListLoading(false);
      }
    );
    return unsub;
  }, [isSuperAdmin]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const clean = email.trim().toLowerCase();

    if (!EMAIL_RE.test(clean)) return setError('Enter a valid email address.');
    if (admins.some((a) => a.email === clean))
      return setError('That email already has access.');

    setAdding(true);
    try {
      await setDoc(doc(db, 'admins', clean), {
        email: clean,
        role: 'admin',
        addedBy: user?.email ?? null,
        addedAt: serverTimestamp(),
      });
      setEmail('');
    } catch (err) {
      console.error('Error adding admin:', err);
      setError('Could not add admin. Check your Firestore rules.');
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (target: string) => {
    if (!window.confirm(`Remove admin access for ${target}?`)) return;
    setError('');
    setRemoving(target);
    try {
      await deleteDoc(doc(db, 'admins', target));
    } catch (err) {
      console.error('Error removing admin:', err);
      setError('Could not remove admin.');
    } finally {
      setRemoving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (!user || !isSuperAdmin) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white pt-[env(safe-area-inset-top)] shadow-sm">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center gap-3">
            <Link
              href="/admin/dashboard"
              aria-label="Back to dashboard"
              className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="truncate text-lg font-bold text-slate-900 sm:text-xl">Manage Admins</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {/* Add admin */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="mb-1 text-lg font-bold text-slate-900">Add admin</h2>
          <p className="mb-4 text-sm text-slate-600">
            They can sign in with Google using this email and manage all content, but cannot manage admins.
          </p>
          <form onSubmit={handleAdd} className="flex flex-col gap-3 sm:flex-row">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              autoComplete="off"
              className="min-h-[44px] flex-1 rounded-lg border border-slate-300 bg-white px-3.5 text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            />
            <button
              type="submit"
              disabled={adding || !email.trim()}
              className="flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
            >
              {adding ? (
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/60 border-t-transparent" />
              ) : (
                <UserPlus className="h-5 w-5" />
              )}
              Add admin
            </button>
          </form>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </section>

        {/* Admin list */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="mb-4 text-lg font-bold text-slate-900">Admins</h2>

          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200">
            {listLoading && <li className="p-4 text-sm text-slate-500">Loading…</li>}

            {!listLoading && admins.length === 0 && (
              <li className="p-4 text-sm text-slate-500">No admins found.</li>
            )}

            {admins.map((a) => {
              const isSuper = a.role === 'superadmin';
              return (
                <li key={a.email} className="flex items-center justify-between gap-3 p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    {isSuper && (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white">
                        <ShieldCheck className="h-5 w-5" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{a.email}</p>
                      <p className="text-xs text-slate-500">
                        {isSuper ? 'Superadmin' : 'Admin'}
                        {!isSuper && a.addedAt
                          ? ` · added ${a.addedAt.toDate().toLocaleDateString()}`
                          : ''}
                      </p>
                    </div>
                  </div>
                  {!isSuper && (
                    <button
                      onClick={() => handleRemove(a.email)}
                      disabled={removing === a.email}
                      aria-label={`Remove ${a.email}`}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-60"
                    >
                      {removing === a.email ? (
                        <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
                      ) : (
                        <Trash2 className="h-5 w-5" />
                      )}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      </main>
    </div>
  );
}