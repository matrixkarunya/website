// lib/useAdminGuard.ts
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Redirects to /admin/login unless the visitor is an admin or superadmin.
 * `ready` is true only once access is confirmed, so pages can render nothing
 * (or a spinner) until then.
 */
export function useAdminGuard() {
  const { user, isAdmin, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      router.push('/admin/login');
    }
  }, [user, isAdmin, loading, router]);

  return { loading, ready: !loading && !!user && isAdmin };
}