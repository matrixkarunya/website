// app/admin/team/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  deleteDoc,
  doc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import TeamMemberCard from '@/components/admin/TeamMemberCard';
import AddMemberModal from '@/components/admin/AddMemberModal';
import EditMemberModal from '@/components/admin/EditMemberModal';
import MoveToPastModal from '@/components/admin/MoveToPastModal';
import DeleteConfirmModal from '@/components/admin/DeleteConfirmModal';
import Toast from '@/components/admin/Toast';
import { motion } from 'framer-motion';
import { ArrowLeft, Plus, Users, History, Calendar } from 'lucide-react';

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  specialization: string;
  description: string;
  imageUrl: string;
  imagePublicId: string;
  email?: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
  registerId?: string;
  expertise?: string[];
  category: 'faculty' | 'student';
  order: number;
  academicYear: string;
  isCurrent: boolean;
  createdAt: any;
  updatedAt: any;
}

// Background Component (same as Team page)
const AdminBackground = () => {
  return (
    <div className="fixed inset-0 w-full h-full -z-10 bg-black">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-black to-black" />
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
      {/* Glassmorphic Layer */}
      <div className="absolute inset-0 backdrop-blur-sm bg-white/3" />
    </div>
  );
};

export default function AdminTeamPage() {
  const { user, isAdmin, loading } = useAuth();
  const router = useRouter();
  
  const [currentMembers, setCurrentMembers] = useState<TeamMember[]>([]);
  const [pastMembers, setPastMembers] = useState<TeamMember[]>([]);
  const [activeTab, setActiveTab] = useState<'current' | 'past'>('current');
  const [selectedYear, setSelectedYear] = useState<string>('');
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  
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

  // Fetch current team members
  useEffect(() => {
    const q = query(
      collection(db, 'team'),
      where('isCurrent', '==', true),
      orderBy('order', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const members: TeamMember[] = [];
      snapshot.forEach((doc) => {
        members.push({ id: doc.id, ...doc.data() } as TeamMember);
      });
      
      // Sort manually by category (faculty first) then by order
      const sorted = members.sort((a, b) => {
        if (a.category === b.category) {
          return a.order - b.order;
        }
        return a.category === 'faculty' ? -1 : 1;
      });
      
      setCurrentMembers(sorted);
    });

    return () => unsubscribe();
  }, []);

  // Fetch past team members and set default year
  useEffect(() => {
    const q = query(
      collection(db, 'team'),
      where('isCurrent', '==', false),
      orderBy('academicYear', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const members: TeamMember[] = [];
      snapshot.forEach((doc) => {
        members.push({ id: doc.id, ...doc.data() } as TeamMember);
      });
      
      // Sort manually by category then order
      const sorted = members.sort((a, b) => {
        if (a.academicYear !== b.academicYear) {
          return b.academicYear.localeCompare(a.academicYear);
        }
        if (a.category === b.category) {
          return a.order - b.order;
        }
        return a.category === 'faculty' ? -1 : 1;
      });
      
      setPastMembers(sorted);

      // Set default to most recent year if not already set
      const years = [...new Set(sorted.map(m => m.academicYear))]
        .filter(Boolean)
        .sort()
        .reverse();
      
      if (years.length > 0 && !selectedYear) {
        setSelectedYear(years[0]);
      }
    });

    return () => unsubscribe();
  }, [selectedYear]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  const handleEdit = (member: TeamMember) => {
    setSelectedMember(member);
    setShowEditModal(true);
  };

  const handleMoveToPast = (member: TeamMember) => {
    setSelectedMember(member);
    setShowMoveModal(true);
  };

  const handleDelete = (member: TeamMember) => {
    setSelectedMember(member);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!selectedMember) return;

    try {
      // Delete image from Cloudinary
      await fetch('/api/cloudinary/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicId: selectedMember.imagePublicId }),
      });

      // Delete from Firestore
      await deleteDoc(doc(db, 'team', selectedMember.id));

      showToast('Member deleted successfully', 'success');
      setShowDeleteModal(false);
      setSelectedMember(null);
    } catch (error) {
      console.error('Error deleting member:', error);
      showToast('Failed to delete member', 'error');
    }
  };

  // Get unique academic years from past members
  const academicYears = [...new Set(pastMembers.map(m => m.academicYear))]
    .filter(Boolean)
    .sort()
    .reverse();

  // Filter past members by selected year (no "all" option)
  const filteredPastMembers = pastMembers.filter(m => m.academicYear === selectedYear);

  // Separate faculty and students for current members
  const currentFaculty = currentMembers.filter(m => m.category === 'faculty');
  const currentStudents = currentMembers.filter(m => m.category === 'student');

  // Separate faculty and students for past members
  const pastFaculty = filteredPastMembers.filter(m => m.category === 'faculty');
  const pastStudents = filteredPastMembers.filter(m => m.category === 'student');

  if (loading) {
    return (
      <>
        <AdminBackground />
        <div className="relative min-h-screen flex items-center justify-center">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-white/80 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-white/80 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-white/80 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </>
    );
  }

  if (!user || !isAdmin) {
    return null;
  }

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
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <Users className="w-5 h-5 text-blue-400" />
                  </div>
                  <h1 className="text-xl font-bold text-white">Team Management</h1>
                </div>
              </div>
              <button
  onClick={() => setShowAddModal(true)}
  className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-xl border border-white/20 hover:border-white/30 text-white rounded-xl transition-all shadow-lg hover:shadow-white/10 font-medium group"
>
  <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
  Add Member
</button>

            </div>
          </div>
        </header>

        {/* Tabs */}
        <div className="bg-white/5 backdrop-blur-xl border-b border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="inline-flex items-center p-1.5 bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl shadow-lg">
              <button
                onClick={() => setActiveTab('current')}
                className={`relative px-6 py-2.5 text-sm font-medium transition-colors rounded-lg ${
                  activeTab === 'current'
                    ? 'text-white'
                    : 'text-white/60 hover:text-white/80'
                }`}
              >
                {activeTab === 'current' && (
                  <motion.div
                    layoutId="adminActiveTab"
                    className="absolute inset-0 bg-white/10 backdrop-blur-sm rounded-lg shadow-lg border border-white/20"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Current Team ({currentMembers.length})
                </span>
              </button>
              <button
                onClick={() => setActiveTab('past')}
                className={`relative px-6 py-2.5 text-sm font-medium transition-colors rounded-lg ${
                  activeTab === 'past'
                    ? 'text-white'
                    : 'text-white/60 hover:text-white/80'
                }`}
              >
                {activeTab === 'past' && (
                  <motion.div
                    layoutId="adminActiveTab"
                    className="absolute inset-0 bg-white/10 backdrop-blur-sm rounded-lg shadow-lg border border-white/20"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  <History className="w-4 h-4" />
                  Team History ({pastMembers.length})
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Year Filter for Past Members */}
        {activeTab === 'past' && academicYears.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/5 backdrop-blur-xl border-b border-white/10"
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-white/60" />
                <label className="text-sm font-medium text-white/80">
                  Academic Year:
                </label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="px-4 py-2 bg-white/5 backdrop-blur-xl border border-white/10 rounded-lg text-sm text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all cursor-pointer hover:bg-white/10"
                >
                  {academicYears.map((year, index) => (
                    <option key={year} value={year} className="bg-gray-900">
                      {year} {index === 0 && '(Latest)'}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </motion.div>
        )}

        {/* Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {activeTab === 'current' ? (
            <>
              {/* Current Academic Year Badge */}
              {currentMembers.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6 flex items-center gap-2 px-4 py-3 bg-blue-500/10 backdrop-blur-xl border border-blue-400/20 rounded-xl shadow-lg"
                >
                  <Calendar className="w-5 h-5 text-blue-400" />
                  <span className="text-sm text-blue-200">
                    Current Academic Year: <span className="font-semibold text-white">{currentMembers[0]?.academicYear || 'N/A'}</span>
                  </span>
                </motion.div>
              )}

              {/* Faculty Section */}
              <div className="mb-12">
                <motion.h2
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-2xl font-bold text-white mb-6 flex items-center gap-3"
                >
                  Faculty Members
                  <span className="px-3 py-1 bg-white/10 backdrop-blur-xl border border-white/20 rounded-lg text-sm font-semibold">
                    {currentFaculty.length}
                  </span>
                </motion.h2>
                {currentFaculty.length === 0 ? (
                  <div className="text-center py-16 bg-white/5 backdrop-blur-xl rounded-2xl border-2 border-dashed border-white/10">
                    <Users className="w-12 h-12 text-white/40 mx-auto mb-3" />
                    <p className="text-white/60">No faculty members yet</p>
                    <p className="text-sm text-white/40 mt-1">Add your first faculty member to get started</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {currentFaculty.map((member, index) => (
                      <motion.div
                        key={member.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <TeamMemberCard
                          member={member}
                          onEdit={handleEdit}
                          onMoveToPast={handleMoveToPast}
                          onDelete={handleDelete}
                        />
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {/* Students Section */}
              <div>
                <motion.h2
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="text-2xl font-bold text-white mb-6 flex items-center gap-3"
                >
                  Students & Researchers
                  <span className="px-3 py-1 bg-white/10 backdrop-blur-xl border border-white/20 rounded-lg text-sm font-semibold">
                    {currentStudents.length}
                  </span>
                </motion.h2>
                {currentStudents.length === 0 ? (
                  <div className="text-center py-16 bg-white/5 backdrop-blur-xl rounded-2xl border-2 border-dashed border-white/10">
                    <Users className="w-12 h-12 text-white/40 mx-auto mb-3" />
                    <p className="text-white/60">No students yet</p>
                    <p className="text-sm text-white/40 mt-1">Add your first student to get started</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {currentStudents.map((member, index) => (
                      <motion.div
                        key={member.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <TeamMemberCard
                          member={member}
                          onEdit={handleEdit}
                          onMoveToPast={handleMoveToPast}
                          onDelete={handleDelete}
                        />
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Past Members Section */
            <>
              {/* Faculty Section */}
              {pastFaculty.length > 0 && (
                <div className="mb-12">
                  <motion.h2
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="text-2xl font-bold text-white mb-6 flex items-center gap-3"
                  >
                    Former Faculty
                    <span className="px-3 py-1 bg-white/10 backdrop-blur-xl border border-white/20 rounded-lg text-sm font-semibold">
                      {pastFaculty.length}
                    </span>
                  </motion.h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {pastFaculty.map((member, index) => (
                      <motion.div
                        key={member.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <TeamMemberCard
                          member={member}
                          onEdit={handleEdit}
                          onDelete={handleDelete}
                          isPast
                        />
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Students Section */}
              {pastStudents.length > 0 && (
                <div>
                  <motion.h2
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                    className="text-2xl font-bold text-white mb-6 flex items-center gap-3"
                  >
                    Former Students & Researchers
                    <span className="px-3 py-1 bg-white/10 backdrop-blur-xl border border-white/20 rounded-lg text-sm font-semibold">
                      {pastStudents.length}
                    </span>
                  </motion.h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {pastStudents.map((member, index) => (
                      <motion.div
                        key={member.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <TeamMemberCard
                          member={member}
                          onEdit={handleEdit}
                          onDelete={handleDelete}
                          isPast
                        />
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* No Past Members */}
              {pastFaculty.length === 0 && pastStudents.length === 0 && (
                <div className="text-center py-20 bg-white/5 backdrop-blur-xl rounded-2xl border-2 border-dashed border-white/10">
                  <History className="w-16 h-16 text-white/40 mx-auto mb-4" />
                  <p className="text-xl text-white/60 mb-2">
                    {academicYears.length === 0 
                      ? 'No past members yet' 
                      : `No members found for ${selectedYear}`}
                  </p>
                  <p className="text-sm text-white/40">
                    {academicYears.length === 0
                      ? 'Past team members will appear here when moved from current team'
                      : 'Try selecting a different academic year'
                    }
                  </p>
                </div>
              )}
            </>
          )}
        </main>

        {/* Modals */}
        {showAddModal && (
          <AddMemberModal
            onClose={() => setShowAddModal(false)}
            onSuccess={(message) => {
              showToast(message, 'success');
              setShowAddModal(false);
            }}
            onError={(message) => showToast(message, 'error')}
          />
        )}

        {showEditModal && selectedMember && (
          <EditMemberModal
            member={selectedMember}
            onClose={() => {
              setShowEditModal(false);
              setSelectedMember(null);
            }}
            onSuccess={(message) => {
              showToast(message, 'success');
              setShowEditModal(false);
              setSelectedMember(null);
            }}
            onError={(message) => showToast(message, 'error')}
          />
        )}

        {showMoveModal && selectedMember && (
          <MoveToPastModal
            member={selectedMember}
            onClose={() => {
              setShowMoveModal(false);
              setSelectedMember(null);
            }}
            onSuccess={(message) => {
              showToast(message, 'success');
              setShowMoveModal(false);
              setSelectedMember(null);
            }}
            onError={(message) => showToast(message, 'error')}
          />
        )}

        {showDeleteModal && selectedMember && (
          <DeleteConfirmModal
            memberName={selectedMember.name}
            onClose={() => {
              setShowDeleteModal(false);
              setSelectedMember(null);
            }}
            onConfirm={confirmDelete}
          />
        )}

        {/* Toast */}
        {toast.show && <Toast message={toast.message} type={toast.type} />}
      </div>
    </>
  );
}
