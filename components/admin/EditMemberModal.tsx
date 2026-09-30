// components/admin/EditMemberModal.tsx
import React, { useState } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { uploadToCloudinary } from '@/lib/cloudinary';
import ImageUpload from './ImageUpload';
import { TeamMember } from '@/app/admin/team/page';
import { X, Plus, GraduationCap, User, Calendar, Hash } from 'lucide-react';

interface EditMemberModalProps {
  member: TeamMember;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export default function EditMemberModal({
  member,
  onClose,
  onSuccess,
  onError,
}: EditMemberModalProps) {
  const [formData, setFormData] = useState({
    name: member.name,
    role: member.role,
    specialization: member.specialization,
    description: member.description,
    email: member.email || '',
    linkedinUrl: member.linkedinUrl || '',
    portfolioUrl: member.portfolioUrl || '',
    registerId: member.registerId || '',
    academicYear: member.academicYear,
    isCurrent: member.isCurrent,
    category: member.category,
    order: member.order,
  });
  const [expertise, setExpertise] = useState<string[]>(member.expertise || []);
  const [expertiseInput, setExpertiseInput] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>(member.imageUrl);
  const [loading, setLoading] = useState(false);

  const handleImageSelect = (file: File) => {
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const addExpertise = () => {
    if (expertiseInput.trim() && !expertise.includes(expertiseInput.trim())) {
      setExpertise([...expertise, expertiseInput.trim()]);
      setExpertiseInput('');
    }
  };

  const removeExpertise = (item: string) => {
    setExpertise(expertise.filter((e) => e !== item));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.academicYear.trim()) {
      onError('Please enter academic year');
      return;
    }

    setLoading(true);

    try {
      let imageUrl = member.imageUrl;
      let imagePublicId = member.imagePublicId;

      // If new image is selected, upload it and delete old one
      if (imageFile) {
        // Upload new image
        const uploadResult = await uploadToCloudinary(imageFile);
        imageUrl = uploadResult.url;
        imagePublicId = uploadResult.publicId;

        // Delete old image from Cloudinary
        await fetch('/api/cloudinary/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ publicId: member.imagePublicId }),
        });
      }

      // Update in Firestore
      await updateDoc(doc(db, 'team', member.id), {
        name: formData.name,
        role: formData.role,
        specialization: formData.specialization,
        description: formData.description,
        email: formData.email || null,
        linkedinUrl: formData.linkedinUrl || null,
        portfolioUrl: formData.portfolioUrl || null,
        registerId: formData.registerId || null,
        academicYear: formData.academicYear,
        isCurrent: formData.isCurrent,
        category: formData.category,
        order: formData.order,
        expertise: expertise.length > 0 ? expertise : null,
        imageUrl,
        imagePublicId,
        updatedAt: serverTimestamp(),
      });

      onSuccess('Team member updated successfully!');
    } catch (error) {
      console.error('Error updating member:', error);
      onError('Failed to update team member');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 bg-white/5 backdrop-blur-xl border-b border-white/10 px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <GraduationCap className="w-5 h-5 text-blue-400" />
            </div>
            Edit Team Member
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-all"
            disabled={loading}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Image Upload */}
          <ImageUpload
            onImageSelect={handleImageSelect}
            imagePreview={imagePreview}
          />

          {/* Academic Year */}
          <div className="bg-blue-500/10 border border-blue-400/20 rounded-xl p-4 backdrop-blur-xl">
            <label className="flex items-center gap-2 text-sm font-medium text-white mb-2">
              <Calendar className="w-4 h-4 text-blue-400" />
              Academic Year *
            </label>
            <input
              type="text"
              required
              value={formData.academicYear}
              onChange={(e) =>
                setFormData({ ...formData, academicYear: e.target.value })
              }
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
              placeholder="25-26"
              pattern="^\d{2}-\d{2}$"
              title="Format: YY-YY (e.g., 25-26)"
            />
            <p className="text-xs text-white/50 mt-2">
              Format: YY-YY (e.g., 25-26, 26-27)
            </p>
          </div>

          {/* Current/Past Toggle */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 backdrop-blur-xl">
            <label className="block text-sm font-medium text-white mb-3">
              Status *
            </label>
            <div className="flex gap-3">
              <label className="flex-1 cursor-pointer">
                <input
                  type="radio"
                  checked={formData.isCurrent === true}
                  onChange={() =>
                    setFormData({ ...formData, isCurrent: true })
                  }
                  className="sr-only peer"
                />
                <div className="px-4 py-2.5 bg-white/5 border-2 border-white/10 peer-checked:border-green-500/50 peer-checked:bg-green-500/10 rounded-lg text-sm text-white/70 peer-checked:text-green-300 font-medium text-center transition-all">
                  Current Team Member
                </div>
              </label>
              <label className="flex-1 cursor-pointer">
                <input
                  type="radio"
                  checked={formData.isCurrent === false}
                  onChange={() =>
                    setFormData({ ...formData, isCurrent: false })
                  }
                  className="sr-only peer"
                />
                <div className="px-4 py-2.5 bg-white/5 border-2 border-white/10 peer-checked:border-gray-500/50 peer-checked:bg-gray-500/10 rounded-lg text-sm text-white/70 peer-checked:text-gray-300 font-medium text-center transition-all">
                  Past Team Member
                </div>
              </label>
            </div>
            <p className="text-xs text-white/50 mt-3">
              {formData.isCurrent 
                ? '✓ Will appear in "Current Team"' 
                : '✓ Will appear in "Team History"'}
            </p>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
              placeholder="John Doe"
            />
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Role *
            </label>
            <input
              type="text"
              required
              value={formData.role}
              onChange={(e) =>
                setFormData({ ...formData, role: e.target.value })
              }
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
              placeholder="PhD Researcher"
            />
          </div>

          {/* Specialization */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Specialization *
            </label>
            <input
              type="text"
              required
              value={formData.specialization}
              onChange={(e) =>
                setFormData({ ...formData, specialization: e.target.value })
              }
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
              placeholder="Deep Learning"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Description *
            </label>
            <textarea
              required
              rows={4}
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all resize-none"
              placeholder="Brief bio about the team member..."
            />
          </div>

          {/* Register ID */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-white mb-2">
              <Hash className="w-4 h-4 text-white/60" />
              Register ID
            </label>
            <input
              type="text"
              value={formData.registerId}
              onChange={(e) =>
                setFormData({ ...formData, registerId: e.target.value })
              }
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all font-mono"
              placeholder="REG12345"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
              placeholder="john.doe@example.com"
            />
          </div>

          {/* LinkedIn URL */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              LinkedIn URL
            </label>
            <input
              type="url"
              value={formData.linkedinUrl}
              onChange={(e) =>
                setFormData({ ...formData, linkedinUrl: e.target.value })
              }
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
              placeholder="https://linkedin.com/in/username"
            />
          </div>

          {/* Portfolio URL */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Portfolio URL
            </label>
            <input
              type="url"
              value={formData.portfolioUrl}
              onChange={(e) =>
                setFormData({ ...formData, portfolioUrl: e.target.value })
              }
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
              placeholder="https://yourportfolio.com"
            />
          </div>

          {/* Expertise */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Expertise (Optional)
            </label>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={expertiseInput}
                onChange={(e) => setExpertiseInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addExpertise())}
                className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                placeholder="Add expertise tag"
              />
              <button
                type="button"
                onClick={addExpertise}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all flex items-center gap-2 font-medium"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {expertise.map((item) => (
                <span
                  key={item}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-500/20 border border-blue-400/30 text-blue-200 rounded-lg text-sm font-medium"
                >
                  {item}
                  <button
                    type="button"
                    onClick={() => removeExpertise(item)}
                    className="hover:text-white transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-white mb-3">
              Category *
            </label>
            <div className="flex gap-3">
              <label className="flex-1 cursor-pointer">
                <input
                  type="radio"
                  value="faculty"
                  checked={formData.category === 'faculty'}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      category: e.target.value as 'faculty' | 'student',
                    })
                  }
                  className="sr-only peer"
                />
                <div className="px-4 py-2.5 bg-white/5 border-2 border-white/10 peer-checked:border-purple-500/50 peer-checked:bg-purple-500/10 rounded-lg text-sm text-white/70 peer-checked:text-purple-300 font-medium flex items-center justify-center gap-2 transition-all">
                  <GraduationCap className="w-4 h-4" />
                  Faculty
                </div>
              </label>
              <label className="flex-1 cursor-pointer">
                <input
                  type="radio"
                  value="student"
                  checked={formData.category === 'student'}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      category: e.target.value as 'faculty' | 'student',
                    })
                  }
                  className="sr-only peer"
                />
                <div className="px-4 py-2.5 bg-white/5 border-2 border-white/10 peer-checked:border-blue-500/50 peer-checked:bg-blue-500/10 rounded-lg text-sm text-white/70 peer-checked:text-blue-300 font-medium flex items-center justify-center gap-2 transition-all">
                  <User className="w-4 h-4" />
                  Student
                </div>
              </label>
            </div>
          </div>

          {/* Order */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-white mb-2">
              <Hash className="w-4 h-4 text-white/60" />
              Order Number *
            </label>
            <input
              type="number"
              required
              min="0"
              value={formData.order}
              onChange={(e) =>
                setFormData({ ...formData, order: parseInt(e.target.value) || 0 })
              }
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
              placeholder="0"
            />
            <p className="text-xs text-white/50 mt-2">
              Lower numbers appear first within their category
            </p>
          </div>
        </div>

        {/* Fixed Bottom Buttons */}
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
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2 font-medium shadow-lg shadow-blue-500/25"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  Updating...
                </>
              ) : (
                'Update Member'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
