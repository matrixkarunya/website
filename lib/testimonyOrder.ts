// lib/testimonyOrder.ts
//
// Keeps the `order` field of the `testimonies` collection contiguous
// (1, 2, 3 … N, no gaps, no duplicates) on every add / edit / delete.
//
// Each operation reads the current list once, works out the new order for
// every document that has to move, and commits everything in ONE atomic
// batch, so the live listeners on the site never see a half-shifted state.

import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

const COLLECTION = "testimonies";

// How many testimonies the home page marquee shows (the rest live on /Testimony)
export const HOME_TESTIMONY_COUNT = 8;

// A Firestore batch holds at most 500 writes
const MAX_BATCH_WRITES = 500;

export interface TestimonyFields {
  name: string;
  role: string;
  quote: string;
  imageUrl: string;
  imagePublicId: string;
}

async function getOrderedDocs() {
  const snap = await getDocs(
    query(collection(db, COLLECTION), orderBy("order", "asc"))
  );
  if (snap.size >= MAX_BATCH_WRITES) {
    throw new Error("Too many testimonies to reorder in a single batch");
  }
  return snap.docs;
}

/**
 * Create (no `id`) or update (with `id`) a testimony and place it at
 * `position` (1 = first). Everything else shifts to make room:
 *
 *   - new at 1, existing 1..5      → new = 1, old ones become 2..6
 *   - move #5 to 2 (of 6)          → #5 = 2, old 2,3,4 become 3,4,5
 *   - move #2 to 5 (of 6)          → #2 = 5, old 3,4,5 become 2,3,4
 *
 * Out-of-range positions are clamped to 1…(count). Any gaps or duplicates
 * left over from older data are cleaned up as a side effect.
 */
export async function saveTestimonyAtPosition({
  id,
  fields,
  position,
}: {
  id?: string;
  fields: TestimonyFields;
  position: number;
}) {
  const existing = await getOrderedDocs();
  const others = existing.filter((d) => d.id !== id);

  const wanted = Math.round(Number(position)) || 1;
  const finalPosition = Math.min(Math.max(1, wanted), others.length + 1);

  const batch = writeBatch(db);

  if (id) {
    batch.update(doc(db, COLLECTION, id), {
      ...fields,
      order: finalPosition,
      updatedAt: serverTimestamp(),
    });
  } else {
    batch.set(doc(collection(db, COLLECTION)), {
      ...fields,
      order: finalPosition,
      createdAt: serverTimestamp(),
    });
  }

  // Everyone else keeps their relative order and skips the slot we just took.
  others.forEach((d, i) => {
    const newOrder = i + 1 < finalPosition ? i + 1 : i + 2;
    if (d.data().order !== newOrder) {
      batch.update(d.ref, { order: newOrder });
    }
  });

  await batch.commit();
  return finalPosition;
}

/** Delete a testimony and pull everything after it up to close the gap. */
export async function removeTestimonyAndCloseGap(id: string) {
  const existing = await getOrderedDocs();
  const batch = writeBatch(db);

  let next = 0;
  existing.forEach((d) => {
    if (d.id === id) {
      batch.delete(d.ref);
      return;
    }
    next += 1;
    if (d.data().order !== next) {
      batch.update(d.ref, { order: next });
    }
  });

  await batch.commit();
}