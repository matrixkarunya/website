// components/admin/ManageCategoriesModal.tsx
import React, { useState } from 'react';
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { EventCategory, EventItem } from '@/lib/events';
import { X, Plus, Tag, Trash2, Lock } from 'lucide-react';
import styles from './adminModal.module.css';

interface ManageCategoriesModalProps {
  categories: EventCategory[];
  events: EventItem[]; // used to block deleting categories that are still in use
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export default function ManageCategoriesModal({
  categories,
  events,
  onClose,
  onSuccess,
  onError,
}: ManageCategoriesModalProps) {
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const usageCount = (name: string) =>
    events.filter((e) => e.category === name).length;

  const handleAdd = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const name = newName.trim();
    if (!name) return;

    if (categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      onError('That category already exists');
      return;
    }

    setAdding(true);
    try {
      await addDoc(collection(db, 'eventCategories'), {
        name,
        createdAt: serverTimestamp(),
      });
      setNewName('');
      onSuccess(`Category "${name}" added`);
    } catch (error) {
      console.error('Error adding category:', error);
      onError('Failed to add category');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (category: EventCategory) => {
    if (usageCount(category.name) > 0) return; // guarded in UI too

    setDeletingId(category.id);
    try {
      await deleteDoc(doc(db, 'eventCategories', category.id));
      onSuccess(`Category "${category.name}" deleted`);
    } catch (error) {
      console.error('Error deleting category:', error);
      onError('Failed to delete category');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div
        className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col"
        style={{ maxHeight: '100%' }}
      >
        {/* Header */}
        <div className="flex-shrink-0 bg-white/5 backdrop-blur-xl border-b border-white/10 px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Tag className="w-5 h-5 text-blue-400" />
              </div>
              Event Categories
            </h2>
            <p className="text-white/60 text-sm mt-1 ml-11">
              Add or remove categories used for events
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Add new */}
        <form
          onSubmit={handleAdd}
          className="flex-shrink-0 px-6 pt-6 pb-4 flex gap-2"
        >
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New category, e.g. Competition"
            maxLength={30}
            className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
          />
          <button
            type="submit"
            disabled={adding || !newName.trim()}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all flex items-center gap-2 font-medium disabled:opacity-50"
          >
            {adding ? (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            Add
          </button>
        </form>

        {/* List */}
        <div
          className={`flex-1 overflow-y-auto px-6 pb-6 ${styles.scroll}`}
          style={{ minHeight: 0 }}
        >
          {categories.length === 0 ? (
            <div className="text-center py-10 bg-white/5 rounded-xl border-2 border-dashed border-white/10">
              <Tag className="w-10 h-10 text-white/40 mx-auto mb-2" />
              <p className="text-white/60 text-sm">No categories yet</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {categories.map((cat) => {
                const count = usageCount(cat.name);
                const inUse = count > 0;
                return (
                  <li
                    key={cat.id}
                    className="flex items-center justify-between gap-3 px-4 py-3 bg-white/5 border border-white/10 rounded-xl"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-sm font-medium text-white truncate">
                        {cat.name}
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/10 text-white/60 border border-white/10 flex-shrink-0">
                        {count} event{count !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {inUse ? (
                      <div
                        className="p-2 text-white/30 cursor-not-allowed"
                        title="Can't delete: events still use this category"
                      >
                        <Lock className="w-4 h-4" />
                      </div>
                    ) : (
                      <button
                        onClick={() => handleDelete(cat)}
                        disabled={deletingId === cat.id}
                        className="p-2 text-red-300 hover:text-red-200 hover:bg-red-500/10 rounded-lg transition-all disabled:opacity-50"
                        title="Delete category"
                      >
                        {deletingId === cat.id ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-red-300 border-t-transparent" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <p className="text-xs text-white/40 mt-4">
            Categories with events can&apos;t be deleted. Move or delete those events first.
          </p>
        </div>
      </div>
    </div>
  );
}