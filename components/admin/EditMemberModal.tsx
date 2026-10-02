// components/admin/EditMemberModal.tsx
'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { GraduationCap, Info, Pencil, Plus, User, X } from 'lucide-react';
import { db } from '@/lib/firebase';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { generateAcademicYears } from '@/lib/utils/academicYear';
import { TeamMember } from '@/app/admin/team/page';
import ImageUpload from './ImageUpload';

interface EditMemberModalProps {
  member: TeamMember;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

type Category = 'faculty' | 'student';

const BIO_LIMIT = 600;

const inputClass =
  'min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 disabled:bg-slate-50 disabled:text-slate-500';

const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600';

const normalizeUrl = (value: string) => {
  const v = value.trim();
  if (!v) return null;
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
};

// Best-effort: a failed image cleanup should never block the user
const removeImage = (publicId: string) => {
  fetch('/api/cloudinary/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ publicId }),
  }).catch(() => {});
};

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
          {required && <span className="text-red-600"> *</span>}
        </label>
        {aside && <span className="text-xs text-slate-500">{aside}</span>}
      </div>
      {children}
      {hint && (
        <p className="mt-1.5 flex items-start gap-1.5 text-xs text-slate-500">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {hint}
        </p>
      )}
    </div>
  );
}

function Choice({
  name,
  checked,
  onChange,
  children,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  children: React.ReactNode;
}) {
  return (
    <label className="block cursor-pointer">
      <input type="radio" name={name} checked={checked} onChange={onChange} className="peer sr-only" />
      <span className="flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-600 transition-colors hover:border-slate-400 peer-checked:border-indigo-600 peer-checked:bg-indigo-50 peer-checked:text-indigo-700 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-indigo-600">
        {children}
      </span>
    </label>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h3 className="border-b border-slate-200 pb-2 text-sm font-semibold text-slate-900">{title}</h3>
      {children}
    </section>
  );
}

export default function EditMemberModal({ member, onClose, onSuccess, onError }: EditMemberModalProps) {
  const initialForm = useRef({
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
    category: member.category as Category,
    order: member.order,
  });
  const initialExpertise = useRef<string[]>(member.expertise || []);

  const [formData, setFormData] = useState(initialForm.current);
  const [expertise, setExpertise] = useState<string[]>(initialExpertise.current);
  const [expertiseInput, setExpertiseInput] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>(member.imageUrl);
  const [loading, setLoading] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);

  // Make sure an older year that isn't in the generated list can still be selected
  const generated = generateAcademicYears();
  const academicYears = generated.includes(member.academicYear) ? generated : [member.academicYear, ...generated];

  const bioLimit = Math.max(BIO_LIMIT, member.description?.length ?? 0);

  const update = <K extends keyof typeof formData>(key: K, value: (typeof formData)[K]) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  const dirty =
    JSON.stringify(formData) !== JSON.stringify(initialForm.current) ||
    JSON.stringify(expertise) !== JSON.stringify(initialExpertise.current) ||
    expertiseInput.trim() !== '' ||
    imageFile !== null;

  const requestClose = useCallback(() => {
    if (loading) return;
    if (dirty && !window.confirm('Discard your changes?')) return;
    onClose();
  }, [loading, dirty, onClose]);

  // Esc closes, body scroll is locked, first field is focused
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [requestClose]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    nameRef.current?.focus();
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const handleImageSelect = (file: File) => {
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const addExpertise = () => {
    const value = expertiseInput.trim().replace(/,+$/, '').trim();
    if (!value) return;
    if (!expertise.some((e) => e.toLowerCase() === value.toLowerCase())) {
      setExpertise((prev) => [...prev, value]);
    }
    setExpertiseInput('');
  };

  const removeExpertise = (item: string) => setExpertise((prev) => prev.filter((e) => e !== item));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || !dirty) return;

    if (!formData.academicYear.trim()) {
      onError('Please select an academic year');
      return;
    }

    // Include a tag that was typed but not yet added
    const pending = expertiseInput.trim().replace(/,+$/, '').trim();
    const finalExpertise =
      pending && !expertise.some((x) => x.toLowerCase() === pending.toLowerCase())
        ? [...expertise, pending]
        : expertise;

    const name = formData.name.trim();
    setLoading(true);
    let uploaded: { url: string; publicId: string } | null = null;

    try {
      let imageUrl = member.imageUrl;
      let imagePublicId = member.imagePublicId;

      if (imageFile) {
        uploaded = await uploadToCloudinary(imageFile);
        imageUrl = uploaded.url;
        imagePublicId = uploaded.publicId;
      }

      await updateDoc(doc(db, 'team', member.id), {
        name,
        role: formData.role.trim(),
        specialization: formData.specialization.trim(),
        description: formData.description.trim(),
        email: formData.email.trim() || null,
        linkedinUrl: normalizeUrl(formData.linkedinUrl),
        portfolioUrl: normalizeUrl(formData.portfolioUrl),
        registerId: formData.category === 'student' ? formData.registerId.trim() || null : null,
        academicYear: formData.academicYear,
        isCurrent: formData.isCurrent,
        category: formData.category,
        order: formData.order,
        expertise: finalExpertise.length > 0 ? finalExpertise : null,
        imageUrl,
        imagePublicId,
        updatedAt: serverTimestamp(),
      });

      // Only remove the old photo once the new one is safely saved
      if (uploaded && member.imagePublicId) removeImage(member.imagePublicId);

      onSuccess(`${name} updated`);
    } catch (error) {
      console.error('Error updating member:', error);
      // The save failed, so the freshly uploaded photo isn't needed
      if (uploaded) removeImage(uploaded.publicId);
      onError("Couldn't save your changes. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-member-title"
        className="flex max-h-[94vh] w-full max-w-2xl flex-col rounded-t-2xl bg-white shadow-xl sm:max-h-[90vh] sm:rounded-2xl"
      >
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-600">
              <Pencil className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <h2 id="edit-member-title" className="text-lg font-bold text-slate-900">
                Edit team member
              </h2>
              <p className="truncate text-sm text-slate-500">{member.name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={requestClose}
            disabled={loading}
            aria-label="Close"
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 ${focusRing}`}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form id="edit-member-form" onSubmit={handleSubmit} className="flex-1 space-y-8 overflow-y-auto px-5 py-6 sm:px-6">
          <Section title="Photo">
            <ImageUpload onImageSelect={handleImageSelect} imagePreview={imagePreview} />
            <p className="flex items-start gap-1.5 text-xs text-slate-500">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {imageFile
                ? 'The new photo replaces the current one when you save.'
                : 'Choose a new photo to replace the current one, or leave it as is.'}
            </p>
          </Section>

          <Section title="Placement">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field id="em-year" label="Academic year" required>
                <select
                  id="em-year"
                  required
                  value={formData.academicYear}
                  onChange={(e) => update('academicYear', e.target.value)}
                  className={`${inputClass} cursor-pointer`}
                >
                  {academicYears.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </Field>

              <div>
                <p className="mb-1.5 text-sm font-medium text-slate-700">
                  Category <span className="text-red-600">*</span>
                </p>
                <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Category">
                  <Choice name="em-category" checked={formData.category === 'faculty'} onChange={() => update('category', 'faculty')}>
                    <GraduationCap className="h-4 w-4" />
                    Faculty
                  </Choice>
                  <Choice name="em-category" checked={formData.category === 'student'} onChange={() => update('category', 'student')}>
                    <User className="h-4 w-4" />
                    Student
                  </Choice>
                </div>
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-sm font-medium text-slate-700">
                Status <span className="text-red-600">*</span>
              </p>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Status">
                <Choice name="em-status" checked={formData.isCurrent} onChange={() => update('isCurrent', true)}>
                  Current team
                </Choice>
                <Choice name="em-status" checked={!formData.isCurrent} onChange={() => update('isCurrent', false)}>
                  Past member
                </Choice>
              </div>
              <p className="mt-1.5 flex items-start gap-1.5 text-xs text-slate-500">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {formData.isCurrent
                  ? 'Shown on the public team page.'
                  : 'Listed under History for the academic year above.'}
              </p>
            </div>
          </Section>

          <Section title="Profile">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field id="em-name" label="Full name" required>
                <input
                  id="em-name"
                  ref={nameRef}
                  type="text"
                  required
                  autoComplete="off"
                  value={formData.name}
                  onChange={(e) => update('name', e.target.value)}
                  className={inputClass}
                  placeholder="John Doe"
                />
              </Field>
              <Field id="em-role" label="Role or position" required>
                <input
                  id="em-role"
                  type="text"
                  required
                  value={formData.role}
                  onChange={(e) => update('role', e.target.value)}
                  className={inputClass}
                  placeholder="PhD Researcher"
                />
              </Field>
            </div>

            <Field id="em-spec" label="Specialization" required>
              <input
                id="em-spec"
                type="text"
                required
                value={formData.specialization}
                onChange={(e) => update('specialization', e.target.value)}
                className={inputClass}
                placeholder="Deep Learning"
              />
            </Field>

            <Field id="em-bio" label="Biography" required aside={`${formData.description.length}/${bioLimit}`}>
              <textarea
                id="em-bio"
                required
                rows={4}
                maxLength={bioLimit}
                value={formData.description}
                onChange={(e) => update('description', e.target.value)}
                className={`${inputClass} resize-none`}
                placeholder="A short bio highlighting achievements and contributions."
              />
            </Field>

            {formData.category === 'student' && (
              <Field id="em-reg" label="Register ID">
                <input
                  id="em-reg"
                  type="text"
                  value={formData.registerId}
                  onChange={(e) => update('registerId', e.target.value)}
                  className={`${inputClass} font-mono`}
                  placeholder="REG12345"
                />
              </Field>
            )}
          </Section>

          <Section title="Contact and links">
            <Field id="em-email" label="Email address">
              <input
                id="em-email"
                type="email"
                value={formData.email}
                onChange={(e) => update('email', e.target.value)}
                className={inputClass}
                placeholder="john.doe@example.com"
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field id="em-linkedin" label="LinkedIn">
                <input
                  id="em-linkedin"
                  type="text"
                  inputMode="url"
                  autoCapitalize="none"
                  value={formData.linkedinUrl}
                  onChange={(e) => update('linkedinUrl', e.target.value)}
                  className={inputClass}
                  placeholder="linkedin.com/in/username"
                />
              </Field>
              <Field id="em-portfolio" label="Portfolio">
                <input
                  id="em-portfolio"
                  type="text"
                  inputMode="url"
                  autoCapitalize="none"
                  value={formData.portfolioUrl}
                  onChange={(e) => update('portfolioUrl', e.target.value)}
                  className={inputClass}
                  placeholder="yourportfolio.com"
                />
              </Field>
            </div>
            <p className="-mt-1 text-xs text-slate-500">You can leave out https://, we add it for you.</p>
          </Section>

          <Section title="Expertise">
            <Field id="em-expertise" label="Areas of expertise" hint="Press Enter or comma to add each one.">
              <div className="flex gap-2">
                <input
                  id="em-expertise"
                  type="text"
                  value={expertiseInput}
                  onChange={(e) => setExpertiseInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault();
                      addExpertise();
                    }
                  }}
                  className={`${inputClass} flex-1`}
                  placeholder="e.g. Machine Learning, Python"
                />
                <button
                  type="button"
                  onClick={addExpertise}
                  disabled={!expertiseInput.trim()}
                  className={`flex min-h-[44px] items-center gap-2 rounded-lg bg-slate-100 px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200 disabled:opacity-50 ${focusRing}`}
                >
                  <Plus className="h-4 w-4" />
                  Add
                </button>
              </div>
            </Field>
            {expertise.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {expertise.map((item) => (
                  <li
                    key={item}
                    className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 py-1 pl-2.5 pr-1 text-sm text-slate-700"
                  >
                    {item}
                    <button
                      type="button"
                      onClick={() => removeExpertise(item)}
                      aria-label={`Remove ${item}`}
                      className={`flex h-6 w-6 items-center justify-center rounded text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700 ${focusRing}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Display">
            <Field
              id="em-order"
              label="Display order"
              required
              hint="Lower numbers appear first within their category."
            >
              <input
                id="em-order"
                type="number"
                required
                min={0}
                inputMode="numeric"
                value={formData.order}
                onChange={(e) => update('order', parseInt(e.target.value, 10) || 0)}
                className={`${inputClass} sm:max-w-[160px]`}
              />
            </Field>
          </Section>
        </form>

        {/* Footer */}
        <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:rounded-b-2xl sm:px-6">
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
            {dirty && !loading && (
              <p className="text-center text-sm text-slate-500 sm:mr-auto sm:text-left">Unsaved changes</p>
            )}
            <button
              type="button"
              onClick={requestClose}
              disabled={loading}
              className={`min-h-[44px] rounded-lg bg-slate-100 px-5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200 disabled:opacity-60 ${focusRing}`}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="edit-member-form"
              disabled={loading || !dirty}
              className={`flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-60 ${focusRing}`}
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/60 border-t-transparent" />
                  Saving…
                </>
              ) : (
                'Save changes'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}