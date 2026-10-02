// app/admin/dashboard/page.tsx
// No Firestore reads or writes on this page (auth only).
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import {
  Lock,
  LogOut,
  Info,
  CalendarDays,
  Users,
  Quote,
  Route,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';

interface Section {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
}

const SECTIONS: Section[] = [
  { title: 'About', description: 'About page and stats', href: '/admin/about', icon: Info },
  { title: 'Events', description: 'Manage events & galleries', href: '/admin/events', icon: CalendarDays },
  { title: 'Team', description: 'Manage team members', href: '/admin/team', icon: Users },
  { title: 'Timeline', description: 'Manage yearly journey', href: '/admin/timeline', icon: Route },
  { title: 'Testimony', description: 'Manage testimonials', href: '/admin/testimony', icon: Quote },
];

// Shown to the superadmin only
const ADMIN_SECTION: Section = {
  title: 'Admins',
  description: 'Add and manage admins',
  href: '/admin/users',
  icon: ShieldCheck,
};

export default function AdminDashboard() {
  const { user, signOut, isAdmin, isSuperAdmin, loading } = useAuth();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  // Redirect to login if not authenticated or not admin
  React.useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      router.push('/admin/login');
    }
  }, [user, isAdmin, loading, router]);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      router.push('/admin/login');
    } catch (error) {
      console.error('Error signing out:', error);
      setSigningOut(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return null;
  }

  const sections = isSuperAdmin ? [...SECTIONS, ADMIN_SECTION] : SECTIONS;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white pt-[env(safe-area-inset-top)] shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-600">
                <Lock className="h-5 w-5 text-white" />
              </div>
              <h1 className="truncate text-lg font-bold text-slate-900 sm:text-xl">Admin Dashboard</h1>
            </div>

            <div className="flex items-center gap-3 sm:gap-4">
              {/* Name/email hidden on small screens so the header never overflows */}
              <div className="hidden min-w-0 text-right sm:block">
                <p className="max-w-[200px] truncate text-sm font-medium text-slate-900">{user.displayName}</p>
                <p className="max-w-[200px] truncate text-xs text-slate-500">{user.email}</p>
              </div>
              <button
                onClick={handleSignOut}
                disabled={signingOut}
                aria-label="Sign out"
                className="flex min-h-[44px] items-center gap-2 rounded-lg bg-slate-100 px-3.5 text-slate-700 transition-colors hover:bg-slate-200 disabled:opacity-60 sm:px-4"
              >
                {signingOut ? (
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
                ) : (
                  <LogOut className="h-5 w-5" />
                )}
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {/* Welcome Section */}
        <div className="mb-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="mb-2 text-xl font-bold text-slate-900 sm:text-2xl">
            Welcome back, {user.displayName?.split(' ')[0] || 'Admin'}
          </h2>
          <p className="text-slate-600">Manage your team members, content, and settings from here.</p>
        </div>

        {/* Sections */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h3 className="mb-4 text-lg font-bold text-slate-900">Manage</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {sections.map(({ title, description, href, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="group flex min-h-[132px] flex-col items-center justify-center rounded-lg border border-slate-200 bg-white p-4 text-center transition-colors hover:border-indigo-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition-colors group-hover:bg-indigo-600 group-hover:text-white">
                  <Icon className="h-6 w-6" />
                </div>
                <h4 className="mb-1 font-semibold text-slate-900">{title}</h4>
                <p className="text-xs text-slate-500">{description}</p>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}