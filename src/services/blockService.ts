import { collection, doc, getDocs, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

// ── Blocking ─────────────────────────────────────────────────────────────────
// `users/{me}/blocked/{them}` is mine to write and mine alone to read — nobody
// gets to see who someone blocked. A Cloud Function mirrors each block into
// `users/{them}/blockedBy/{me}`, which is the only way their app can know to
// hide my content: it cannot read my list.
//
// So hiding needs both halves, while the block button only ever touches the
// first. The server also refuses replies, comments and mentions between the
// two, so this is a filter on top of enforcement, not the enforcement itself.

export async function blockUser(myUid: string, targetUid: string): Promise<void> {
  await setDoc(doc(db, 'users', myUid, 'blocked', targetUid), { createdAt: serverTimestamp() });
}

export async function unblockUser(myUid: string, targetUid: string): Promise<void> {
  await deleteDoc(doc(db, 'users', myUid, 'blocked', targetUid));
}

export interface BlockLists {
  /** People I blocked — the only ones I can unblock. */
  blocked: string[];
  /** People who blocked me. Hidden from me as well, but not mine to lift. */
  blockedBy: string[];
}

export async function fetchBlockLists(myUid: string): Promise<BlockLists> {
  const [blocked, blockedBy] = await Promise.all([
    getDocs(collection(db, 'users', myUid, 'blocked')),
    getDocs(collection(db, 'users', myUid, 'blockedBy')),
  ]);
  return {
    blocked: blocked.docs.map((d) => d.id),
    blockedBy: blockedBy.docs.map((d) => d.id),
  };
}
