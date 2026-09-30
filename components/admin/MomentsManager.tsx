// components/admin/MomentsManager.tsx
// Manages the "moments" gallery of ONE event. Changes are saved to Firestore
// immediately (upload -> arrayUnion, delete -> arrayRemove), independent of any
// surrounding form's Save button.
import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import {
  doc,
  onSnapshot,
  updateDoc,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { MomentImage, getMomentThumbUrl } from '@/lib/events';
import { ImagePlus, Trash2, Image as ImageIcon } from 'lucide-react';

interface MomentsManagerProps {
  eventId: string;
  onToast: (message: string, type: 'success' | 'error') => void;
}

const MAX_SIZE = 8 * 1024 * 1024; // 8MB per image
const MAX_FILES_PER_BATCH = 30;
const CONCURRENCY = 3;

// ----- one thumbnail in the admin grid -----
function ManagerThumb({
  moment,
  confirming,
  deleting,
  onAskDelete,
  onCancel,
  onConfirm,
}: {
  moment: MomentImage;
  confirming: boolean;
  deleting: boolean;
  onAskDelete: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth > 0) setLoaded(true);
  }, []);

  return (
    <div className="group relative aspect-[4/3] overflow-hidden rounded-lg border border-white/10 bg-white/5">
      {!loaded && !failed && (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-white/10 to-white/5" />
      )}
      {failed ? (
        <div className="absolute inset-0 flex items-center justify-center text-white/30">
          <ImageIcon className="h-6 w-6" />
        </div>
      ) : (
        <Image
          ref={imgRef}
          src={getMomentThumbUrl(moment.url)}
          alt="Moment"
          fill
          unoptimized
          sizes="200px"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={`object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        />
      )}

      {/* Delete button (always visible on touch, hover on desktop) */}
      {!confirming && !deleting && (
        <button
          type="button"
          onClick={onAskDelete}
          title="Delete image"
          className="absolute right-2 top-2 rounded-full bg-red-500 p-1.5 text-white opacity-100 shadow-lg transition-all hover:bg-red-600 sm:opacity-0 sm:group-hover:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Inline confirm */}
      {(confirming || deleting) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/75 p-2 backdrop-blur-sm">
          {deleting ? (
            <>
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              <p className="text-xs text-white/80">Deleting...</p>
            </>
          ) : (
            <>
              <p className="text-xs font-medium text-white">Delete this photo?</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onCancel}
                  className="rounded-md border border-white/20 bg-white/10 px-2.5 py-1 text-xs text-white hover:bg-white/20"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onConfirm}
                  className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ----- manager -----
export default function MomentsManager({ eventId, onToast }: MomentsManagerProps) {
  const [moments, setMoments] = useState<MomentImage[]>([]);
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Live moments for this event
  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'events', eventId),
      (snap) => {
        const data = snap.data();
        setMoments((data?.moments as MomentImage[]) || []);
        setReady(true);
      },
      (error) => {
        console.error('Moments listener error:', error);
        setReady(true);
      }
    );
    return () => unsubscribe();
  }, [eventId]);

  const uploading = progress !== null;

  const handleFiles = async (fileList: FileList | File[] | null) => {
    if (!fileList || uploading) return;
    const all = Array.from(fileList);
    if (all.length === 0) return;

    let valid = all.filter((f) => f.type.startsWith('image/') && f.size <= MAX_SIZE);
    const skipped = all.length - valid.length;

    if (valid.length > MAX_FILES_PER_BATCH) {
      onToast(`Only the first ${MAX_FILES_PER_BATCH} images were used`, 'error');
      valid = valid.slice(0, MAX_FILES_PER_BATCH);
    }
    if (skipped > 0) {
      onToast(`${skipped} file${skipped > 1 ? 's' : ''} skipped (images under 8MB only)`, 'error');
    }
    if (valid.length === 0) return;

    setProgress({ done: 0, total: valid.length });

    const uploaded: MomentImage[] = [];
    let failed = 0;
    let done = 0;
    let cursor = 0;

    // Small worker pool so we don't upload everything at once
    const worker = async () => {
      while (cursor < valid.length) {
        const file = valid[cursor++];
        try {
          const { url, publicId } = await uploadToCloudinary(file);
          uploaded.push({ url, publicId, addedAt: Date.now() });
        } catch (error) {
          console.error('Upload failed:', error);
          failed++;
        }
        done++;
        setProgress({ done, total: valid.length });
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, valid.length) }, () => worker())
    );

    try {
      if (uploaded.length > 0) {
        await updateDoc(doc(db, 'events', eventId), {
          moments: arrayUnion(...uploaded),
          updatedAt: serverTimestamp(),
        });
      }
      if (failed > 0) {
        onToast(`Added ${uploaded.length}, ${failed} failed to upload`, 'error');
      } else if (uploaded.length > 0) {
        onToast(
          `${uploaded.length} photo${uploaded.length > 1 ? 's' : ''} added to gallery`,
          'success'
        );
      }
    } catch (error) {
      console.error('Saving moments failed:', error);
      onToast('Photos uploaded but could not be saved to the event', 'error');
    } finally {
      setProgress(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleDelete = async (moment: MomentImage) => {
    setDeletingId(moment.publicId);
    try {
      if (moment.publicId) {
        await fetch('/api/cloudinary/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ publicId: moment.publicId }),
        }).catch((err) => console.warn('Cloudinary cleanup failed:', err));
      }
      await updateDoc(doc(db, 'events', eventId), {
        moments: arrayRemove(moment),
        updatedAt: serverTimestamp(),
      });
      onToast('Photo deleted', 'success');
    } catch (error) {
      console.error('Delete moment failed:', error);
      onToast('Failed to delete photo', 'error');
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  };

  return (
    <div>
      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setIsDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`rounded-xl border-2 border-dashed p-5 text-center backdrop-blur-xl transition-all ${
          isDragging ? 'border-blue-500/50 bg-blue-500/10' : 'border-white/20 bg-white/5'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/jpg,image/webp"
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />

        {uploading ? (
          <div className="mx-auto max-w-sm">
            <p className="mb-3 text-sm text-white/80">
              Uploading {progress!.done} of {progress!.total}...
            </p>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-blue-500 transition-all duration-300"
                style={{ width: `${(progress!.done / progress!.total) * 100}%` }}
              />
            </div>
          </div>
        ) : (
          <>
            <ImagePlus className="mx-auto mb-2 h-8 w-8 text-white/40" />
            <p className="text-sm text-white/80">
              {isDragging ? 'Drop photos here...' : 'Drag photos here or'}
            </p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-lg transition-all hover:bg-blue-700 hover:shadow-blue-500/25"
            >
              <ImagePlus className="h-4 w-4" />
              Choose photos
            </button>
            <p className="mt-3 text-xs text-white/50">
              PNG, JPG, WEBP • Max 8MB each • Up to {MAX_FILES_PER_BATCH} at a time
            </p>
          </>
        )}
      </div>

      {/* Grid */}
      <div className="mt-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium text-white">Gallery</p>
          <p className="text-xs text-white/50">
            {moments.length} photo{moments.length !== 1 ? 's' : ''}
          </p>
        </div>

        {!ready ? (
          <div className="flex justify-center py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          </div>
        ) : moments.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/5 py-10 text-center">
            <ImageIcon className="mx-auto mb-2 h-8 w-8 text-white/30" />
            <p className="text-sm text-white/60">No photos yet</p>
            <p className="mt-1 text-xs text-white/40">Upload photos above to build the gallery</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {moments.map((moment) => (
              <ManagerThumb
                key={moment.publicId || moment.url}
                moment={moment}
                confirming={confirmId === moment.publicId}
                deleting={deletingId === moment.publicId}
                onAskDelete={() => setConfirmId(moment.publicId)}
                onCancel={() => setConfirmId(null)}
                onConfirm={() => handleDelete(moment)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}