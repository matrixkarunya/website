// app/admin/events/page.tsx
'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  deleteDoc,
  doc,
  addDoc,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import EventCard from '@/components/admin/EventCard';
import AddEventModal from '@/components/admin/AddEventModal';
import EditEventModal from '@/components/admin/EditEventModal';
import EventDeleteConfirm from '@/components/admin/EventDeleteConfirm';
import ManageCategoriesModal from '@/components/admin/ManageCategoriesModal';
import ManageMomentsModal from '@/components/admin/ManageMomentsModal';
import Toast from '@/components/admin/Toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Plus,
  CalendarDays,
  Search,
  X,
  Tag,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  EventItem,
  EventCategory,
  DEFAULT_CATEGORIES,
} from '@/lib/events';

const PAGE_SIZE = 12;

const AdminBackground = () => (
  <div className="fixed inset-0 w-full h-full -z-10 bg-black">
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-black to-black" />
    <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
    <div className="absolute inset-0 backdrop-blur-sm bg-white/3" />
  </div>
);

export default function AdminEventsPage() {
  const { user, isAdmin, loading } = useAuth();
  const router = useRouter();

  const [events, setEvents] = useState<EventItem[]>([]);
  const [categories, setCategories] = useState<EventCategory[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(1);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);
  const [showMomentsModal, setShowMomentsModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);

  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    type: 'success' | 'error';
  }>({ show: false, message: '', type: 'success' });

  const seededRef = useRef(false);

  // Auth check
  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      router.push('/admin/login');
    }
  }, [user, isAdmin, loading, router]);

  // Events listener
  useEffect(() => {
    const q = query(collection(db, 'events'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: EventItem[] = [];
        snapshot.forEach((d) => list.push({ id: d.id, ...d.data() } as EventItem));
        setEvents(list);
        setDataLoading(false);
      },
      (error) => {
        console.error('Events listener error:', error);
        setDataLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Categories listener + one-time seeding of defaults
  useEffect(() => {
    const q = query(collection(db, 'eventCategories'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const list: EventCategory[] = [];
      snapshot.forEach((d) => list.push({ id: d.id, ...d.data() } as EventCategory));
      setCategories(list);

      // Seed defaults only if the collection is truly empty (server-confirmed)
      if (
        snapshot.empty &&
        !snapshot.metadata.fromCache &&
        !seededRef.current
      ) {
        seededRef.current = true;
        try {
          const check = await getDocs(collection(db, 'eventCategories'));
          if (check.empty) {
            await Promise.all(
              DEFAULT_CATEGORIES.map((name) =>
                addDoc(collection(db, 'eventCategories'), {
                  name,
                  createdAt: serverTimestamp(),
                })
              )
            );
          }
        } catch (err) {
          console.error('Failed to seed categories:', err);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  const handleEdit = (event: EventItem) => {
    setSelectedEvent(event);
    setShowEditModal(true);
  };

  const handleMoments = (event: EventItem) => {
    setSelectedEvent(event);
    setShowMomentsModal(true);
  };

  const handleDelete = (event: EventItem) => {
    setSelectedEvent(event);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!selectedEvent) return;
    try {
      // Use the live copy so we also clean up gallery photos added after selection
      const live = events.find((e) => e.id === selectedEvent.id) ?? selectedEvent;
      const publicIds = [
        live.imagePublicId,
        ...(live.moments ?? []).map((m) => m.publicId),
      ].filter(Boolean);

      await Promise.allSettled(
        publicIds.map((publicId) =>
          fetch('/api/cloudinary/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ publicId }),
          })
        )
      );
      await deleteDoc(doc(db, 'events', selectedEvent.id));
      showToast('Event deleted successfully', 'success');
      setShowDeleteModal(false);
      setSelectedEvent(null);
    } catch (error) {
      console.error('Error deleting event:', error);
      showToast('Failed to delete event', 'error');
    }
  };

  // Academic years derived from events (latest first)
  const academicYears = useMemo(
    () =>
      [...new Set(events.map((e) => e.academicYear))]
        .filter(Boolean)
        .sort()
        .reverse(),
    [events]
  );

  // Filter (events are already sorted by date desc from Firestore)
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return events.filter((e) => {
      if (
        q &&
        !(
          e.title.toLowerCase().includes(q) ||
          e.venue.toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q)
        )
      )
        return false;
      if (yearFilter && e.academicYear !== yearFilter) return false;
      if (categoryFilter && e.category !== categoryFilter) return false;
      return true;
    });
  }, [events, searchQuery, yearFilter, categoryFilter]);

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [searchQuery, yearFilter, categoryFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages); // if last item on last page was deleted
  const pageEvents = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const hasFilters = searchQuery || yearFilter || categoryFilter;
  const clearAll = () => {
    setSearchQuery('');
    setYearFilter('');
    setCategoryFilter('');
  };

  if (loading) {
    return (
      <>
        <AdminBackground />
        <div className="relative min-h-screen flex items-center justify-center">
          <div className="flex items-center gap-3">
            {[0, 150, 300].map((d) => (
              <div
                key={d}
                className="w-2 h-2 bg-white/80 rounded-full animate-bounce"
                style={{ animationDelay: `${d}ms` }}
              />
            ))}
          </div>
        </div>
      </>
    );
  }

  if (!user || !isAdmin) return null;

  const selectCls =
    'px-4 py-2.5 bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all cursor-pointer hover:bg-white/10';

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
                    <CalendarDays className="w-5 h-5 text-blue-400" />
                  </div>
                  <h1 className="text-xl font-bold text-white">Events Management</h1>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowCategoriesModal(true)}
                  className="hidden sm:flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white rounded-xl transition-all font-medium"
                >
                  <Tag className="w-4 h-4" />
                  Categories
                </button>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-xl border border-white/20 hover:border-white/30 text-white rounded-xl transition-all shadow-lg hover:shadow-white/10 font-medium group"
                >
                  <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
                  Add Event
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Filters */}
        <div className="bg-white/5 backdrop-blur-xl border-b border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <input
                  type="text"
                  placeholder="Search by title, venue or category..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-10 py-2.5 text-sm bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10 rounded-md transition-colors"
                  >
                    <X className="w-3.5 h-3.5 text-white/40" />
                  </button>
                )}
              </div>

              <select
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                className={selectCls}
              >
                <option value="" className="bg-gray-900">All Years</option>
                {academicYears.map((y, i) => (
                  <option key={y} value={y} className="bg-gray-900">
                    {y} {i === 0 && '(Latest)'}
                  </option>
                ))}
              </select>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className={selectCls}
              >
                <option value="" className="bg-gray-900">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.name} className="bg-gray-900">
                    {c.name}
                  </option>
                ))}
              </select>

              {/* Mobile categories button (hidden in header on small screens) */}
              <button
                onClick={() => setShowCategoriesModal(true)}
                className="sm:hidden flex items-center justify-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 text-white rounded-xl font-medium"
              >
                <Tag className="w-4 h-4" />
                Categories
              </button>
            </div>

            <div className="flex items-center justify-between mt-3">
              <p className="text-xs text-white/50">
                {filtered.length} event{filtered.length !== 1 ? 's' : ''}
                {hasFilters && ` (of ${events.length} total)`}
              </p>
              {hasFilters && (
                <button
                  onClick={clearAll}
                  className="text-xs text-blue-300 hover:text-blue-200 transition-colors"
                >
                  Clear all filters
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {dataLoading ? (
            <div className="flex items-center justify-center py-24">
              <div className="flex items-center gap-3">
                {[0, 150, 300].map((d) => (
                  <div
                    key={d}
                    className="w-2 h-2 bg-white/80 rounded-full animate-bounce"
                    style={{ animationDelay: `${d}ms` }}
                  />
                ))}
              </div>
            </div>
          ) : pageEvents.length === 0 ? (
            <div className="text-center py-20 bg-white/5 backdrop-blur-xl rounded-2xl border-2 border-dashed border-white/10">
              <CalendarDays className="w-16 h-16 text-white/40 mx-auto mb-4" />
              <p className="text-xl text-white/60 mb-2">
                {events.length === 0 ? 'No events yet' : 'No events match your filters'}
              </p>
              <p className="text-sm text-white/40">
                {events.length === 0
                  ? 'Click "Add Event" to create your first event'
                  : 'Try adjusting your search or filters'}
              </p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {pageEvents.map((event, index) => (
                  <motion.div
                    key={event.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: index * 0.03 }}
                  >
                    <EventCard
                      event={event}
                      onEdit={handleEdit}
                      onMoments={handleMoments}
                      onDelete={handleDelete}
                    />
                  </motion.div>
                ))}
              </div>
            </AnimatePresence>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-12">
              <button
                onClick={() => setPage(safePage - 1)}
                disabled={safePage === 1}
                className="w-10 h-10 flex items-center justify-center rounded-xl border bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-10 h-10 rounded-xl border text-sm font-medium transition-all ${
                    p === safePage
                      ? 'bg-white/20 border-white/30 text-white'
                      : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPage(safePage + 1)}
                disabled={safePage === totalPages}
                className="w-10 h-10 flex items-center justify-center rounded-xl border bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </main>

        {/* Modals */}
        {showAddModal && (
          <AddEventModal
            categories={categories}
            onClose={() => setShowAddModal(false)}
            onSuccess={(message) => {
              showToast(message, 'success');
              setShowAddModal(false);
            }}
            onError={(message) => showToast(message, 'error')}
            onManageCategories={() => setShowCategoriesModal(true)}
          />
        )}

        {showEditModal && selectedEvent && (
          <EditEventModal
            event={selectedEvent}
            categories={categories}
            onClose={() => {
              setShowEditModal(false);
              setSelectedEvent(null);
            }}
            onSuccess={(message) => {
              showToast(message, 'success');
              setShowEditModal(false);
              setSelectedEvent(null);
            }}
            onError={(message) => showToast(message, 'error')}
            onToast={showToast}
            onManageCategories={() => setShowCategoriesModal(true)}
          />
        )}

        {showMomentsModal && selectedEvent && (
          <ManageMomentsModal
            eventId={selectedEvent.id}
            eventTitle={selectedEvent.title}
            onClose={() => {
              setShowMomentsModal(false);
              setSelectedEvent(null);
            }}
            onToast={showToast}
          />
        )}

        {showDeleteModal && selectedEvent && (
          <EventDeleteConfirm
            eventTitle={selectedEvent.title}
            onClose={() => {
              setShowDeleteModal(false);
              setSelectedEvent(null);
            }}
            onConfirm={confirmDelete}
          />
        )}

        {showCategoriesModal && (
          <ManageCategoriesModal
            categories={categories}
            events={events}
            onClose={() => setShowCategoriesModal(false)}
            onSuccess={(message) => showToast(message, 'success')}
            onError={(message) => showToast(message, 'error')}
          />
        )}

        {toast.show && <Toast message={toast.message} type={toast.type} />}
      </div>
    </>
  );
}