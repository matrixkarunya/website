// components/admin/EditEventModal.tsx
import React, { useState } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { getAcademicYearFromDate, EventCategory, EventItem } from '@/lib/events';
import EventImageUpload from './EventImageUpload';
import MomentsManager from './MomentsManager';
import styles from './adminModal.module.css';
import {
  X,
  Save,
  Calendar,
  MapPin,
  Tag,
  Type,
  Info,
  AlignLeft,
  Users,
  Clock,
  Images,
} from 'lucide-react';

interface EditEventModalProps {
  event: EventItem;
  categories: EventCategory[];
  onClose: () => void;
  onSuccess: (message: string) => void; // closes the modal (after Save)
  onError: (message: string) => void;
  onToast: (message: string, type: 'success' | 'error') => void; // does NOT close (gallery actions)
  onManageCategories: () => void;
}

export default function EditEventModal({
  event,
  categories,
  onClose,
  onSuccess,
  onError,
  onToast,
  onManageCategories,
}: EditEventModalProps) {
  const [formData, setFormData] = useState({
    title: event.title,
    category: event.category,
    date: event.date,
    venue: event.venue,
    description: event.description || '',
    participants:
      event.participants !== undefined && event.participants !== null
        ? String(event.participants)
        : '',
    duration: event.duration || '',
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState(event.imageUrl);
  const [loading, setLoading] = useState(false);

  const handleImageSelect = (file: File) => {
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  // "Remove" in edit mode just reverts to the existing cover image
  const handleImageRevert = () => {
    setImageFile(null);
    setImagePreview(event.imageUrl);
  };

  const derivedYear = formData.date ? getAcademicYearFromDate(formData.date) : '';

  // If the event's category was deleted/renamed, still show it so the select isn't blank
  const categoryOptions = categories.some((c) => c.name === event.category)
    ? categories.map((c) => c.name)
    : [event.category, ...categories.map((c) => c.name)];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let imageUrl = event.imageUrl;
      let imagePublicId = event.imagePublicId;

      if (imageFile) {
        const uploaded = await uploadToCloudinary(imageFile);
        imageUrl = uploaded.url;
        imagePublicId = uploaded.publicId;

        // Remove the old cover (best-effort; don't fail the edit if this fails)
        if (event.imagePublicId) {
          fetch('/api/cloudinary/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ publicId: event.imagePublicId }),
          }).catch((err) => console.warn('Old image cleanup failed:', err));
        }
      }

      const participants =
        formData.participants.trim() === ''
          ? null
          : Math.max(0, parseInt(formData.participants, 10) || 0);

      // NOTE: `moments` is intentionally NOT written here. The gallery below saves
      // itself instantly, so Save can never overwrite gallery changes.
      await updateDoc(doc(db, 'events', event.id), {
        title: formData.title.trim(),
        category: formData.category,
        date: formData.date,
        venue: formData.venue.trim(),
        description: formData.description.trim(),
        participants,
        duration: formData.duration.trim() || null,
        academicYear: getAcademicYearFromDate(formData.date),
        imageUrl,
        imagePublicId,
        updatedAt: serverTimestamp(),
      });

      onSuccess('Event updated successfully!');
    } catch (error) {
      console.error('Error updating event:', error);
      onError('Failed to update event');
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
                <Save className="w-5 h-5 text-blue-400" />
              </div>
              Edit Event
            </h2>
            <p className="text-white/60 text-sm mt-1 ml-11">Update the event details</p>
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
              onImageRemove={handleImageRevert}
              imagePreview={imagePreview}
              required={false}
            />

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
              />
            </div>

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
              <select
                required
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className={`${inputCls} cursor-pointer`}
              >
                {categoryOptions.map((name) => (
                  <option key={name} value={name} className="bg-gray-900">
                    {name}
                  </option>
                ))}
              </select>
            </div>

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
              />
            </div>

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

            {/* Gallery */}
            <div className="pt-2">
              <div className="border-t border-white/10 mb-5" />
              <div className="mb-4">
                <h3 className="flex items-center gap-2 text-sm font-medium text-white">
                  <Images className="w-4 h-4 text-white/60" />
                  Gallery Moments
                </h3>
                <p className="text-xs text-white/50 mt-1 flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  Gallery changes are saved instantly. No need to click Save.
                </p>
              </div>
              <MomentsManager eventId={event.id} onToast={onToast} />
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
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Changes
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