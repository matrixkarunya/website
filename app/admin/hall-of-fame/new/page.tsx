// app/admin/hall-of-fame/new/page.tsx
'use client';

import AchievementForm from '@/components/admin/AchievementForm';
import { useAdminGuard } from '@/lib/useAdminGuard';

export default function NewAchievementPage() {
  const { loading, ready } = useAdminGuard();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }
  if (!ready) return null;

  return <AchievementForm mode="create" />;
}