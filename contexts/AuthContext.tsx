// contexts/AuthContext.tsx
'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '@/lib/firebase';

export type Role = 'superadmin' | 'admin' | null;

interface AuthContextType {
  user: User | null;
  loading: boolean;
  role: Role;
  isAdmin: boolean; // true for admin AND superadmin
  isSuperAdmin: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  role: null,
  isAdmin: false,
  isSuperAdmin: false,
  signInWithGoogle: async () => {},
  signOut: async () => {},
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

// Role comes from the document at admins/{lowercase email}
async function resolveRole(user: User | null): Promise<Role> {
  if (!user?.email) return null;
  try {
    const snap = await getDoc(doc(db, 'admins', user.email.toLowerCase()));
    if (!snap.exists()) return null;
    const role = snap.data().role;
    return role === 'superadmin' || role === 'admin' ? role : null;
  } catch (error) {
    console.error('Error resolving role:', error);
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      const resolved = await resolveRole(firebaseUser);
      setUser(firebaseUser);
      setRole(resolved);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signInWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const resolved = await resolveRole(result.user);
      if (!resolved) {
        await firebaseSignOut(auth);
        throw new Error('Unauthorized: You do not have access to this area');
      }
    } catch (error) {
      console.error('Error signing in with Google:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    role,
    isAdmin: role === 'admin' || role === 'superadmin',
    isSuperAdmin: role === 'superadmin',
    signInWithGoogle,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}