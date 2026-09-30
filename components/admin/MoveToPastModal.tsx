// components/admin/MoveToPastModal.tsx
import React, { useState } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { TeamMember } from '@/app/admin/team/page';
import { Archive, Info, Calendar, GraduationCap, User } from 'lucide-react';
import Image from 'next/image';

interface MoveToPastModalProps {
  member: TeamMember;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export default function MoveToPastModal({
  member,
  onClose,
  onSuccess,
  onError,
}: MoveToPastModalProps) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);

    try {
      // Update member status to past (isCurrent = false)
      await updateDoc(doc(db, 'team', member.id), {
        isCurrent: false,
        updatedAt: serverTimestamp(),
      });

      onSuccess(`${member.name} moved to Team History successfully!`);
    } catch (error) {
      console.error('Error moving member to past:', error);
      onError('Failed to move member to Team History');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl max-w-md w-full p-6 shadow-2xl">
        {/* Icon */}
        <div className="flex justify-center mb-5">
          <div className="w-20 h-20 bg-amber-500/20 backdrop-blur-xl border-2 border-amber-500/30 rounded-full flex items-center justify-center">
            <Archive className="w-10 h-10 text-amber-400" />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-white text-center mb-3">
          Move to Team History?
        </h2>

        {/* Description */}
        <p className="text-white/70 text-center mb-6 leading-relaxed">
          Are you sure you want to move <span className="font-semibold text-white">{member.name}</span> to Team History?
        </p>

        {/* Member Info Card */}
        <div className="bg-white/5 backdrop-blur-xl rounded-xl p-4 mb-5 border border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/10 rounded-full overflow-hidden flex-shrink-0 border border-white/20">
              {member.imageUrl && (
                <Image
                  src={member.imageUrl}
                  alt={member.name}
                  width={48}
                  height={48}
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white truncate">{member.name}</p>
              <p className="text-sm text-white/60 truncate">{member.role}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="inline-flex items-center gap-1 text-xs bg-blue-500/20 border border-blue-400/30 text-blue-300 px-2 py-0.5 rounded font-medium">
                  <Calendar className="w-3 h-3" />
                  {member.academicYear}
                </span>
                <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded font-medium border ${
                  member.category === 'faculty'
                    ? 'bg-purple-500/20 border-purple-400/30 text-purple-300'
                    : 'bg-green-500/20 border-green-400/30 text-green-300'
                }`}>
                  {member.category === 'faculty' ? (
                    <>
                      <GraduationCap className="w-3 h-3" />
                      Faculty
                    </>
                  ) : (
                    <>
                      <User className="w-3 h-3" />
                      Student
                    </>
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Info Note */}
        {/* <div className="bg-blue-500/10 border border-blue-400/30 rounded-xl p-4 mb-6 backdrop-blur-xl">
          <div className="flex gap-3">
            <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-blue-300 mb-2">What happens next:</p>
              <ul className="space-y-1.5 text-blue-200/80">
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-0.5">•</span>
                  <span>Member moves to "Team History" tab</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-0.5">•</span>
                  <span>Still appears in public team page under past members</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-0.5">•</span>
                  <span>Academic year ({member.academicYear}) is preserved</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-0.5">•</span>
                  <span>You can edit or delete them anytime</span>
                </li>
              </ul>
            </div>
          </div>
        </div> */}

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg disabled:opacity-50 font-medium transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 px-4 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg disabled:opacity-50 font-medium transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                Moving...
              </>
            ) : (
              <>
                <Archive className="w-4 h-4" />
                Move to History
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
