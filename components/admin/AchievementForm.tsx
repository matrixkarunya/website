// components/admin/AchievementForm.tsx
//
// Full-page form used by /admin/hall-of-fame/new and /admin/hall-of-fame/[id].
// (A page rather than a modal: an achievement holds several winners, each with
// a photo and optionally team members, which is too much for a dialog.)
'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  ChevronDown,
  ImagePlus,
  Link2,
  ListPlus,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Trophy,
  User,
  Users,
  X,
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { uploadToCloudinary } from '@/lib/cloudinary';
import {
  ACHIEVEMENTS_COLLECTION,
  Achievement,
  CATEGORIES,
  RANK_SUGGESTIONS,
  normalizeUrl,
  removeCloudinaryImages,
} from '@/lib/hallOfFame';

interface AchievementFormProps {
  mode: 'create' | 'edit';
  initial?: Achievement;
}

const MAX_IMAGE_MB = 10;
const MAX_SUMMARY = 160;
const MAX_STORY = 3000;
const LIST_PATH = '/admin/hall-of-fame';
const EMAIL_RE = /^\S+@\S+\.\S+$/;

/* 16px text on mobile prevents iOS zoom-on-focus; 44px min height for touch */
const inputCls =
  'w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-base text-slate-900 placeholder:text-slate-400 shadow-sm transition focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-100 sm:text-sm';

const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600';

/* ───────────────────────────── Draft types ───────────────────────────── */

interface MemberDraft {
  key: string;
  name: string;
  detail: string;
  imageUrl: string; // existing saved image
  imagePublicId: string;
  file: File | null; // newly chosen image (not uploaded yet)
  preview: string; // what to show: new file preview or existing image
  linkedinUrl: string; // optional
  email: string; // optional
}

interface WinnerDraft {
  key: string;
  kind: 'individual' | 'team';
  name: string;
  rank: string;
  detail: string;
  linkedinUrl: string; // optional, individuals only
  email: string; // optional, individuals only
  imageUrl: string; // existing saved image
  imagePublicId: string;
  file: File | null; // newly chosen image (not uploaded yet)
  preview: string; // what to show: new file preview or existing image
  members: MemberDraft[];
}

interface CoverDraft {
  url: string;
  publicId: string;
  file: File | null;
  preview: string;
}

interface FormState {
  title: string;
  organizer: string;
  category: string;
  date: string;
  summary: string;
  story: string;
  linkUrl: string;
  showRanks: boolean;
  featured: boolean;
  consent: boolean;
}

type Tab = 'details' | 'winners' | 'story' | 'publish';

interface Issue {
  tab: Tab;
  message: string;
  winnerKey?: string;
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'details', label: 'Details' },
  { id: 'winners', label: 'Winners' },
  { id: 'story', label: 'Story & media' },
  { id: 'publish', label: 'Review & publish' },
];

const uid = () => Math.random().toString(36).slice(2, 10);

/** "Priya S, B.Tech AI 2026" per line -> { name, detail }. Split on the first comma or tab. */
function parseLines(text: string): { name: string; detail: string }[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const i = l.search(/[,\t]/);
      return i < 0
        ? { name: l, detail: '' }
        : { name: l.slice(0, i).trim(), detail: l.slice(i + 1).trim() };
    })
    .filter((r) => r.name);
}

/** An untouched person card (e.g. the empty one a new form starts with). */
const isBlankPerson = (w: WinnerDraft) =>
  w.kind === 'individual' &&
  !w.name.trim() &&
  !w.detail.trim() &&
  !w.preview &&
  !w.linkedinUrl.trim() &&
  !w.email.trim() &&
  !w.rank.trim();

const newMember = (): MemberDraft => ({
  key: uid(),
  name: '',
  detail: '',
  imageUrl: '',
  imagePublicId: '',
  file: null,
  preview: '',
  linkedinUrl: '',
  email: '',
});

const newWinner = (kind: 'individual' | 'team'): WinnerDraft => ({
  key: uid(),
  kind,
  name: '',
  rank: '',
  detail: '',
  linkedinUrl: '',
  email: '',
  imageUrl: '',
  imagePublicId: '',
  file: null,
  preview: '',
  members: kind === 'team' ? [newMember()] : [],
});

function buildInitial(initial?: Achievement) {
  const form: FormState = {
    title: initial?.title ?? '',
    organizer: initial?.organizer ?? '',
    category: initial?.category ?? CATEGORIES[0],
    date: initial?.date ?? new Date().toISOString().slice(0, 10),
    summary: initial?.summary ?? '',
    story: initial?.story ?? '',
    linkUrl: initial?.linkUrl ?? '',
    showRanks: initial?.showRanks ?? false,
    featured: initial?.featured ?? false,
    // Consent is confirmed again on every save, so it starts unticked on a new entry
    consent: initial?.consent ?? false,
  };
  const cover: CoverDraft = {
    url: initial?.coverImageUrl ?? '',
    publicId: initial?.coverImagePublicId ?? '',
    file: null,
    preview: initial?.coverImageUrl ?? '',
  };
  const winners: WinnerDraft[] = initial
    ? initial.winners.map((w) => ({
        key: w.id || uid(),
        kind: w.kind,
        name: w.name,
        rank: w.rank,
        detail: w.detail,
        linkedinUrl: w.linkedinUrl ?? '',
        email: w.email ?? '',
        imageUrl: w.imageUrl,
        imagePublicId: w.imagePublicId,
        file: null,
        preview: w.imageUrl,
        members: w.members.map((m) => ({
          key: uid(),
          name: m.name,
          detail: m.detail,
          imageUrl: m.imageUrl ?? '',
          imagePublicId: m.imagePublicId ?? '',
          file: null,
          preview: m.imageUrl ?? '',
          linkedinUrl: m.linkedinUrl ?? '',
          email: m.email ?? '',
        })),
      }))
    : [newWinner('individual')];
  return { form, cover, winners };
}

const serialize = (form: FormState, cover: CoverDraft, winners: WinnerDraft[]) =>
  JSON.stringify({
    form,
    cover: { url: cover.url, hasFile: !!cover.file },
    winners: winners.map((w) => ({
      ...w,
      file: !!w.file,
      preview: '',
      members: w.members.map((m) => ({ ...m, file: !!m.file, preview: '' })),
    })),
  });

/** Validates and reads an image file. Calls onInvalid with a message, or onPick with the file + data URL. */
function readImageFile(
  file: File | null | undefined,
  onInvalid: (message: string) => void,
  onPick: (file: File, preview: string) => void
) {
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    onInvalid('Please choose an image file (JPG, PNG or WebP)');
    return;
  }
  if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
    onInvalid(`That image is over ${MAX_IMAGE_MB} MB. Choose a smaller one`);
    return;
  }
  const reader = new FileReader();
  reader.onloadend = () => onPick(file, reader.result as string);
  reader.readAsDataURL(file);
}

/* ─────────────────────────── Small building blocks ─────────────────────────── */

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  );
}

function Field({
  id,
  label,
  required,
  hint,
  aside,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  aside?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-slate-700">
          {label}
          {required && <span className="text-rose-600"> *</span>}
        </label>
        {aside && <span className="text-xs tabular-nums text-slate-400">{aside}</span>}
      </div>
      {children}
      {hint && <p className="mt-1.5 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-800">{label}</p>
        <p className="mt-0.5 text-sm text-slate-500">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        // Inline size + min-size so global button rules (e.g. 44px touch targets) can't stretch the track
        style={{ width: 44, height: 24, minWidth: 44, minHeight: 24 }}
        className={`mt-0.5 box-border inline-flex shrink-0 items-center rounded-full p-0.5 transition-colors ${focusRing} ${
          checked ? 'justify-end bg-indigo-600' : 'justify-start bg-slate-300'
        }`}
      >
        <span
          aria-hidden
          style={{ width: 20, height: 20 }}
          className="block shrink-0 rounded-full bg-white shadow"
        />
      </button>
    </div>
  );
}

function ImagePicker({
  preview,
  round,
  label,
  hint,
  onPick,
  onRemove,
  onInvalid,
}: {
  preview: string;
  round?: boolean;
  label: string;
  hint: string;
  onPick: (file: File, preview: string) => void;
  onRemove: () => void;
  onInvalid: (message: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const accept = (file?: File | null) => readImageFile(file, onInvalid, onPick);

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      className="hidden"
      onChange={(e) => {
        accept(e.target.files?.[0]);
        e.target.value = '';
      }}
    />
  );

  if (preview) {
    return (
      <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-3">
        {input}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={preview}
          alt={label}
          className={`shrink-0 object-cover ring-2 ring-indigo-100 ${
            round ? 'h-16 w-16 rounded-full' : 'h-16 w-28 rounded-xl'
          }`}
        />
        <p className="min-w-0 flex-1 text-sm text-slate-500">{hint}</p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className={`flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 ${focusRing}`}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Replace
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${label}`}
            className={`flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-rose-600 shadow-sm transition hover:bg-rose-50 ${focusRing}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {input}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          accept(e.dataTransfer.files?.[0]);
        }}
        className={`flex w-full items-center gap-4 rounded-2xl border-2 border-dashed p-4 text-left transition ${focusRing} ${
          dragOver ? 'border-indigo-400 bg-indigo-50' : 'border-slate-300 bg-white hover:border-indigo-300 hover:bg-indigo-50/40'
        }`}
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <ImagePlus className="h-6 w-6" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-medium text-slate-800">
            <span className="sm:hidden">Tap to upload {label.toLowerCase()}</span>
            <span className="hidden sm:inline">Drag {label.toLowerCase()} here, or click to browse</span>
          </span>
          <span className="block text-xs text-slate-500">
            {hint} JPG, PNG or WebP, up to {MAX_IMAGE_MB} MB
          </span>
        </span>
      </button>
    </div>
  );
}

/** Compact round photo slot for a team member: tap to add or replace, small X to remove. */
function MemberPhoto({
  preview,
  label,
  onPick,
  onRemove,
  onInvalid,
}: {
  preview: string;
  label: string;
  onPick: (file: File, preview: string) => void;
  onRemove: () => void;
  onInvalid: (message: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="relative h-11 w-11 shrink-0">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          readImageFile(e.target.files?.[0], onInvalid, onPick);
          e.target.value = '';
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        aria-label={preview ? `Replace photo for ${label}` : `Add photo for ${label}`}
        title={preview ? 'Replace photo' : 'Add photo'}
        className={`flex h-11 w-11 items-center justify-center overflow-hidden rounded-full transition ${focusRing} ${
          preview
            ? 'ring-2 ring-indigo-100 hover:ring-indigo-300'
            : 'border-2 border-dashed border-slate-300 bg-white text-slate-400 hover:border-indigo-300 hover:text-indigo-600'
        }`}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="h-full w-full object-cover" />
        ) : (
          <ImagePlus className="h-4 w-4" />
        )}
      </button>
      {preview && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove photo for ${label}`}
          className={`absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-white shadow transition hover:bg-rose-600 ${focusRing}`}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

/* ─────────────────────────── Bulk add (paste a list) ─────────────────────────── */

function BulkAdd({
  noun,
  onAdd,
  onClose,
}: {
  noun: string;
  onAdd: (rows: { name: string; detail: string }[]) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const rows = parseLines(text);

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-3 sm:p-4">
      <p className="text-sm font-medium text-slate-800">Paste a list of {noun}</p>
      <p className="mt-0.5 text-xs text-slate-500">
        One per line. Add a comma and a role or batch if you like, for example “Priya S, B.Tech AI 2026”. You can add
        photos and links afterwards.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        autoFocus
        className={`${inputCls} mt-3 resize-y`}
        placeholder={'Priya S, B.Tech AI 2026\nArun Kumar, B.E. CSE 2025\nMeena R'}
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={rows.length === 0}
          onClick={() => {
            onAdd(rows);
            onClose();
          }}
          className={`flex min-h-[40px] items-center gap-1.5 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50 ${focusRing}`}
        >
          <Plus className="h-4 w-4" />
          {rows.length > 0 ? `Add ${rows.length} ${noun}` : `Add ${noun}`}
        </button>
        <button
          type="button"
          onClick={onClose}
          className={`min-h-[40px] rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 ${focusRing}`}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────── Member row ─────────────────────────────── */

/** One compact line per team member. LinkedIn and email tuck away behind the link button. */
function MemberRow({
  member,
  index,
  onChange,
  onRemove,
  onInvalid,
  onRemoveSavedImage,
}: {
  member: MemberDraft;
  index: number;
  onChange: (patch: Partial<MemberDraft>) => void;
  onRemove: () => void;
  onInvalid: (message: string) => void;
  onRemoveSavedImage: (publicId: string) => void;
}) {
  const hasContacts = !!(member.linkedinUrl.trim() || member.email.trim());
  const [showContacts, setShowContacts] = useState(false);
  const label = member.name.trim() || `member ${index + 1}`;

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center gap-2 p-2">
        <MemberPhoto
          preview={member.preview}
          label={label}
          onPick={(file, preview) => onChange({ file, preview })}
          onRemove={() => {
            if (member.imagePublicId) onRemoveSavedImage(member.imagePublicId);
            onChange({ file: null, preview: '', imageUrl: '', imagePublicId: '' });
          }}
          onInvalid={onInvalid}
        />
        <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
          <input
            type="text"
            value={member.name}
            onChange={(e) => onChange({ name: e.target.value })}
            aria-label={`Member ${index + 1} name`}
            className={inputCls}
            placeholder="Member name"
          />
          <input
            type="text"
            value={member.detail}
            onChange={(e) => onChange({ detail: e.target.value })}
            aria-label={`Member ${index + 1} role or batch`}
            className={inputCls}
            placeholder="Role or batch"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowContacts((v) => !v)}
          aria-expanded={showContacts}
          aria-label={`LinkedIn and email for ${label}`}
          title="LinkedIn and email"
          className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition ${focusRing} ${
            showContacts ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'
          }`}
        >
          <Link2 className="h-4 w-4" />
          {hasContacts && <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-indigo-600" />}
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove member ${index + 1}`}
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 ${focusRing}`}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {showContacts && (
        <div className="grid gap-2 border-t border-slate-100 p-2 sm:grid-cols-2">
          <input
            type="text"
            inputMode="url"
            autoCapitalize="none"
            value={member.linkedinUrl}
            onChange={(e) => onChange({ linkedinUrl: e.target.value })}
            aria-label={`Member ${index + 1} LinkedIn`}
            className={inputCls}
            placeholder="LinkedIn: linkedin.com/in/username"
          />
          <input
            type="email"
            inputMode="email"
            autoCapitalize="none"
            value={member.email}
            onChange={(e) => onChange({ email: e.target.value })}
            aria-label={`Member ${index + 1} email`}
            className={inputCls}
            placeholder="Email: name@example.com"
          />
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────── Winner card ─────────────────────────────── */

/** Collapsible: a one-line summary when closed, the full editor when open. */
function WinnerCard({
  winner,
  index,
  total,
  showRanks,
  open,
  invalid,
  canMove,
  onToggle,
  onChange,
  onMove,
  onRemove,
  onInvalid,
  onRemoveSavedImage,
}: {
  winner: WinnerDraft;
  index: number;
  total: number;
  showRanks: boolean;
  open: boolean;
  invalid: boolean;
  canMove: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<WinnerDraft>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  onInvalid: (message: string) => void;
  onRemoveSavedImage: (publicId: string) => void;
}) {
  const isTeam = winner.kind === 'team';
  const idBase = `w-${winner.key}`;
  const [bulkOpen, setBulkOpen] = useState(false);

  const updateMember = (key: string, patch: Partial<MemberDraft>) =>
    onChange({ members: winner.members.map((m) => (m.key === key ? { ...m, ...patch } : m)) });

  const namedMembers = winner.members.filter((m) => m.name.trim()).length;
  const subtitle = [
    isTeam ? (winner.members.length > 0 ? `Team · ${namedMembers || winner.members.length} members` : 'Team') : 'Person',
    showRanks && winner.rank.trim() ? winner.rank.trim() : '',
    winner.detail.trim(),
  ]
    .filter(Boolean)
    .join(' · ');

  const confirmRemove = () => {
    const hasWork = winner.name.trim() || winner.members.length > 0 || winner.preview;
    if (hasWork && !window.confirm(`Remove ${winner.name.trim() || 'this winner'}?`)) return;
    onRemove();
  };

  return (
    <div
      id={`winner-${winner.key}`}
      className={`scroll-mt-48 rounded-2xl border bg-white shadow-sm transition ${
        open ? 'border-indigo-300 ring-2 ring-indigo-100' : invalid ? 'border-rose-300' : 'border-slate-200'
      }`}
    >
      {/* Summary row */}
      <div className="flex items-center gap-1 p-2">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={`${idBase}-panel`}
          className={`flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1.5 text-left transition hover:bg-slate-50 ${focusRing}`}
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs font-semibold text-slate-600">
            {index + 1}
          </span>
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden bg-slate-100 text-slate-400 ${
              isTeam ? 'rounded-lg' : 'rounded-full'
            }`}
          >
            {winner.preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={winner.preview} alt="" className="h-full w-full object-cover" />
            ) : isTeam ? (
              <Users className="h-5 w-5" />
            ) : (
              <User className="h-5 w-5" />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span
              className={`flex items-center gap-1.5 text-sm font-semibold ${
                winner.name.trim() ? 'text-slate-900' : invalid ? 'text-rose-600' : 'text-slate-400'
              }`}
            >
              <span className="truncate">{winner.name.trim() || (isTeam ? 'Untitled team' : 'Untitled person')}</span>
              {invalid && <AlertCircle className="h-4 w-4 shrink-0" />}
            </span>
            <span className="block truncate text-xs text-slate-500">{subtitle}</span>
          </span>
          <ChevronDown className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        <div className="flex shrink-0 items-center">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={!canMove || index === 0}
            aria-label="Move up"
            className={`flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 disabled:opacity-30 ${focusRing}`}
          >
            <ArrowUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={!canMove || index === total - 1}
            aria-label="Move down"
            className={`flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 disabled:opacity-30 ${focusRing}`}
          >
            <ArrowDown className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={confirmRemove}
            disabled={total === 1}
            aria-label="Remove winner"
            className={`flex h-9 w-9 items-center justify-center rounded-lg text-rose-600 transition hover:bg-rose-50 disabled:opacity-30 ${focusRing}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Editor */}
      {open && (
        <div id={`${idBase}-panel`} className="space-y-4 border-t border-slate-100 p-4 sm:p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id={`${idBase}-name`} label={isTeam ? 'Team name' : 'Full name'} required>
              <input
                id={`${idBase}-name`}
                type="text"
                value={winner.name}
                onChange={(e) => onChange({ name: e.target.value })}
                className={inputCls}
                placeholder={isTeam ? 'Team Phoenix' : 'Gethsia Jennifer'}
              />
            </Field>
            {showRanks ? (
              <Field id={`${idBase}-rank`} label="Rank" hint="Optional. Pick a suggestion or type your own.">
                <input
                  id={`${idBase}-rank`}
                  type="text"
                  list="rank-options"
                  value={winner.rank}
                  onChange={(e) => onChange({ rank: e.target.value })}
                  className={inputCls}
                  placeholder="1st place"
                />
              </Field>
            ) : (
              <Field id={`${idBase}-detail`} label={isTeam ? 'Project or note' : 'Role or batch'} hint="Optional">
                <input
                  id={`${idBase}-detail`}
                  type="text"
                  value={winner.detail}
                  onChange={(e) => onChange({ detail: e.target.value })}
                  className={inputCls}
                  placeholder={isTeam ? 'Smart waste sorting robot' : 'B.Tech AI & ML, 2026'}
                />
              </Field>
            )}
            {showRanks && (
              <div className="sm:col-span-2">
                <Field id={`${idBase}-detail`} label={isTeam ? 'Project or note' : 'Role or batch'} hint="Optional">
                  <input
                    id={`${idBase}-detail`}
                    type="text"
                    value={winner.detail}
                    onChange={(e) => onChange({ detail: e.target.value })}
                    className={inputCls}
                    placeholder={isTeam ? 'Smart waste sorting robot' : 'B.Tech AI & ML, 2026'}
                  />
                </Field>
              </div>
            )}
          </div>

          {!isTeam && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id={`${idBase}-linkedin`} label="LinkedIn" hint="Optional. Shows a LinkedIn icon.">
                <input
                  id={`${idBase}-linkedin`}
                  type="text"
                  inputMode="url"
                  autoCapitalize="none"
                  value={winner.linkedinUrl}
                  onChange={(e) => onChange({ linkedinUrl: e.target.value })}
                  className={inputCls}
                  placeholder="linkedin.com/in/username"
                />
              </Field>
              <Field id={`${idBase}-email`} label="Email" hint="Optional. Shows a mail icon.">
                <input
                  id={`${idBase}-email`}
                  type="email"
                  inputMode="email"
                  autoCapitalize="none"
                  value={winner.email}
                  onChange={(e) => onChange({ email: e.target.value })}
                  className={inputCls}
                  placeholder="name@example.com"
                />
              </Field>
            </div>
          )}

          <div>
            <p className="mb-1.5 text-sm font-medium text-slate-700">{isTeam ? 'Team photo' : 'Photo'}</p>
            <ImagePicker
              round={!isTeam}
              label={isTeam ? 'Team photo' : 'Photo'}
              hint="Optional."
              preview={winner.preview}
              onPick={(file, preview) => onChange({ file, preview })}
              onRemove={() => {
                if (winner.imagePublicId) onRemoveSavedImage(winner.imagePublicId);
                onChange({ file: null, preview: '', imageUrl: '', imagePublicId: '' });
              }}
              onInvalid={onInvalid}
            />
          </div>

          {isTeam && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3 sm:p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium text-slate-700">
                  Team members <span className="font-normal text-slate-400">· {winner.members.length}</span>
                </p>
                <p className="text-xs text-slate-400">Tap the circle for a photo, the link icon for LinkedIn and email.</p>
              </div>

              <div
                className={`mt-3 space-y-2 ${
                  winner.members.length > 6 ? 'max-h-[28rem] overflow-y-auto pr-1' : ''
                }`}
              >
                {winner.members.length === 0 && (
                  <p className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center text-sm text-slate-500">
                    No members yet. Add one, or paste a whole list.
                  </p>
                )}
                {winner.members.map((m, mi) => (
                  <MemberRow
                    key={m.key}
                    member={m}
                    index={mi}
                    onChange={(patch) => updateMember(m.key, patch)}
                    onRemove={() => {
                      if (m.imagePublicId) onRemoveSavedImage(m.imagePublicId);
                      onChange({ members: winner.members.filter((x) => x.key !== m.key) });
                    }}
                    onInvalid={onInvalid}
                    onRemoveSavedImage={onRemoveSavedImage}
                  />
                ))}
              </div>

              {bulkOpen ? (
                <div className="mt-3">
                  <BulkAdd
                    noun="members"
                    onAdd={(rows) =>
                      onChange({
                        members: [
                          // drop completely empty rows so pasting into a fresh team doesn't leave a blank one
                          ...winner.members.filter(
                            (m) => m.name.trim() || m.detail.trim() || m.preview || m.linkedinUrl.trim() || m.email.trim()
                          ),
                          ...rows.map((r) => ({ ...newMember(), name: r.name, detail: r.detail })),
                        ],
                      })
                    }
                    onClose={() => setBulkOpen(false)}
                  />
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onChange({ members: [...winner.members, newMember()] })}
                    className={`flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 ${focusRing}`}
                  >
                    <Plus className="h-4 w-4" />
                    Add member
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkOpen(true)}
                    className={`flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 ${focusRing}`}
                  >
                    <ListPlus className="h-4 w-4" />
                    Paste a list
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={onToggle}
              className={`min-h-[40px] rounded-lg px-3 text-sm font-medium text-indigo-600 transition hover:bg-indigo-50 ${focusRing}`}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────── Form ─────────────────────────────────── */

export default function AchievementForm({ mode, initial }: AchievementFormProps) {
  const router = useRouter();

  const [init] = useState(() => buildInitial(initial));
  const [form, setForm] = useState<FormState>(init.form);
  const [cover, setCover] = useState<CoverDraft>(init.cover);
  const [winners, setWinners] = useState<WinnerDraft[]>(init.winners);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const [tab, setTab] = useState<Tab>('details');
  const [openKey, setOpenKey] = useState<string | null>(init.winners.length === 1 ? init.winners[0].key : null);
  const [query, setQuery] = useState('');
  const [bulkPeopleOpen, setBulkPeopleOpen] = useState(false);
  const [attempted, setAttempted] = useState(false);

  // Saved images the admin removed; deleted from Cloudinary only after a successful save
  const removedIds = useRef<string[]>([]);
  const initialSnapshot = useRef(serialize(init.form, init.cover, init.winners));

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const updateWinner = (key: string, patch: Partial<WinnerDraft>) =>
    setWinners((list) => list.map((w) => (w.key === key ? { ...w, ...patch } : w)));

  const moveWinner = (key: string, dir: -1 | 1) =>
    setWinners((list) => {
      const i = list.findIndex((w) => w.key === key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const removeWinner = (key: string) => {
    setWinners((list) => {
      const target = list.find((w) => w.key === key);
      if (target?.imagePublicId) removedIds.current.push(target.imagePublicId);
      target?.members.forEach((m) => {
        if (m.imagePublicId) removedIds.current.push(m.imagePublicId);
      });
      return list.filter((w) => w.key !== key);
    });
    setOpenKey((k) => (k === key ? null : k));
  };

  const addWinner = (kind: 'individual' | 'team') => {
    const w = newWinner(kind);
    setWinners((l) => [...l, w]);
    setOpenKey(w.key);
    setQuery('');
  };

  const addPeopleFromList = (rows: { name: string; detail: string }[]) => {
    setWinners((l) => [
      ...l.filter((w) => !isBlankPerson(w)),
      ...rows.map((r) => ({ ...newWinner('individual'), name: r.name, detail: r.detail })),
    ]);
    setOpenKey(null);
    setQuery('');
  };

  const dirty = useMemo(
    () => serialize(form, cover, winners) !== initialSnapshot.current,
    [form, cover, winners]
  );

  /* ── Validation: every problem, with the tab (and winner) it lives on ── */

  const issues = useMemo(() => {
    const list: Issue[] = [];
    if (!form.title.trim()) list.push({ tab: 'details', message: 'Add the event or competition name.' });
    if (!form.date) list.push({ tab: 'details', message: 'Choose the date of the achievement.' });
    if (winners.length === 0) list.push({ tab: 'winners', message: 'Add at least one winner.' });
    winners.forEach((w, i) => {
      if (!w.name.trim())
        list.push({ tab: 'winners', message: `Winner ${i + 1} needs a name.`, winnerKey: w.key });
      if (w.kind === 'individual' && w.email.trim() && !EMAIL_RE.test(w.email.trim()))
        list.push({ tab: 'winners', message: `Winner ${i + 1} has an invalid email address.`, winnerKey: w.key });
      if (w.kind === 'team') {
        const bad = w.members.findIndex((m) => m.name.trim() && m.email.trim() && !EMAIL_RE.test(m.email.trim()));
        if (bad >= 0)
          list.push({
            tab: 'winners',
            message: `Member ${bad + 1} of winner ${i + 1} has an invalid email address.`,
            winnerKey: w.key,
          });
      }
    });
    if (!form.consent)
      list.push({
        tab: 'publish',
        message: 'Please confirm you have permission to publish these names, photos and contact details.',
      });
    return list;
  }, [form, winners]);

  const invalidWinnerKeys = useMemo(
    () => new Set(issues.filter((i) => i.winnerKey).map((i) => i.winnerKey as string)),
    [issues]
  );

  const stats = useMemo(() => {
    const people = winners.reduce(
      (n, w) => n + (w.kind === 'team' ? Math.max(w.members.filter((m) => m.name.trim()).length, 1) : 1),
      0
    );
    const photos =
      (cover.preview ? 1 : 0) +
      winners.reduce(
        (n, w) => n + (w.preview ? 1 : 0) + (w.kind === 'team' ? w.members.filter((m) => m.preview).length : 0),
        0
      );
    return { people, photos };
  }, [winners, cover.preview]);

  const goTo = (issue: Issue) => {
    setTab(issue.tab);
    setError(issue.message);
    if (issue.winnerKey) setOpenKey(issue.winnerKey);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const changeTab = (next: Tab) => {
    setTab(next);
    setError('');
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  // Bring a freshly opened winner into view
  useEffect(() => {
    if (!openKey || tab !== 'winners') return;
    document.getElementById(`winner-${openKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [openKey, tab]);

  // Warn before closing the tab with unsaved work
  useEffect(() => {
    if (!dirty || saving) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, saving]);

  const leave = useCallback(() => {
    if (saving) return;
    if (dirty && !window.confirm('Discard your changes?')) return;
    router.push(LIST_PATH);
  }, [saving, dirty, router]);

  /* ── Save ── */

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setError('');

    if (issues.length > 0) {
      setAttempted(true);
      goTo(issues[0]);
      return;
    }

    const uploaded: string[] = []; // new uploads, cleaned up if the save fails
    const stale: string[] = [...removedIds.current]; // old images, cleaned up if the save works
    const memberUploads = winners.reduce(
      (n, w) => n + (w.kind === 'team' ? w.members.filter((m) => m.name.trim() && m.file).length : 0),
      0
    );
    const totalUploads = (cover.file ? 1 : 0) + winners.filter((w) => w.file).length + memberUploads;
    let done = 0;

    const upload = async (file: File) => {
      done += 1;
      setStatus(`Uploading photo ${done} of ${totalUploads}…`);
      const result = await uploadToCloudinary(file);
      uploaded.push(result.publicId);
      return result;
    };

    setSaving(true);
    try {
      // Cover
      let coverImageUrl = cover.url;
      let coverImagePublicId = cover.publicId;
      if (cover.file) {
        const r = await upload(cover.file);
        if (cover.publicId) stale.push(cover.publicId);
        coverImageUrl = r.url;
        coverImagePublicId = r.publicId;
      }

      // Winners
      const winnersPayload = [];
      for (const w of winners) {
        let imageUrl = w.imageUrl;
        let imagePublicId = w.imagePublicId;
        if (w.file) {
          const r = await upload(w.file);
          if (w.imagePublicId) stale.push(w.imagePublicId);
          imageUrl = r.url;
          imagePublicId = r.publicId;
        }

        // Team members (with optional photos). Members left without a name are dropped.
        const membersPayload: {
          name: string;
          detail: string;
          imageUrl: string;
          imagePublicId: string;
          linkedinUrl: string;
          email: string;
        }[] = [];
        if (w.kind === 'team') {
          for (const m of w.members) {
            if (!m.name.trim()) {
              if (m.imagePublicId) stale.push(m.imagePublicId); // dropped member: clean up its saved photo
              continue;
            }
            let mUrl = m.imageUrl;
            let mPublicId = m.imagePublicId;
            if (m.file) {
              const r = await upload(m.file);
              if (m.imagePublicId) stale.push(m.imagePublicId);
              mUrl = r.url;
              mPublicId = r.publicId;
            }
            membersPayload.push({
              name: m.name.trim(),
              detail: m.detail.trim(),
              imageUrl: mUrl,
              imagePublicId: mPublicId,
              linkedinUrl: normalizeUrl(m.linkedinUrl),
              email: m.email.trim(),
            });
          }
        }

        winnersPayload.push({
          id: w.key,
          kind: w.kind,
          name: w.name.trim(),
          // Ranks are only stored when the admin turned them on for this achievement
          rank: form.showRanks ? w.rank.trim() : '',
          detail: w.detail.trim(),
          // Contact icons only apply to individuals; empty string means "no icon"
          linkedinUrl: w.kind === 'individual' ? normalizeUrl(w.linkedinUrl) : '',
          email: w.kind === 'individual' ? w.email.trim() : '',
          imageUrl,
          imagePublicId,
          members: membersPayload,
        });
      }

      setStatus('Saving…');
      const payload = {
        title: form.title.trim(),
        organizer: form.organizer.trim(),
        category: form.category,
        date: form.date,
        summary: form.summary.trim(),
        story: form.story.trim(),
        coverImageUrl,
        coverImagePublicId,
        linkUrl: normalizeUrl(form.linkUrl),
        showRanks: form.showRanks,
        featured: form.featured,
        consent: true,
        winners: winnersPayload,
        updatedAt: serverTimestamp(),
      };

      if (mode === 'edit' && initial) {
        await updateDoc(doc(db, ACHIEVEMENTS_COLLECTION, initial.id), payload);
      } else {
        await addDoc(collection(db, ACHIEVEMENTS_COLLECTION), { ...payload, createdAt: serverTimestamp() });
      }

      removeCloudinaryImages(stale);

      try {
        sessionStorage.setItem(
          'hofToast',
          mode === 'edit' ? `${payload.title} updated` : `${payload.title} added to the Hall of Fame`
        );
      } catch {
        /* storage unavailable */
      }
      initialSnapshot.current = serialize(form, cover, winners); // stops the unsaved-changes prompt
      router.push(LIST_PATH);
    } catch (err) {
      console.error('Error saving achievement:', err);
      removeCloudinaryImages(uploaded); // the save failed, so the new uploads aren't needed
      setError("Couldn't save this achievement. Check your connection and try again.");
    } finally {
      setSaving(false);
      setStatus('');
    }
  };

  /* ── Render helpers ── */

  const tabIndex = TABS.findIndex((t) => t.id === tab);
  const prevTab = tabIndex > 0 ? TABS[tabIndex - 1] : null;
  const nextTab = tabIndex < TABS.length - 1 ? TABS[tabIndex + 1] : null;

  const tabNav = (
    <div className="flex items-center justify-between gap-3 pt-2">
      {prevTab ? (
        <button
          type="button"
          onClick={() => changeTab(prevTab.id)}
          className={`flex min-h-[44px] items-center gap-2 rounded-xl px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100 ${focusRing}`}
        >
          <ArrowLeft className="h-4 w-4" />
          {prevTab.label}
        </button>
      ) : (
        <span />
      )}
      {nextTab && (
        <button
          type="button"
          onClick={() => changeTab(nextTab.id)}
          className={`flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 ${focusRing}`}
        >
          {nextTab.label}
          <ArrowRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );

  const q = query.trim().toLowerCase();
  const visibleWinners = winners
    .map((w, i) => ({ w, i }))
    .filter(({ w }) => !q || w.name.toLowerCase().includes(q) || w.detail.toLowerCase().includes(q));

  /* ── Render ── */

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* Header + tabs */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white pt-[env(safe-area-inset-top)] shadow-sm">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="flex h-16 items-center gap-3">
            <button
              type="button"
              onClick={leave}
              aria-label="Back to achievements"
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 ${focusRing}`}
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-600">
              <Trophy className="h-5 w-5 text-white" />
            </div>
            <h1 className="min-w-0 flex-1 truncate text-lg font-bold text-slate-900 sm:text-xl">
              {mode === 'edit' ? 'Edit achievement' : 'Add achievement'}
            </h1>
            {dirty && <span className="hidden shrink-0 text-xs text-slate-500 sm:block">Unsaved changes</span>}
          </div>

          <div role="tablist" aria-label="Form sections" className="-mb-px flex gap-1 overflow-x-auto">
            {TABS.map((t) => {
              const active = t.id === tab;
              const hasIssue = attempted && issues.some((i) => i.tab === t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => changeTab(t.id)}
                  className={`relative flex min-h-[44px] shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium transition sm:px-4 ${focusRing} ${
                    active
                      ? 'border-indigo-600 text-indigo-700'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {t.label}
                  {t.id === 'winners' && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${
                        active ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {winners.length}
                    </span>
                  )}
                  {hasIssue && <span className="h-2 w-2 rounded-full bg-rose-500" aria-label="Needs attention" />}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <form
        id="achievement-form"
        onSubmit={handleSubmit}
        onKeyDown={(e) => {
          // Enter in a text field should never submit the whole form by accident
          if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') e.preventDefault();
        }}
        className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-6 sm:px-6 sm:py-8"
      >
        <datalist id="rank-options">
          {RANK_SUGGESTIONS.map((r) => (
            <option key={r} value={r} />
          ))}
        </datalist>

        {/* ───── Details ───── */}
        {tab === 'details' && (
          <>
            <Card title="Achievement" description="What was won, and when.">
              <Field id="ach-title" label="Event or competition" required>
                <input
                  id="ach-title"
                  type="text"
                  value={form.title}
                  onChange={(e) => set({ title: e.target.value })}
                  className={inputCls}
                  placeholder="Smart India Hackathon 2025"
                  autoFocus={mode === 'create'}
                />
              </Field>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field id="ach-category" label="Category" required>
                  <select
                    id="ach-category"
                    value={form.category}
                    onChange={(e) => set({ category: e.target.value })}
                    className={`${inputCls} cursor-pointer`}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                    {!CATEGORIES.includes(form.category) && <option value={form.category}>{form.category}</option>}
                  </select>
                </Field>
                <Field id="ach-date" label="Date" required>
                  <input
                    id="ach-date"
                    type="date"
                    value={form.date}
                    onChange={(e) => set({ date: e.target.value })}
                    className={inputCls}
                  />
                </Field>
              </div>

              <Field id="ach-organizer" label="Organized by" hint="Optional. For example a college, company or club.">
                <input
                  id="ach-organizer"
                  type="text"
                  value={form.organizer}
                  onChange={(e) => set({ organizer: e.target.value })}
                  className={inputCls}
                  placeholder="Ministry of Education"
                />
              </Field>

              <Field
                id="ach-summary"
                label="One-line summary"
                aside={`${form.summary.length}/${MAX_SUMMARY}`}
                hint="Optional. Shown on the card."
              >
                <input
                  id="ach-summary"
                  type="text"
                  maxLength={MAX_SUMMARY}
                  value={form.summary}
                  onChange={(e) => set({ summary: e.target.value })}
                  className={inputCls}
                  placeholder="Built a flood alert system in 36 hours"
                />
              </Field>
            </Card>
            {tabNav}
          </>
        )}

        {/* ───── Winners ───── */}
        {tab === 'winners' && (
          <>
            <Card
              title="Winners"
              description={`${winners.length} ${winners.length === 1 ? 'winner' : 'winners'} · ${stats.people} ${
                stats.people === 1 ? 'person' : 'people'
              }. Open a card to edit it.`}
            >
              <Toggle
                checked={form.showRanks}
                onChange={(next) => set({ showRanks: next })}
                label="Show ranks"
                description="Display positions like 1st or Finalist. Turn off to present every winner equally."
              />

              {winners.length > 5 && (
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    aria-label="Search winners"
                    className={`${inputCls} pl-10`}
                    placeholder="Search winners"
                  />
                </div>
              )}

              <div className="space-y-3">
                {visibleWinners.map(({ w, i }) => (
                  <WinnerCard
                    key={w.key}
                    winner={w}
                    index={i}
                    total={winners.length}
                    showRanks={form.showRanks}
                    open={openKey === w.key}
                    invalid={attempted && invalidWinnerKeys.has(w.key)}
                    canMove={!q}
                    onToggle={() => setOpenKey((k) => (k === w.key ? null : w.key))}
                    onChange={(patch) => updateWinner(w.key, patch)}
                    onMove={(dir) => moveWinner(w.key, dir)}
                    onRemove={() => removeWinner(w.key)}
                    onInvalid={setError}
                    onRemoveSavedImage={(id) => removedIds.current.push(id)}
                  />
                ))}
                {visibleWinners.length === 0 && (
                  <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                    No winners match “{query}”.
                  </p>
                )}
              </div>

              {bulkPeopleOpen ? (
                <BulkAdd noun="people" onAdd={addPeopleFromList} onClose={() => setBulkPeopleOpen(false)} />
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => addWinner('individual')}
                    className={`flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 ${focusRing}`}
                  >
                    <User className="h-4 w-4" />
                    Add person
                  </button>
                  <button
                    type="button"
                    onClick={() => addWinner('team')}
                    className={`flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 ${focusRing}`}
                  >
                    <Users className="h-4 w-4" />
                    Add team
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkPeopleOpen(true)}
                    className={`flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 ${focusRing}`}
                  >
                    <ListPlus className="h-4 w-4" />
                    Paste a list of people
                  </button>
                </div>
              )}
            </Card>
            {tabNav}
          </>
        )}

        {/* ───── Story and media ───── */}
        {tab === 'story' && (
          <>
            <Card title="Story and media" description="What shows on the full details page.">
              <div>
                <p className="mb-1.5 text-sm font-medium text-slate-700">Cover photo</p>
                <ImagePicker
                  label="Cover photo"
                  hint="Shown on the card and at the top of the details page."
                  preview={cover.preview}
                  onPick={(file, preview) => setCover((c) => ({ ...c, file, preview }))}
                  onRemove={() => {
                    if (cover.publicId) removedIds.current.push(cover.publicId);
                    setCover({ url: '', publicId: '', file: null, preview: '' });
                  }}
                  onInvalid={setError}
                />
              </div>

              <Field
                id="ach-story"
                label="The story"
                aside={`${form.story.length}/${MAX_STORY}`}
                hint="Optional. What they did and the effort behind it. Use a new line for a new paragraph."
              >
                <textarea
                  id="ach-story"
                  rows={9}
                  maxLength={MAX_STORY}
                  value={form.story}
                  onChange={(e) => set({ story: e.target.value })}
                  className={`${inputCls} resize-y`}
                  placeholder="Tell the story behind the win..."
                />
              </Field>

              <Field id="ach-link" label="Link" hint="Optional. A news post, project page or certificate.">
                <input
                  id="ach-link"
                  type="text"
                  inputMode="url"
                  autoCapitalize="none"
                  value={form.linkUrl}
                  onChange={(e) => set({ linkUrl: e.target.value })}
                  className={inputCls}
                  placeholder="example.com/our-win"
                />
              </Field>
            </Card>
            {tabNav}
          </>
        )}

        {/* ───── Review and publish ───── */}
        {tab === 'publish' && (
          <>
            <Card title="Review" description="A quick look at what will be published.">
              <dl className="grid grid-cols-3 gap-3 text-center">
                {[
                  { label: winners.length === 1 ? 'Winner' : 'Winners', value: winners.length },
                  { label: stats.people === 1 ? 'Person' : 'People', value: stats.people },
                  { label: stats.photos === 1 ? 'Photo' : 'Photos', value: stats.photos },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl bg-slate-50 p-3">
                    <dd className="text-2xl font-semibold tabular-nums text-slate-900">{s.value}</dd>
                    <dt className="text-xs text-slate-500">{s.label}</dt>
                  </div>
                ))}
              </dl>

              {issues.length === 0 ? (
                <p className="flex items-center gap-2 text-sm text-emerald-700">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  Everything required is filled in.
                </p>
              ) : (
                <div>
                  <p className="mb-2 text-sm font-medium text-slate-800">
                    {issues.length === 1 ? '1 thing to fix' : `${issues.length} things to fix`}
                  </p>
                  <ul className="space-y-1.5">
                    {issues.map((issue, i) => (
                      <li key={i} className="flex items-start justify-between gap-3 rounded-lg bg-rose-50 px-3 py-2">
                        <span className="flex items-start gap-2 text-sm text-rose-800">
                          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                          {issue.message}
                        </span>
                        {issue.tab !== 'publish' && (
                          <button
                            type="button"
                            onClick={() => {
                              setTab(issue.tab);
                              setError('');
                              if (issue.winnerKey) setOpenKey(issue.winnerKey);
                              window.scrollTo({ top: 0, behavior: 'auto' });
                            }}
                            className={`shrink-0 rounded-md px-2 py-1 text-xs font-medium text-rose-700 underline-offset-2 hover:underline ${focusRing}`}
                          >
                            Fix
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>

            <Card title="Display">
              <Toggle
                checked={form.featured}
                onChange={(next) => set({ featured: next })}
                label="Feature in the spotlight"
                description="Shown in the big banner at the top of the Hall of Fame. The latest featured one wins the spot."
              />
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <input
                  type="checkbox"
                  checked={form.consent}
                  onChange={(e) => set({ consent: e.target.checked })}
                  className="mt-0.5 h-5 w-5 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
                />
                <span className="text-sm text-slate-700">
                  I have permission to publish these names, photos and contact details.
                  <span className="mt-0.5 block text-xs text-slate-500">
                    For students under 18, this means permission from a parent or guardian.
                  </span>
                </span>
              </label>
            </Card>
            {tabNav}
          </>
        )}
      </form>

      {/* Sticky action bar */}
      <div className="sticky bottom-0 z-30 border-t border-slate-200 bg-white/95 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          {error && (
            <p role="alert" className="mb-3 flex items-start gap-2 text-sm text-rose-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </p>
          )}
          <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:items-center sm:justify-end">
            {saving && status ? (
              <p className="text-center text-sm text-slate-500 sm:mr-auto sm:text-left" aria-live="polite">
                {status}
              </p>
            ) : (
              dirty && (
                <p className="text-center text-sm text-slate-500 sm:mr-auto sm:text-left sm:hidden">Unsaved changes</p>
              )
            )}
            <button
              type="button"
              onClick={leave}
              disabled={saving}
              className={`min-h-[48px] rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 sm:min-h-[44px] ${focusRing}`}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="achievement-form"
              disabled={saving || (mode === 'edit' && !dirty)}
              className={`flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 text-sm font-medium text-white shadow-sm shadow-indigo-600/30 transition hover:bg-indigo-700 disabled:opacity-60 sm:min-h-[44px] sm:min-w-[170px] ${focusRing}`}
            >
              {saving ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Saving…
                </>
              ) : mode === 'edit' ? (
                'Save changes'
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Add achievement
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}