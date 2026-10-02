// app/admin/team/page.tsx
'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
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
import { motion, useReducedMotion } from 'framer-motion';
import {
  AlertCircle,
  Archive,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Globe,
  History,
  LayoutGrid,
  Linkedin,
  List,
  Mail,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  SearchX,
  Trash2,
  Users,
  X,
} from 'lucide-react';

import type { LucideIcon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import AddMemberModal from '@/components/admin/AddMemberModal';
import EditMemberModal from '@/components/admin/EditMemberModal';
import MoveToPastModal from '@/components/admin/MoveToPastModal';
import DeleteConfirmModal from '@/components/admin/DeleteConfirmModal';

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

type Tab = 'current' | 'past';
type CategoryFilter = 'all' | 'faculty' | 'student';
type SortBy = 'order' | 'name';
type ViewMode = 'grid' | 'list';

const VIEW_STORAGE_KEY = 'adminTeamView';
const GRID = 'grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3';

const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600';

const byCategoryThenOrder = (a: TeamMember, b: TeamMember) =>
  a.category === b.category ? a.order - b.order : a.category === 'faculty' ? -1 : 1;

/* ────────────────────────── Small building blocks ────────────────────────── */

function Avatar({ name, src, className }: { name: string; src?: string; className: string }) {
  const [failed, setFailed] = useState(false);
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  if (!src || failed) {
    return (
      <div
        aria-hidden="true"
        className={`flex shrink-0 items-center justify-center rounded-xl bg-slate-100 font-semibold text-slate-600 ${className}`}
      >
        {initials || '?'}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`shrink-0 rounded-xl bg-slate-100 object-cover ${className}`}
    />
  );
}

function CategoryBadge({ category }: { category: TeamMember['category'] }) {
  const isFaculty = category === 'faculty';
  return (
    <span
      className={`rounded-md px-2 py-0.5 text-xs font-medium ${
        isFaculty ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-700'
      }`}
    >
      {isFaculty ? 'Faculty' : 'Student'}
    </span>
  );
}

interface MenuItem {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  danger?: boolean;
}

function ActionMenu({ label, items }: { label: string; items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 ${focusRing}`}
      >
        <MoreHorizontal className="h-5 w-5" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-48 rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
        >
          {items.map(({ label: itemLabel, icon: Icon, onClick, danger }) => (
            <React.Fragment key={itemLabel}>
              {danger && <div className="my-1 h-px bg-slate-100" />}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onClick();
                }}
                className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                  danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Icon className="h-4 w-4" />
                {itemLabel}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

function IconLink({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
}) {  return (
    <a
      href={href}
      target={href.startsWith('mailto:') ? undefined : '_blank'}
      rel="noopener noreferrer"
      aria-label={label}
      className={`flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-indigo-600 ${focusRing}`}
    >
      <Icon className="h-4 w-4" />
    </a>
  );
}

interface MemberActions {
  onEdit: (m: TeamMember) => void;
  onMove: (m: TeamMember) => void;
  onDelete: (m: TeamMember) => void;
}

function buildMenu(member: TeamMember, isPast: boolean, actions: MemberActions): MenuItem[] {
  const items: MenuItem[] = [{ label: 'Edit details', icon: Pencil, onClick: () => actions.onEdit(member) }];
  if (!isPast) {
    items.push({ label: 'Move to history', icon: Archive, onClick: () => actions.onMove(member) });
  }
  items.push({ label: 'Delete member', icon: Trash2, onClick: () => actions.onDelete(member), danger: true });
  return items;
}

function MemberCard({ member, isPast, actions }: { member: TeamMember; isPast: boolean; actions: MemberActions }) {
  const expertise = member.expertise ?? [];
  return (
    <article className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-slate-300">
      <div className="flex items-start gap-4">
        <Avatar name={member.name} src={member.imageUrl} className="h-14 w-14 text-lg" />
        <div className="min-w-0 flex-1">
          <h4 className="truncate font-semibold text-slate-900">{member.name}</h4>
          <p className="truncate text-sm text-slate-600">{member.role}</p>
          {member.specialization && <p className="truncate text-xs text-slate-500">{member.specialization}</p>}
        </div>
        <ActionMenu label={`Actions for ${member.name}`} items={buildMenu(member, isPast, actions)} />
      </div>

      {member.description && <p className="mt-3 line-clamp-2 text-sm text-slate-600">{member.description}</p>}

      {expertise.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {expertise.slice(0, 3).map((skill) => (
            <li key={skill} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
              {skill}
            </li>
          ))}
          {expertise.length > 3 && (
            <li className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-500">+{expertise.length - 3}</li>
          )}
        </ul>
      )}

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <div className="flex min-w-0 items-center gap-2">
          <CategoryBadge category={member.category} />
          <span className="truncate text-xs text-slate-500">
            {member.category === 'student' && member.registerId ? member.registerId : member.academicYear}
          </span>
        </div>
        <div className="flex shrink-0 items-center">
          {member.email && <IconLink href={`mailto:${member.email}`} label={`Email ${member.name}`} icon={Mail} />}
          {member.linkedinUrl && <IconLink href={member.linkedinUrl} label={`${member.name} on LinkedIn`} icon={Linkedin} />}
          {member.portfolioUrl && <IconLink href={member.portfolioUrl} label={`${member.name}'s portfolio`} icon={Globe} />}
          <button
            type="button"
            onClick={() => actions.onEdit(member)}
            className={`ml-1 flex min-h-[36px] items-center gap-1.5 rounded-lg bg-slate-100 px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200 ${focusRing}`}
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
        </div>
      </div>
    </article>
  );
}

function MemberRow({ member, isPast, actions }: { member: TeamMember; isPast: boolean; actions: MemberActions }) {
  const subtitle = [member.role, member.specialization].filter(Boolean).join(', ');
  return (
    <li className="flex items-center gap-3 p-3 sm:gap-4 sm:p-4">
      <Avatar name={member.name} src={member.imageUrl} className="h-10 w-10 text-sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">{member.name}</p>
        <p className="truncate text-xs text-slate-500">{subtitle}</p>
      </div>
      <span className="hidden text-xs text-slate-500 md:block">
        {member.category === 'student' && member.registerId ? member.registerId : member.academicYear}
      </span>
      <span className="hidden sm:block">
        <CategoryBadge category={member.category} />
      </span>
      <button
        type="button"
        onClick={() => actions.onEdit(member)}
        aria-label={`Edit ${member.name}`}
        className={`flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 ${focusRing}`}
      >
        <Pencil className="h-4 w-4" />
      </button>
      <ActionMenu label={`Actions for ${member.name}`} items={buildMenu(member, isPast, actions)} />
    </li>
  );
}

function SkeletonGrid() {
  return (
    <div className={GRID} aria-hidden="true">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-xl bg-slate-100" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-2/3 rounded bg-slate-100" />
              <div className="h-3 w-1/2 rounded bg-slate-100" />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <div className="h-3 w-full rounded bg-slate-100" />
            <div className="h-3 w-4/5 rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: { label: string; onClick: () => void; primary?: boolean };
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="font-semibold text-slate-900">{title}</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-slate-600">{body}</p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className={`mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors ${focusRing} ${
            action.primary
              ? 'bg-indigo-600 text-white hover:bg-indigo-700'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          {action.primary && <Plus className="h-4 w-4" />}
          {action.label}
        </button>
      )}
    </div>
  );
}

function ToastBanner({
  message,
  type,
  onClose,
}: {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-4 bottom-4 z-50 pb-[env(safe-area-inset-bottom)] sm:inset-x-auto sm:bottom-6 sm:right-6"
    >
      <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-lg">
        {type === 'success' ? (
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
        ) : (
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
        )}
        <p className="text-sm text-slate-900">{message}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss notification"
          className={`ml-1 flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 ${focusRing}`}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────── Page ─────────────────────────────────── */

export default function AdminTeamPage() {
  const { user, isAdmin, loading } = useAuth();
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  const [currentMembers, setCurrentMembers] = useState<TeamMember[]>([]);
  const [pastMembers, setPastMembers] = useState<TeamMember[]>([]);
  const [currentLoaded, setCurrentLoaded] = useState(false);
  const [pastLoaded, setPastLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<Tab>('current');
  const [selectedYear, setSelectedYear] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('order');
  const [view, setView] = useState<ViewMode>('grid');

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const anyModalOpen = showAddModal || showEditModal || showMoveModal || showDeleteModal;

  // Auth check (admin and superadmin)
  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      router.push('/admin/login');
    }
  }, [user, isAdmin, loading, router]);

  // Remember grid/list choice
  useEffect(() => {
    try {
      const saved = localStorage.getItem(VIEW_STORAGE_KEY);
      if (saved === 'grid' || saved === 'list') setView(saved);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const changeView = (next: ViewMode) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      /* storage unavailable */
    }
  };

  // Toast helper with cleanup
  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    []
  );

  // Press "/" to jump to search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || anyModalOpen) return;
      const t = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [anyModalOpen]);

  // Live: current team
  useEffect(() => {
    if (!isAdmin) return;
    const q = query(collection(db, 'team'), where('isCurrent', '==', true), orderBy('order', 'asc'));
    return onSnapshot(
      q,
      (snapshot) => {
        const members = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as TeamMember);
        setCurrentMembers(members.sort(byCategoryThenOrder));
        setCurrentLoaded(true);
      },
      (err) => {
        console.error('Error loading current team:', err);
        setLoadError("We couldn't load the team. Check your connection and refresh the page.");
        setCurrentLoaded(true);
      }
    );
  }, [isAdmin]);

  // Live: past team
  useEffect(() => {
    if (!isAdmin) return;
    const q = query(collection(db, 'team'), where('isCurrent', '==', false), orderBy('academicYear', 'desc'));
    return onSnapshot(
      q,
      (snapshot) => {
        const members = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as TeamMember);
        setPastMembers(
          members.sort((a, b) =>
            a.academicYear !== b.academicYear
              ? b.academicYear.localeCompare(a.academicYear)
              : byCategoryThenOrder(a, b)
          )
        );
        setPastLoaded(true);
      },
      (err) => {
        console.error('Error loading past team:', err);
        setLoadError("We couldn't load the team history. Check your connection and refresh the page.");
        setPastLoaded(true);
      }
    );
  }, [isAdmin]);

  /* ── Derived data ── */

  const academicYears = useMemo(
    () => [...new Set(pastMembers.map((m) => m.academicYear))].filter(Boolean).sort().reverse(),
    [pastMembers]
  );
  // Falls back to the latest year if nothing is picked or the picked year no longer exists
  const activeYear = academicYears.includes(selectedYear) ? selectedYear : academicYears[0] ?? '';

  const currentYear = currentMembers.find((m) => m.academicYear)?.academicYear ?? '';
  const facultyCount = currentMembers.filter((m) => m.category === 'faculty').length;
  const studentCount = currentMembers.length - facultyCount;

  const baseList = useMemo(
    () => (activeTab === 'current' ? currentMembers : pastMembers.filter((m) => m.academicYear === activeYear)),
    [activeTab, currentMembers, pastMembers, activeYear]
  );

  const searched = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return baseList;
    return baseList.filter((m) =>
      [m.name, m.role, m.specialization, m.email, m.registerId, ...(m.expertise ?? [])].some((v) =>
        v?.toLowerCase().includes(q)
      )
    );
  }, [baseList, search]);

  const sortList = useCallback(
    (list: TeamMember[]) => (sortBy === 'name' ? [...list].sort((a, b) => a.name.localeCompare(b.name)) : list),
    [sortBy]
  );

  const facultyAll = searched.filter((m) => m.category === 'faculty');
  const studentsAll = searched.filter((m) => m.category !== 'faculty');
  const faculty = category === 'student' ? [] : sortList(facultyAll);
  const students = category === 'faculty' ? [] : sortList(studentsAll);
  const shownCount = faculty.length + students.length;

  const filtersActive = search.trim() !== '' || category !== 'all';
  const isPast = activeTab === 'past';
  const dataLoaded = activeTab === 'current' ? currentLoaded : pastLoaded;

  const clearFilters = () => {
    setSearch('');
    setCategory('all');
  };

  /* ── Actions ── */

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
  const actions: MemberActions = { onEdit: handleEdit, onMove: handleMoveToPast, onDelete: handleDelete };

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

      showToast(`${selectedMember.name} deleted`, 'success');
      setShowDeleteModal(false);
      setSelectedMember(null);
    } catch (error) {
      console.error('Error deleting member:', error);
      showToast("Couldn't delete this member. Try again.", 'error');
    }
  };

  const closeSelected = () => setSelectedMember(null);

  /* ── Render ── */

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return null;
  }

const tabs: { id: Tab; label: string; icon: LucideIcon; count: number }[] = [    { id: 'current', label: 'Current team', icon: Users, count: currentMembers.length },
    { id: 'past', label: 'History', icon: History, count: pastMembers.length },
  ];

  const categoryChips: { id: CategoryFilter; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: searched.length },
    { id: 'faculty', label: 'Faculty', count: facultyAll.length },
    { id: 'student', label: 'Students', count: studentsAll.length },
  ];

  const stats = [
    { label: 'Faculty', value: String(facultyCount) },
    { label: 'Students', value: String(studentCount) },
    { label: 'In history', value: String(pastMembers.length) },
    { label: 'Academic year', value: currentYear || 'Not set' },
  ];

  const renderGroup = (title: string, items: TeamMember[]) =>
    items.length === 0 ? null : (
      <section key={title} aria-label={title} className="space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
            {items.length}
          </span>
        </div>
        {view === 'grid' ? (
          <div className={GRID}>
            {items.map((m) => (
              <MemberCard key={m.id} member={m} isPast={isPast} actions={actions} />
            ))}
          </div>
        ) : (
          <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white shadow-sm">
            {items.map((m) => (
              <MemberRow key={m.id} member={m} isPast={isPast} actions={actions} />
            ))}
          </ul>
        )}
      </section>
    );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white pt-[env(safe-area-inset-top)] shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                href="/admin/dashboard"
                aria-label="Back to dashboard"
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 ${focusRing}`}
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-600">
                <Users className="h-5 w-5 text-white" />
              </div>
              <h1 className="truncate text-lg font-bold text-slate-900 sm:text-xl">Team</h1>
            </div>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className={`flex min-h-[44px] items-center gap-2 rounded-lg bg-indigo-600 px-3.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 sm:px-4 ${focusRing}`}
            >
              <Plus className="h-5 w-5" />
              <span>
                Add<span className="hidden sm:inline"> member</span>
              </span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {loadError && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <p>{loadError}</p>
          </div>
        )}

        {/* Summary */}
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 shadow-sm sm:grid-cols-4">
          {stats.map(({ label, value }) => (
            <div key={label} className="bg-white p-4 sm:p-5">
              <p className="text-sm text-slate-500">{label}</p>
              <p className="mt-1 truncate text-xl font-bold text-slate-900 sm:text-2xl">{value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="inline-flex rounded-lg bg-slate-200/70 p-1" role="tablist" aria-label="Team view">
          {tabs.map(({ id, label, icon: Icon, count }) => {
            const selected = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActiveTab(id)}
                className={`relative flex min-h-[40px] items-center gap-2 rounded-md px-4 text-sm font-medium transition-colors ${focusRing} ${
                  selected ? 'text-slate-900' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {selected && (
                  <motion.span
                    layoutId="teamTabPill"
                    className="absolute inset-0 rounded-md bg-white shadow-sm"
                    transition={reduceMotion ? { duration: 0 } : { type: 'spring', bounce: 0.15, duration: 0.4 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  {label}
                  <span className="rounded bg-slate-100 px-1.5 text-xs text-slate-600">{count}</span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Toolbar */}
        <div className="space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchRef}
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setSearch('');
                }}
                placeholder="Search by name, role, expertise or email"
                aria-label="Search team members"
                className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white pl-11 pr-14 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 [&::-webkit-search-cancel-button]:hidden"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    searchRef.current?.focus();
                  }}
                  aria-label="Clear search"
                  className={`absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 ${focusRing}`}
                >
                  <X className="h-4 w-4" />
                </button>
              ) : (
                <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-slate-200 bg-slate-50 px-1.5 text-xs text-slate-500 sm:block">
                  /
                </kbd>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {isPast && academicYears.length > 0 && (
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  <span className="sr-only sm:not-sr-only">Academic year</span>
                  <select
                    value={activeYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="min-h-[44px] cursor-pointer rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                  >
                    {academicYears.map((year, index) => (
                      <option key={year} value={year}>
                        {year}
                        {index === 0 ? ' (latest)' : ''}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="flex items-center gap-2 text-sm text-slate-600">
                <span className="sr-only sm:not-sr-only">Sort</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortBy)}
                  className="min-h-[44px] cursor-pointer rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
                >
                  <option value="order">Display order</option>
                  <option value="name">Name (A to Z)</option>
                </select>
              </label>

              <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5" role="group" aria-label="Layout">
                {(
                  [
                    { id: 'grid', label: 'Grid view', icon: LayoutGrid },
                    { id: 'list', label: 'List view', icon: List },
                  ] as const
                ).map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => changeView(id)}
                    aria-label={label}
                    aria-pressed={view === id}
                    className={`flex h-10 w-10 items-center justify-center rounded-md transition-colors ${focusRing} ${
                      view === id ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
              {categoryChips.map(({ id, label, count }) => {
                const selected = category === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setCategory(id)}
                    aria-pressed={selected}
                    className={`flex min-h-[36px] items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-colors ${focusRing} ${
                      selected
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {label}
                    <span className={`text-xs ${selected ? 'text-indigo-600' : 'text-slate-400'}`}>{count}</span>
                  </button>
                );
              })}
            </div>

            {dataLoaded && baseList.length > 0 && (
              <p className="text-sm text-slate-500" aria-live="polite">
                {filtersActive ? `Showing ${shownCount} of ${baseList.length}` : `${baseList.length} members`}
                {filtersActive && (
                  <>
                    {' '}
                    <button
                      type="button"
                      onClick={clearFilters}
                      className={`rounded font-medium text-indigo-600 hover:text-indigo-700 hover:underline ${focusRing}`}
                    >
                      Clear filters
                    </button>
                  </>
                )}
              </p>
            )}
          </div>
        </div>

        {/* Content */}
        {!dataLoaded ? (
          <SkeletonGrid />
        ) : baseList.length === 0 ? (
          isPast ? (
            <EmptyState
              icon={History}
              title={academicYears.length === 0 ? 'No past members yet' : `No members in ${activeYear}`}
              body={
                academicYears.length === 0
                  ? 'Members you move to history appear here, grouped by academic year.'
                  : 'Pick a different academic year to see other members.'
              }
            />
          ) : (
            <EmptyState
              icon={Users}
              title="No team members yet"
              body="Add your first faculty member or student to build the team page."
              action={{ label: 'Add member', onClick: () => setShowAddModal(true), primary: true }}
            />
          )
        ) : shownCount === 0 ? (
          <EmptyState
            icon={SearchX}
            title="No members match your filters"
            body="Try a different search term or category."
            action={{ label: 'Clear filters', onClick: clearFilters }}
          />
        ) : (
          <div className="space-y-10">
            {renderGroup(isPast ? 'Former faculty' : 'Faculty', faculty)}
            {renderGroup(isPast ? 'Former students & researchers' : 'Students & researchers', students)}
          </div>
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
            closeSelected();
          }}
          onSuccess={(message) => {
            showToast(message, 'success');
            setShowEditModal(false);
            closeSelected();
          }}
          onError={(message) => showToast(message, 'error')}
        />
      )}

      {showMoveModal && selectedMember && (
        <MoveToPastModal
          member={selectedMember}
          onClose={() => {
            setShowMoveModal(false);
            closeSelected();
          }}
          onSuccess={(message) => {
            showToast(message, 'success');
            setShowMoveModal(false);
            closeSelected();
          }}
          onError={(message) => showToast(message, 'error')}
        />
      )}

      {showDeleteModal && selectedMember && (
        <DeleteConfirmModal
          memberName={selectedMember.name}
          onClose={() => {
            setShowDeleteModal(false);
            closeSelected();
          }}
          onConfirm={confirmDelete}
        />
      )}

      {toast && <ToastBanner message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}