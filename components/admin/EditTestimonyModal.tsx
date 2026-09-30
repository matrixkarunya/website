'use client';

import { useState } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { X, Upload, Loader2 } from 'lucide-react';
import type { Testimony } from '@/app/admin/testimony/page';
import Image from 'next/image';

interface Props {
  testimony: Testimony;
  onClose: () => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

export default function EditTestimonyModal({ testimony, onClose, onSuccess, onError }: Props) {
  const [form, setForm] = useState({
    name: testimony.name,
    role: testimony.role,
    quote: testimony.quote,
    order: testimony.order,
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>(testimony.imageUrl || '');
  const [loading, setLoading] = useState(false);

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.role || !form.quote) {
      onError('Name, role and quote are required');
      return;
    }

    setLoading(true);
    try {
      let imageUrl = testimony.imageUrl || '';
      let imagePublicId = testimony.imagePublicId || '';

      // Upload new image directly to Cloudinary if changed
      if (imageFile) {
        const result = await uploadToCloudinary(imageFile);
        imageUrl = result.url;
        imagePublicId = result.publicId;
        // Note: old image stays in Cloudinary — clean up manually
        // or add a delete API call here if needed
      }

      await updateDoc(doc(db, 'testimonies', testimony.id), {
        name: form.name.trim(),
        role: form.role.trim(),
        quote: form.quote.trim(),
        order: Number(form.order),
        imageUrl,
        imagePublicId,
        updatedAt: serverTimestamp(),
      });

      onSuccess('Testimony updated successfully');
    } catch (err) {
      console.error(err);
      onError('Failed to update testimony');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div
        className="relative w-full max-w-lg rounded-3xl overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.08)',
          border: '1.5px solid rgba(255,255,255,0.18)',
          backdropFilter: 'blur(24px)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        }}
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
          <h2 className="text-lg font-bold text-white">Edit Testimony</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-xl transition-colors"
          >
            <X className="w-5 h-5 text-white/60" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">

          {/* Image */}
          <div className="flex flex-col items-center gap-3">
            <label className="cursor-pointer">
              {imagePreview ? (
                <Image
                  src={imagePreview}
                  alt="Preview"
                  width={64}
                  height={64}
                  className="w-16 h-16 rounded-full object-cover outline outline-2 outline-white/25 outline-offset-2 hover:opacity-80 transition-opacity"
                />
              ) : (
                <div className="w-16 h-16 rounded-full flex items-center justify-center bg-white/10 border-2 border-dashed border-white/25 hover:border-white/45 transition-all">
                  <Upload className="w-5 h-5 text-white/45" />
                </div>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={handleImage} />
            </label>
            <span className="text-[11px] text-white/40">Click to change photo</span>
          </div>

          {/* Name + Role */}
          {[
            { label: 'Full Name', key: 'name', placeholder: 'e.g. Gethsia Jennifer' },
            { label: 'Role / Batch', key: 'role', placeholder: 'e.g. B.Tech AI & ML, 2026' },
          ].map(({ label, key, placeholder }) => (
            <div key={key}>
              <label className="block text-xs font-semibold text-white/55 mb-1.5 tracking-wide uppercase">
                {label} <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                placeholder={placeholder}
                value={(form as any)[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl text-sm text-white placeholder:text-white/30 bg-white/8 border border-white/15 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
              />
            </div>
          ))}

          {/* Quote */}
          <div>
            <label className="block text-xs font-semibold text-white/55 mb-1.5 tracking-wide uppercase">
              Quote <span className="text-red-400">*</span>
            </label>
            <textarea
              rows={4}
              value={form.quote}
              onChange={(e) => setForm({ ...form, quote: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl text-sm text-white placeholder:text-white/30 bg-white/8 border border-white/15 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all resize-none"
            />
          </div>

          {/* Order */}
          <div>
            <label className="block text-xs font-semibold text-white/55 mb-1.5 tracking-wide uppercase">
              Display Order
            </label>
            <input
              type="number"
              min={1}
              value={form.order}
              onChange={(e) => setForm({ ...form, order: Number(e.target.value) })}
              className="w-28 px-4 py-2.5 rounded-xl text-sm text-white bg-white/8 border border-white/15 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white/65 bg-white/5 border border-white/12 hover:bg-white/10 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-white/15 border border-white/25 hover:bg-white/22 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}