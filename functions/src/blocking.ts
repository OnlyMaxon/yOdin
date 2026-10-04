import { onDocumentCreated, onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// ── Blocking ─────────────────────────────────────────────────────────────────
// A block is stored as users/{blocker}/blocked/{blocked}, private to the blocker
// so nobody can enumerate who someone has blocked. That privacy creates a
// problem: the blocked person's app cannot read that list, so it has no way to
// hide the blocker's content from them. These triggers mirror the edge into
// users/{blocked}/blockedBy/{blocker} — readable only by that person — so each
// side filters using its own half.
//
// Firestore rules stop the blocked person from replying, commenting or
// mentioning; the mirror is what makes them stop seeing each other.

// index.ts sets the global region in its body and imports this module at the
// top, so definitions here run before that call lands. Pinned explicitly.
const REGION = 'europe-west1';

const db = () => getFirestore();

export const onBlockCreated = onDocumentCreated(
  { region: REGION, document: 'users/{blockerId}/blocked/{blockedId}' },
  async (event) => {
    const { blockerId, blockedId } = event.params;
    if (blockerId === blockedId) return;

    await db().doc(`users/${blockedId}/blockedBy/${blockerId}`).set({
      createdAt: FieldValue.serverTimestamp(),
    });

    // Blocking implies the follow is over. A client can't do this half: the
    // follow list lives on the follower's own document, which only they may
    // write, so the blocked person would otherwise keep following.
    await Promise.all([
      db().doc(`users/${blockerId}`).update({ following: FieldValue.arrayRemove(blockedId) }),
      db().doc(`users/${blockedId}`).update({ following: FieldValue.arrayRemove(blockerId) }),
    ].map((p) => p.catch(() => {})));
  },
);

export const onBlockDeleted = onDocumentDeleted(
  { region: REGION, document: 'users/{blockerId}/blocked/{blockedId}' },
  async (event) => {
    const { blockerId, blockedId } = event.params;
    // Unblocking only restores visibility; the follows stay broken, which is
    // what someone would expect after having blocked a person.
    await db().doc(`users/${blockedId}/blockedBy/${blockerId}`).delete().catch(() => {});
  },
);
