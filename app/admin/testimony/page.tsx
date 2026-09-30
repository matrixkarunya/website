'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  deleteDoc,
  doc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { motion } from 'framer-motion';
import { ArrowLeft, Plus, Quote } from 'lucide-react';
import Toast from '@/components/admin/Toast';
import DeleteConfirmModal from '@/components/admin/DeleteConfirmModal';
import AddTestimonyModal from '@/components/admin/AddTestimonyModal';
import EditTestimonyModal from '@/components/admin/EditTestimonyModal';
import Image from 'next/image';

export interface Testimony {
  id: string;
  name: string;
  role: string;
  quote: string;
  imageUrl?: string;
  imagePublicId?: string;
  order: number;
  createdAt: any;
}

const AdminBackground = () => (
  <div className="fixed inset-0 w-full h-full -z-10 bg-black">
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-black to-black" />
    <div className="absolute inset-0 backdrop-blur-sm bg-white/[0.03]" />
  </div>
);

// ── Admin Testimony Card ──────────────────────────────────────────────────────
function TestimonyAdminCard({
  testimony,
  index,
  onEdit,
  onDelete,
}: {
  testimony: Testimony;
  index: number;
  onEdit: (t: Testimony) => void;
  onDelete: (t: Testimony) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="relative flex flex-col gap-4 p-5 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 hover:bg-white/8 hover:border-white/20 transition-all"
    >
      {/* Order badge */}
      <div className="absolute top-3 right-3 px-2 py-0.5 rounded-md bg-white/10 border border-white/15 text-[10px] font-bold text-white/50 font-mono">
        #{testimony.order}
      </div>

      <Quote className="w-4 h-4 text-white/25 flex-shrink-0" />

      {/* Quote */}
      <p className="text-sm text-white/80 leading-[1.75] line-clamp-4">
        &ldquo;{testimony.quote}&rdquo;
      </p>

      {/* Author */}
      <div className="flex items-center gap-2.5 pt-3 border-t border-white/10">
        {testimony.imageUrl ? (
          <Image
            src={testimony.imageUrl}
            alt={testimony.name}
            width={36}
            height={36}
            className="rounded-full object-cover flex-shrink-0 outline outline-2 outline-white/20 outline-offset-1"
          />
        ) : (
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black text-white bg-white/15 border border-white/22 flex-shrink-0">
            {testimony.name.charAt(0)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate">{testimony.name}</p>
          <p className="text-xs text-white/45 truncate">{testimony.role}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onEdit(testimony)}
          className="flex-1 py-2 text-xs font-semibold rounded-lg bg-white/8 hover:bg-white/15 border border-white/15 hover:border-white/25 text-white/80 hover:text-white transition-all"
        >
          Edit
        </button>
        <button
          onClick={() => onDelete(testimony)}
          className="flex-1 py-2 text-xs font-semibold rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/35 text-red-400 hover:text-red-300 transition-all"
        >
          Delete
        </button>
      </div>
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AdminTestimonyPage() {
  const { user, isAdmin, loading } = useAuth();
  const router = useRouter();

  const [testimonies, setTestimonies] = useState<Testimony[]>([]);
  const [selectedTestimony, setSelectedTestimony] = useState<Testimony | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    type: 'success' | 'error';
  }>({ show: false, message: '', type: 'success' });

  // Auth check
  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      router.push('/admin/login');
    }
  }, [user, isAdmin, loading, router]);

  // Fetch testimonies
  useEffect(() => {
    const q = query(collection(db, 'testimonies'), orderBy('order', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const data: Testimony[] = [];
      snap.forEach((doc) =>
        data.push({ id: doc.id, ...doc.data() } as Testimony)
      );
      setTestimonies(data);
    });
    return () => unsub();
  }, []);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  const handleEdit = (t: Testimony) => {
    setSelectedTestimony(t);
    setShowEditModal(true);
  };

  const handleDelete = (t: Testimony) => {
    setSelectedTestimony(t);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!selectedTestimony) return;
    try {
      // Delete image from Cloudinary if exists
      if (selectedTestimony.imagePublicId) {
        await fetch('/api/cloudinary/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ publicId: selectedTestimony.imagePublicId }),
        });
      }
      await deleteDoc(doc(db, 'testimonies', selectedTestimony.id));
      showToast('Testimony deleted successfully', 'success');
      setShowDeleteModal(false);
      setSelectedTestimony(null);
    } catch (err) {
      console.error(err);
      showToast('Failed to delete testimony', 'error');
    }
  };

  if (loading) {
    return (
      <>
        <AdminBackground />
        <div className="relative min-h-screen flex items-center justify-center">
          <div className="flex items-center gap-3">
            {[0, 150, 300].map((delay) => (
              <div
                key={delay}
                className="w-2 h-2 bg-white/80 rounded-full animate-bounce"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </div>
        </div>
      </>
    );
  }

  if (!user || !isAdmin) return null;

  const featured = testimonies.slice(0, 4);
  const overflow = testimonies.length > 4;

  return (
    <>
      <AdminBackground />
      <div className="relative min-h-screen">

        {/* Header */}
        <header className="bg-white/5 backdrop-blur-xl border-b border-white/10 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => router.push('/admin/dashboard')}
                  className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/20 rounded-lg">
                    <Quote className="w-5 h-5 text-purple-400" />
                  </div>
                  <h1 className="text-xl font-bold text-white">Testimony Management</h1>
                </div>
              </div>

              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-xl border border-white/20 hover:border-white/30 text-white rounded-xl transition-all shadow-lg font-medium group"
              >
                <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
                Add Testimony
              </button>
            </div>
          </div>
        </header>

        {/* Info Banner */}
        <div className="bg-white/5 backdrop-blur-xl border-b border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg">
                <span className="text-xs text-white/50">Total</span>
                <span className="text-sm font-bold text-white">{testimonies.length}</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg">
                <span className="text-xs text-white/50">Shown on Home</span>
                <span className="text-sm font-bold text-white">{Math.min(testimonies.length, 4)}</span>
              </div>
              {overflow && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-xs text-amber-300 font-medium">
                    {testimonies.length - 4} overflow → "View All" button is active on homepage
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">

          {/* Featured on Home (first 4) */}
          <div>
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3 mb-6"
            >
              <h2 className="text-xl font-bold text-white">
                Featured on Homepage
              </h2>
              <span className="px-3 py-1 bg-white/10 border border-white/20 rounded-lg text-sm font-semibold text-white/70">
                {featured.length} / 4
              </span>
              <span className="text-xs text-white/40">
                — shown in the scrolling marquee
              </span>
            </motion.div>

            {featured.length === 0 ? (
              <div className="text-center py-20 bg-white/5 backdrop-blur-xl rounded-2xl border-2 border-dashed border-white/10">
                <Quote className="w-12 h-12 text-white/30 mx-auto mb-3" />
                <p className="text-white/55 text-lg mb-1">No testimonies yet</p>
                <p className="text-sm text-white/35">
                  Add your first testimony to get started
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {featured.map((t, i) => (
                  <TestimonyAdminCard
                    key={t.id}
                    testimony={t}
                    index={i}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Overflow (shown on /Testimony page only) */}
          {overflow && (
            <div>
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-3 mb-6"
              >
                <h2 className="text-xl font-bold text-white">
                  Additional Testimonies
                </h2>
                <span className="px-3 py-1 bg-amber-500/15 border border-amber-500/25 rounded-lg text-sm font-semibold text-amber-300">
                  {testimonies.length - 4}
                </span>
                <span className="text-xs text-white/40">
                  — visible only on /Testimony page
                </span>
              </motion.div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {testimonies.slice(4).map((t, i) => (
                  <TestimonyAdminCard
                    key={t.id}
                    testimony={t}
                    index={i}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </div>
          )}
        </main>

        {/* Modals */}
        {showAddModal && (
          <AddTestimonyModal
            nextOrder={testimonies.length + 1}
            onClose={() => setShowAddModal(false)}
            onSuccess={(msg) => {
              showToast(msg, 'success');
              setShowAddModal(false);
            }}
            onError={(msg) => showToast(msg, 'error')}
          />
        )}

        {showEditModal && selectedTestimony && (
          <EditTestimonyModal
            testimony={selectedTestimony}
            onClose={() => {
              setShowEditModal(false);
              setSelectedTestimony(null);
            }}
            onSuccess={(msg) => {
              showToast(msg, 'success');
              setShowEditModal(false);
              setSelectedTestimony(null);
            }}
            onError={(msg) => showToast(msg, 'error')}
          />
        )}

        {showDeleteModal && selectedTestimony && (
          <DeleteConfirmModal
            memberName={selectedTestimony.name}
            onClose={() => {
              setShowDeleteModal(false);
              setSelectedTestimony(null);
            }}
            onConfirm={confirmDelete}
          />
        )}

        {toast.show && <Toast message={toast.message} type={toast.type} />}
      </div>
    </>
  );
}