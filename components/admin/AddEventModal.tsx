// components/admin/AddEventModal.tsx
import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { getAcademicYearFromDate, EventCategory } from '@/lib/events';
import EventImageUpload from './EventImageUpload';
import styles from './adminModal.module.css';
import {
  X,
  Plus,
  Calendar,
  MapPin,
  Tag,
  Type,
  Info,
  AlignLeft,
  Users,
  Clock,
} from 'lucide-react';

interface AddEventModalProps {
  categories: EventCategory[];
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  onManageCategories: () => void;
}

export default function AddEventModal({
  categories,
  onClose,
  onSuccess,
  onError,
  onManageCategories,
}: AddEventModalProps) {
  const [formData, setFormData] = useState({
    title: '',
    category: categories[0]?.name || '',
    date: '',
    venue: '',
    description: '',
    participants: '',
    duration: '',
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [loading, setLoading] = useState(false);

  const handleImageSelect = (file: File) => {
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleImageRemove = () => {
    setImageFile(null);
    setImagePreview('');
  };

  const derivedYear = formData.date ? getAcademicYearFromDate(formData.date) : '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!imageFile) {
      onError('Please select a cover image');
      return;
    }
    if (!formData.category) {
      onError('Please select a category (create one first if none exist)');
      return;
    }

    setLoading(true);
    try {
      const { url, publicId } = await uploadToCloudinary(imageFile);

      const participants =
        formData.participants.trim() === ''
          ? null
          : Math.max(0, parseInt(formData.participants, 10) || 0);

      await addDoc(collection(db, 'events'), {
        title: formData.title.trim(),
        category: formData.category,
        date: formData.date,
        venue: formData.venue.trim(),
        description: formData.description.trim(),
        participants,
        duration: formData.duration.trim() || null,
        academicYear: getAcademicYearFromDate(formData.date),
        imageUrl: url,
        imagePublicId: publicId,
        moments: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      onSuccess('Event added! Use "Moments" on the card to add gallery photos.');
    } catch (error) {
      console.error('Error adding event:', error);
      onError('Failed to add event');
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    'w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all';

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div
        className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl flex flex-col"
        style={{ height: '100%', maxHeight: 860 }}
      >
        {/* Header */}
        <div className="flex-shrink-0 bg-white/5 backdrop-blur-xl border-b border-white/10 px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Plus className="w-5 h-5 text-blue-400" />
              </div>
              Add Event
            </h2>
            <p className="text-white/60 text-sm mt-1 ml-11">
              Fill in the details to publish a new event
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-all disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 flex flex-col overflow-hidden"
          style={{ minHeight: 0 }}
        >
          <div
            className={`flex-1 overflow-y-auto px-6 py-6 space-y-5 ${styles.scroll}`}
            style={{ minHeight: 0 }}
          >
            <EventImageUpload
              label="Cover Image"
              onImageSelect={handleImageSelect}
              onImageRemove={handleImageRemove}
              imagePreview={imagePreview}
            />

            {/* Title */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-white mb-2">
                <Type className="w-4 h-4 text-white/60" />
                Event Title *
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className={inputCls}
                placeholder="Neural Nexus"
              />
            </div>

            {/* Description */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-white mb-2">
                <AlignLeft className="w-4 h-4 text-white/60" />
                Description *
              </label>
              <textarea
                required
                rows={5}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className={`${inputCls} resize-none`}
                placeholder="What is this event about? Line breaks are kept on the public page."
              />
            </div>

            {/* Category */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2 text-sm font-medium text-white">
                  <Tag className="w-4 h-4 text-white/60" />
                  Category *
                </label>
                <button
                  type="button"
                  onClick={onManageCategories}
                  className="text-xs text-blue-300 hover:text-blue-200 transition-colors"
                >
                  Manage categories
                </button>
              </div>
              {categories.length === 0 ? (
                <div className="px-4 py-3 bg-yellow-500/10 border border-yellow-400/20 rounded-lg text-sm text-yellow-200">
                  No categories yet. Click &quot;Manage categories&quot; to create one.
                </div>
              ) : (
                <select
                  required
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className={`${inputCls} cursor-pointer`}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.name} className="bg-gray-900">
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Date + Academic year */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-white mb-2">
                  <Calendar className="w-4 h-4 text-white/60" />
                  Date *
                </label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className={`${inputCls} [color-scheme:dark]`}
                />
              </div>

              <div className="bg-blue-500/10 border border-blue-400/20 rounded-xl p-4 backdrop-blur-xl flex flex-col justify-center">
                <p className="text-xs text-white/50 mb-1">Academic Year</p>
                <p className="text-lg font-semibold text-white">{derivedYear || '—'}</p>
                <p className="text-xs text-white/40 mt-1 flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  Auto-set from date (June – May)
                </p>
              </div>
            </div>

            {/* Venue */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-white mb-2">
                <MapPin className="w-4 h-4 text-white/60" />
                Venue *
              </label>
              <input
                type="text"
                required
                value={formData.venue}
                onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                className={inputCls}
                placeholder="Tech Hub, Karunya University"
              />
            </div>

            {/* Participants + Duration */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-white mb-2">
                  <Users className="w-4 h-4 text-white/60" />
                  Participants
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.participants}
                  onChange={(e) => setFormData({ ...formData, participants: e.target.value })}
                  className={inputCls}
                  placeholder="250"
                />
                <p className="text-xs text-white/40 mt-1.5">Shown publicly as &quot;250+&quot;</p>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-white mb-2">
                  <Clock className="w-4 h-4 text-white/60" />
                  Duration
                </label>
                <input
                  type="text"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                  className={inputCls}
                  placeholder="24 hours"
                />
                <p className="text-xs text-white/40 mt-1.5">Free text, e.g. &quot;2 days&quot;</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 bg-white/5 backdrop-blur-xl border-t border-white/10 px-6 py-4">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg transition-all disabled:opacity-50 font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2 font-medium shadow-lg shadow-blue-500/25"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Add Event
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}