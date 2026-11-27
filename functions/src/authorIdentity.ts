import { getFirestore } from 'firebase-admin/firestore';
import { DELETED_ID } from './accountDeletion';

// ── Author identity on content ───────────────────────────────────────────────
// Every post, discussion, comment and reply carries a copy of its author's
// name, photo and nationality so a feed can render a card without reading the
// profile. The client fills those in, and the Firestore rules only check that
// `authorId` is the caller — so a hand-rolled write can publish as "yOdin
// Official" with any avatar, or file content under a nationality the author
// does not have, which also pollutes the country filter.
//
// The rules deliberately do *not* fix this. Comparing the copy against the
// profile would reject honest content whenever the client's cached profile is
// stale: the profile lives in a plain zustand store with no snapshot listener
// (`src/store/useAuthStore.ts`), updated locally after an edit, so a second
// device keeps the old name until the app restarts. That rejection surfaces as
// permission-denied, which `errorHandler` flattens to "something went wrong" —
// an error the user cannot act on, for content that was perfectly legitimate.
//
// Correcting it here inverts both halves: an honest write is never refused, a
// forged one is overwritten within a second of landing, and a stale client
// heals itself. The same reasoning covers `fromUserName` on notifications,
// which is the more convincing phishing surface of the two — a notice that
// appears to come from "yOdin Support" sits in the same list as real ones.
//
// Getter, not a module constant: index.ts calls initializeApp() in its body,
// and imports this module above that line.
const db = () => getFirestore();

export type Identity = {
  authorName: string;
  authorPhoto: string;
  authorNationality: string;
  authorCountryCode: string;
};

export function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

// The single definition of what the author fields on a document should contain.
// Both the create-time stamp and the profile sweep derive from this one
// function: two copies of the formula would drift, and a drift here means
// honest content being rewritten on every write forever.
export function identityFrom(profile: FirebaseFirestore.DocumentData): Identity {
  return {
    // Byte-for-byte how every client builds it (`${firstName} ${lastName}`, see
    // NewPostModal / NewDiscussionModal / PostDetailModal /
    // DiscussionDetailScreen), so honest content produces no diff at all and
    // therefore costs no second write.
    authorName: `${str(profile.firstName)} ${str(profile.lastName)}`,
    authorPhoto: str(profile.photoURL),
    authorNationality: str(profile.nationality),
    authorCountryCode: str(profile.countryCode),
  };
}

// The profile fields `identityFrom` reads. The sweep watches exactly these, so
// adding a field above without adding it here would leave old content stale.
// `location` is deliberately absent: a post's location is where it was posted,
// not where its author lives now.
export const IDENTITY_FIELDS = [
  'firstName',
  'lastName',
  'photoURL',
  'nationality',
  'countryCode',
] as const;

// `null` means there is nothing to correct against, and the document must be
// left exactly as written: content anonymised by account deletion, the
// 'system' sender on moderation notices, or an author whose profile is gone.
export async function identityOf(authorId: unknown): Promise<Identity | null> {
  if (typeof authorId !== 'string' || !authorId || authorId === DELETED_ID) return null;
  const snap = await db().doc(`users/${authorId}`).get();
  const profile = snap.data();
  if (!profile) return null;
  return identityFrom(profile);
}

// Only the fields that actually disagree. An empty result means the write was
// honest and nothing is touched — which is the common case by far.
export function corrections(
  data: FirebaseFirestore.DocumentData,
  truth: Identity,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(truth)) {
    if (str(data[key]) !== value) out[key] = value;
  }
  return out;
}
