// app/Team/page.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getThumbnailUrl, getFullSizeUrl } from '@/lib/cloudinary';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Mail, Linkedin, Globe, X, ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import Dither from '@/components/ui/Dither';

interface TeamMember {
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
  expertise?: string[];
  category: 'faculty' | 'student';
  order: number;
  academicYear: string;
  isCurrent: boolean;
  registerId?: string;
  createdAt: any;
  updatedAt: any;
}

type TabType = 'current' | 'past';

// ===== IMAGE PRELOADING UTILITY =====
const preloadImage = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = src;
  });
};

// ===== BACKGROUND — Dither only, no fiber code =====
const LandingBackground = ({ className }: { className?: string }) => {
  return (
    <div className={cn('fixed inset-0 w-full h-full -z-10', className)}>
      {/* Layer 1 — Dither canvas */}
      <Dither
        waveColor={[0.32, 0.15, 1]}
        disableAnimation={false}
        enableMouseInteraction
        mouseRadius={0.3}
        colorNum={4}
        pixelSize={2}
        waveAmplitude={0.3}
        waveFrequency={3}
        waveSpeed={0.05}
      />

      {/* Layer 2 — Dark transparent mask (above Dither, below glass) */}
      <div className="absolute inset-0 bg-black/50 z-10" />

      {/* Layer 3 — Glassmorphic blur (same as before) */}
      <div className="absolute inset-0 backdrop-blur-sm bg-white/3 z-20" />
    </div>
  );
};

// ===== TEAM PAGE =====
export default function TeamPage() {
  const [activeTab, setActiveTab] = useState<TabType>('current');
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [currentMembers, setCurrentMembers] = useState<TeamMember[]>([]);
  const [pastMembers, setPastMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [preloadedImages, setPreloadedImages] = useState<Set<string>>(new Set());
  const [academicYears, setAcademicYears] = useState<string[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, 'team'),
      where('isCurrent', '==', true),
      orderBy('category', 'asc'),
      orderBy('order', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const members: TeamMember[] = [];
      snapshot.forEach((doc) => {
        members.push({ id: doc.id, ...doc.data() } as TeamMember);
      });
      setCurrentMembers(members);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, 'team'),
      where('isCurrent', '==', false),
      orderBy('academicYear', 'desc'),
      orderBy('category', 'asc'),
      orderBy('order', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const members: TeamMember[] = [];
      snapshot.forEach((doc) => {
        members.push({ id: doc.id, ...doc.data() } as TeamMember);
      });
      setPastMembers(members);
      const years = [...new Set(members.map(m => m.academicYear))]
        .filter(Boolean)
        .sort()
        .reverse();
      setAcademicYears(years);
      if (years.length > 0 && !selectedYear) {
        setSelectedYear(years[0]);
      }
    });
    return () => unsubscribe();
  }, [selectedYear]);

  const handleMemberClick = (member: TeamMember) => {
    setSelectedMember(member);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setTimeout(() => setSelectedMember(null), 200);
  };

  const handleMemberHover = (member: TeamMember) => {
    const fullSizeUrl = getFullSizeUrl(member.imageUrl);
    if (!preloadedImages.has(fullSizeUrl)) {
      preloadImage(fullSizeUrl).then(() => {
        setPreloadedImages(prev => new Set(prev).add(fullSizeUrl));
      }).catch(err => {
        console.warn('Failed to preload image:', err);
      });
    }
  };

  const filterMembers = (members: TeamMember[]) => {
    if (!searchQuery.trim()) return members;
    const q = searchQuery.toLowerCase();
    return members.filter(member =>
      member.name.toLowerCase().includes(q) ||
      member.role.toLowerCase().includes(q) ||
      member.specialization?.toLowerCase().includes(q) ||
      member.registerId?.toLowerCase().includes(q) ||
      member.academicYear?.toLowerCase().includes(q)
    );
  };

  const isSearching = searchQuery.trim().length > 0;

  const filteredPastMembers = isSearching
    ? filterMembers(pastMembers)
    : filterMembers(pastMembers.filter(m => m.academicYear === selectedYear));

  const searchStats = React.useMemo(() => {
    if (!isSearching || activeTab !== 'past') return null;
    const uniqueYears = new Set(filteredPastMembers.map(m => m.academicYear));
    return { memberCount: filteredPastMembers.length, yearCount: uniqueYears.size };
  }, [isSearching, activeTab, filteredPastMembers]);

  const filteredCurrentMembers = filterMembers(currentMembers);
  const currentFaculty = filteredCurrentMembers.filter(m => m.category === 'faculty');
  const currentStudents = filteredCurrentMembers.filter(m => m.category === 'student');
  const currentCombined = [...currentFaculty, ...currentStudents];
  const pastFaculty = filteredPastMembers.filter(m => m.category === 'faculty');
  const pastStudents = filteredPastMembers.filter(m => m.category === 'student');
  const pastCombined = [...pastFaculty, ...pastStudents];

  if (loading) {
    return (
      <>
        <LandingBackground />
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

  return (
    <>
      <LandingBackground />

      <div className="relative min-h-screen">
        <main className="max-w-7xl mx-auto px-6 pt-24 pb-12 flex flex-col items-center">

          {/* Tabs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8"
          >
            <div className="inline-flex items-center p-1.5 bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl shadow-lg">
              {[
                { id: 'current' as TabType, label: 'Current Team' },
                { id: 'past' as TabType, label: 'Team History' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative px-6 py-2.5 text-sm font-medium transition-colors rounded-lg ${
                    activeTab === tab.id ? 'text-white' : 'text-white/60 hover:text-white/80'
                  }`}
                >
                  {activeTab === tab.id && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 bg-white/10 backdrop-blur-sm rounded-lg shadow-lg border border-white/20"
                      transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <span className="relative z-10">{tab.label}</span>
                </button>
              ))}
            </div>
          </motion.div>

          {/* Search */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="w-full max-w-md mb-4"
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                type="text"
                placeholder={activeTab === 'past' ? 'Search across all years...' : 'Search members...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 text-sm bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20 transition-all shadow-lg"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10 rounded-md transition-colors group"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5 text-white/40 group-hover:text-white/70" />
                </button>
              )}
            </div>
          </motion.div>

          {/* Search Info Banner */}
          {isSearching && activeTab === 'past' && searchStats && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="mb-8"
            >
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 backdrop-blur-xl border border-blue-400/20 rounded-lg shadow-lg">
                  <Search className="w-3.5 h-3.5 text-blue-300" />
                  <span className="text-xs text-blue-200 font-medium">Searching across all years...</span>
                </div>
                {searchStats.memberCount > 0 && (
                  <div className="px-4 py-1.5 bg-white/5 backdrop-blur-xl border border-white/10 rounded-lg">
                    <span className="text-xs text-white/70">
                      Found <span className="font-semibold text-white">{searchStats.memberCount}</span> member{searchStats.memberCount !== 1 ? 's' : ''} across <span className="font-semibold text-white">{searchStats.yearCount}</span> year{searchStats.yearCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Year Dropdown */}
          {activeTab === 'past' && !isSearching && academicYears.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="mb-12"
            >
              <YearDropdown
                years={academicYears}
                selectedYear={selectedYear}
                onSelectYear={setSelectedYear}
              />
            </motion.div>
          )}

          {activeTab === 'past' && isSearching && <div className="mb-4" />}

          {/* Members Section */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4, ease: 'easeInOut' }}
              className="w-full"
            >
              {activeTab === 'current' ? (
                <>
                  {currentCombined.length > 0 ? (
                    <section className="w-full flex justify-center">
                      <div className="flex flex-wrap justify-center gap-4 max-w-[1200px]">
                        {currentCombined.map((member, index) => (
                          <MemberCard
                            key={member.id}
                            member={member}
                            index={index}
                            onClick={() => handleMemberClick(member)}
                            onHover={() => handleMemberHover(member)}
                          />
                        ))}
                      </div>
                    </section>
                  ) : (
                    <div className="text-center py-20">
                      <p className="text-white/60 mb-2 text-lg">No members found</p>
                      <p className="text-sm text-white/40">Try adjusting your search</p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {pastCombined.length > 0 ? (
                    <section className="w-full flex justify-center">
                      <div className="flex flex-wrap justify-center gap-4 max-w-[1200px]">
                        {pastCombined.map((member, index) => (
                          <MemberCard
                            key={member.id}
                            member={member}
                            index={index}
                            onClick={() => handleMemberClick(member)}
                            onHover={() => handleMemberHover(member)}
                            showYear
                          />
                        ))}
                      </div>
                    </section>
                  ) : (
                    <div className="text-center py-20">
                      <p className="text-white/60 mb-2 text-lg">
                        {academicYears.length === 0
                          ? 'No team history available yet'
                          : 'No members found'}
                      </p>
                      <p className="text-sm text-white/40">
                        {academicYears.length === 0
                          ? 'Past team members will appear here'
                          : isSearching ? 'Try a different search term' : 'Try adjusting your search'}
                      </p>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        {isModalOpen && selectedMember && (
          <MemberModal
            member={selectedMember}
            onClose={handleCloseModal}
            isPreloaded={preloadedImages.has(getFullSizeUrl(selectedMember.imageUrl))}
          />
        )}
      </div>
    </>
  );
}

// ===== YEAR DROPDOWN — unchanged =====
function YearDropdown({ years, selectedYear, onSelectYear }: {
  years: string[];
  selectedYear: string;
  onSelectYear: (year: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isLatestYear = selectedYear === years[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-5 py-2.5 bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl text-white hover:bg-white/10 hover:border-white/20 transition-all shadow-lg min-w-[220px] justify-between"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{selectedYear}</span>
          {isLatestYear && (
            <span className="text-[10px] font-semibold px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded-full border border-blue-400/30">
              Latest
            </span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-white/60 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="absolute top-full mt-2 w-full bg-white/10 backdrop-blur-2xl border border-white/20 rounded-xl shadow-2xl overflow-hidden z-50"
          >
            <div className="py-1 max-h-[280px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
              {years.map((year, index) => {
                const isSelected = year === selectedYear;
                const isFirstYear = index === 0;
                return (
                  <button
                    key={year}
                    onClick={() => { onSelectYear(year); setIsOpen(false); }}
                    className={`w-full px-4 py-2.5 text-left text-sm flex items-center justify-between transition-colors ${
                      isSelected ? 'bg-white/20 text-white font-medium' : 'text-white/70 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span>{year}</span>
                      {isFirstYear && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded-full border border-blue-400/30">
                          Latest
                        </span>
                      )}
                    </div>
                    {isSelected && <Check className="w-4 h-4" />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ===== MEMBER CARD — unchanged =====
function MemberCard({ member, index, onClick, onHover, showYear = false }: {
  member: TeamMember;
  index: number;
  onClick: () => void;
  onHover?: () => void;
  showYear?: boolean;
}) {
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.02 }}
      onClick={onClick}
      onMouseEnter={onHover}
      className="group relative rounded-3xl p-8 transition-all duration-300 cursor-pointer w-full sm:w-[280px]"
      style={{
        background: "rgba(255,255,255,0.12)",          // brighter base fill
        border: "1.5px solid rgba(255,255,255,0.25)",  // more visible border
        backdropFilter: "blur(20px)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.2)",
      }}
      whileHover={{
        background: "rgba(255,255,255,0.2)",           // brighter on hover
        boxShadow: "0 16px 48px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.3)",
        y: -4,
      }}
    >
      {/* Top-edge highlight for glass depth */}
      <div className="absolute inset-x-0 top-0 h-px rounded-full bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center text-center">
        <div className="relative mb-4">
          <div className="relative w-32 h-32 rounded-full overflow-hidden bg-white/20 ring-4 ring-white/30 group-hover:ring-white/50 transition-all shadow-xl">
            {!imageLoaded && (
              <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-white/10 animate-pulse" />
            )}
            <Image
              src={getThumbnailUrl(member.imageUrl)}
              alt={member.name}
              fill
              className={`object-cover transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
              priority={index < 8}
              onLoad={() => setImageLoaded(true)}
              sizes="128px"
            />
          </div>
        </div>

        {showYear && member.academicYear && (
          <div className="mb-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/25 backdrop-blur-sm rounded-full shadow-lg border border-white/40">
              <svg className="w-3 h-3 text-white/90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-xs font-semibold text-white">{member.academicYear}</span>
            </div>
          </div>
        )}

        <h3 className="text-xl font-bold text-white mb-3">{member.name}</h3>
        <p className="text-base text-white/80 font-semibold mb-2">{member.role}</p>
        {member.specialization && (
          <p className="text-sm text-white/60 font-light">{member.specialization}</p>
        )}
        {member.registerId && (
          <p className="mt-3 text-xs font-mono text-white/50">{member.registerId}</p>
        )}
      </div>
    </motion.div>
  );
}

// ===== MEMBER MODAL — unchanged =====
function MemberModal({ member, onClose, isPreloaded = false }: {
  member: TeamMember;
  onClose: () => void;
  isPreloaded?: boolean;
}) {
  const [imageLoaded, setImageLoaded] = useState(isPreloaded);
  const [showFullImage, setShowFullImage] = useState(isPreloaded);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const [thumbnailLoaded, setThumbnailLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMinTimeElapsed(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  const handleImageLoad = () => {
    setImageLoaded(true);
    if (minTimeElapsed) setShowFullImage(true);
  };

  useEffect(() => {
    if (minTimeElapsed && imageLoaded) setShowFullImage(true);
  }, [minTimeElapsed, imageLoaded]);

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl max-w-4xl w-full max-h-[85vh] overflow-hidden shadow-2xl relative"
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-lg transition-colors z-20 bg-black/20"
          >
            <X className="w-5 h-5 text-white" />
          </button>

          <div className="flex flex-col md:flex-row max-h-[85vh]">
            <div className="md:w-2/5 bg-gradient-to-br from-slate-500/20 via-blue-600/20 to-slate-600/20 p-4 md:p-8 py-6 md:py-8 flex flex-col items-center justify-center relative">
              <div className="relative w-32 h-32 md:w-48 md:h-48 mb-3 md:mb-6">
                <div className="relative w-full h-full rounded-full overflow-hidden bg-white/10 ring-4 ring-slate-400/40 shadow-2xl">
                  {!thumbnailLoaded && (
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-700/50 to-slate-800/50 animate-pulse" />
                  )}
                  <Image
                    src={getThumbnailUrl(member.imageUrl)}
                    alt={member.name}
                    fill
                    className={`object-cover absolute inset-0 transition-all duration-700 ${showFullImage ? 'opacity-0 scale-110' : 'opacity-100 blur-md scale-110'}`}
                    sizes="(max-width: 768px) 128px, 192px"
                    priority
                    onLoad={() => setThumbnailLoaded(true)}
                  />
                  <Image
                    src={getFullSizeUrl(member.imageUrl)}
                    alt={member.name}
                    fill
                    className={`object-cover transition-opacity duration-700 ${showFullImage ? 'opacity-100' : 'opacity-0'}`}
                    priority
                    onLoad={handleImageLoad}
                    sizes="(max-width: 768px) 128px, 192px"
                    quality={90}
                  />
                  {!showFullImage && thumbnailLoaded && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <div className="w-6 h-6 md:w-8 md:h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    </div>
                  )}
                </div>
              </div>

              {member.academicYear && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-2 md:mb-4">
                  <div className="inline-flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-1 md:py-2 bg-slate-500/20 border border-slate-400/30 rounded-full backdrop-blur-sm">
                    <svg className="w-3 h-3 md:w-4 md:h-4 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-xs md:text-sm font-semibold text-white">{member.academicYear}</span>
                  </div>
                </motion.div>
              )}

              <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-white mb-2 md:mb-3 text-center">{member.name}</h2>
              <div className="space-y-1 md:space-y-2 text-center">
                <p className="text-sm md:text-base text-slate-300 font-semibold">{member.role}</p>
                {member.specialization && <p className="text-xs md:text-sm text-white/70">{member.specialization}</p>}
              </div>
              {member.registerId && (
                <p className="mt-2 md:mt-4 text-[10px] md:text-xs font-mono text-white/60 bg-white/10 px-3 md:px-4 py-1.5 md:py-2 rounded-lg border border-white/20">
                  {member.registerId}
                </p>
              )}
            </div>

            <div className="md:w-3/5 flex flex-col overflow-y-auto">
              <div className="h-4 md:h-16 lg:h-20 flex-shrink-0" />
              <div className="flex-1 px-6 md:px-10">
                {member.description && (
                  <div className="mb-8">
                    <p className="text-sm md:text-[15px] text-white/90 leading-[1.7] md:leading-[1.8] text-justify font-normal whitespace-pre-line tracking-normal">
                      {member.description}
                    </p>
                  </div>
                )}
                {member.expertise && member.expertise.length > 0 && (
                  <>
                    <div className="border-t border-white/10 mb-6" />
                    <div className="mb-8">
                      <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-4">Areas of Expertise</h3>
                      <div className="flex flex-wrap gap-2">
                        {member.expertise.map((skill, index) => (
                          <motion.span
                            key={index}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: index * 0.05 }}
                            className="px-3 py-1.5 text-xs font-medium bg-white/10 text-white/90 rounded-lg border border-white/20 backdrop-blur-sm hover:bg-white/15 transition-colors"
                          >
                            {skill}
                          </motion.span>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {(member.email || member.linkedinUrl || member.portfolioUrl) && (
                <div className="flex-shrink-0 px-6 md:px-10 pb-6 md:pb-8 pt-4">
                  <div className="border-t border-white/10 mb-4 md:mb-6" />
                  <div>
                    <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3 md:mb-4">Connect</h3>
                    <div className="flex gap-3">
                      {member.email && (
                        <a href={`mailto:${member.email}`} title="Email"
                          className="p-2.5 md:p-3 bg-white/20 text-white rounded-xl hover:bg-white/30 transition-all backdrop-blur-sm border border-white/30 hover:border-white/40 hover:scale-110">
                          <Mail className="w-4 h-4 md:w-5 md:h-5" />
                        </a>
                      )}
                      {member.linkedinUrl && (
                        <a href={member.linkedinUrl} target="_blank" rel="noopener noreferrer" title="LinkedIn"
                          className="p-2.5 md:p-3 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-all backdrop-blur-sm border border-white/20 hover:border-white/30 hover:scale-110">
                          <Linkedin className="w-4 h-4 md:w-5 md:h-5" />
                        </a>
                      )}
                      {member.portfolioUrl && (
                        <a href={member.portfolioUrl} target="_blank" rel="noopener noreferrer" title="Portfolio"
                          className="p-2.5 md:p-3 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-all backdrop-blur-sm border border-white/20 hover:border-white/30 hover:scale-110">
                          <Globe className="w-4 h-4 md:w-5 md:h-5" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}