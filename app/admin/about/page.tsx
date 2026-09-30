'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { motion } from 'framer-motion';
import { ArrowLeft, Upload, Loader2, ImageIcon, Check } from 'lucide-react';
import Image from 'next/image';
import Toast from '@/components/admin/Toast';

const AdminBackground = () => (
  <div className="fixed inset-0 w-full h-full -z-10 bg-black">
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-black to-black" />
    <div className="absolute inset-0 backdrop-blur-sm bg-white/[0.03]" />
  </div>
);

interface MatrixImageDoc {
  imageUrl: string;
  imagePublicId: string;
}

export default function AdminAboutPage() {
  const { user, isAdmin, loading } = useAuth();
  const router = useRouter();

  const [current, setCurrent] = useState<MatrixImageDoc | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(true);

  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    type: 'success' | 'error';
  }>({ show: false, message: '', type: 'success' });

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      router.push('/admin/login');
    }
  }, [user, isAdmin, loading, router]);

  useEffect(() => {
    const ref = doc(db, "settings", "matrixImage");
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as MatrixImageDoc;
        setCurrent(data);
        setPreview(data.imageUrl || '');
      }
      setFetching(false);
    });
    return () => unsub();
  }, []);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleSave = async () => {
    if (!file) {
      showToast('Choose a new image first', 'error');
      return;
    }
    setSaving(true);
    try {
      const oldPublicId = current?.imagePublicId;

      const result = await uploadToCloudinary(file);

      await setDoc(doc(db, "settings", "matrixImage"), {
  imageUrl: result.url,
  imagePublicId: result.publicId,
  updatedAt: serverTimestamp(),
});

      // Clean up the previous image now that the new one is confirmed saved
      if (oldPublicId) {
        await fetch('/api/cloudinary/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ publicId: oldPublicId }),
        }).catch(() => {
          // Non-fatal — orphaned image, not a broken page
        });
      }

      setFile(null);
      showToast('MATRIX section image updated', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to update image', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading || fetching) {
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

  return (
    <>
      <AdminBackground />
      <div className="relative min-h-screen">
        {/* Header */}
        <header className="bg-white/5 backdrop-blur-xl border-b border-white/10 sticky top-0 z-40">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-4 h-16">
              <button
                onClick={() => router.push('/admin/dashboard')}
                className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-all"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <ImageIcon className="w-5 h-5 text-purple-400" />
                </div>
                <h1 className="text-xl font-bold text-white">About Section — MATRIX Image</h1>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 space-y-5"
          >
            <p className="text-sm text-white/55">
              This image is used on the homepage &ldquo;About&rdquo; section, in the MATRIX panel
              (03). The other two panel images are static and not editable here.
            </p>

            {/* Preview */}
            <div
              className="relative w-full aspect-[16/10] rounded-2xl overflow-hidden border border-white/15"
              style={{ background: 'rgba(0,0,0,0.35)' }}
            >
              {preview ? (
                <Image
                  src={preview}
                  alt="MATRIX section preview"
                  fill
                  className="object-cover"
                  unoptimized={preview.startsWith('blob:')}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ImageIcon className="w-10 h-10 text-white/30" />
                </div>
              )}
            </div>

            {/* Upload control */}
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/30 transition-all cursor-pointer">
                <Upload className="w-4 h-4" />
                Choose New Image
                <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
              </label>

              <button
                onClick={handleSave}
                disabled={!file || saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-purple-600 hover:bg-purple-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Save & Publish
                  </>
                )}
              </button>

              {file && (
                <span className="text-xs text-white/45">{file.name}</span>
              )}
            </div>
          </motion.div>
        </main>

        {toast.show && <Toast message={toast.message} type={toast.type} />}
      </div>
    </>
  );
}