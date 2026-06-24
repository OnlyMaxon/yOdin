/**
 * One-time migration: recalculates feedScore for all posts and discussions
 * using the hotScore algorithm (matches onPostUpdated / onDiscussionUpdated).
 * Also backfills the `engagement` field on discussions that predate it.
 *
 * Run from the functions/ directory:
 *   cd functions
 *   GOOGLE_APPLICATION_CREDENTIALS=../serviceAccount.json npx ts-node src/migrate-feed-score.ts
 *
 * Get serviceAccount.json from Firebase console → Project Settings → Service accounts → Generate key.
 * Delete the key file after running the migration.
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, QueryDocumentSnapshot } from 'firebase-admin/firestore';
import * as path from 'path';

const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  ?? path.join(__dirname, '../../serviceAccount.json');

initializeApp({ credential: cert(credPath) });
const db = getFirestore();

const BATCH_SIZE = 400;
const EPOCH_S = 1_700_000_000;

function hotScore(engagement: number, createdAtMs: number): number {
  const order = Math.log10(Math.max(engagement, 0) + 1);
  const seconds = createdAtMs / 1000 - EPOCH_S;
  return Number((order + seconds / 45000).toFixed(7));
}

function createdMs(data: FirebaseFirestore.DocumentData): number {
  return data.createdAt?.toMillis?.() ?? Date.now();
}

async function batchUpdate(
  docs: QueryDocumentSnapshot[],
  getFields: (data: FirebaseFirestore.DocumentData) => Record<string, unknown>,
): Promise<void> {
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    docs.slice(i, i + BATCH_SIZE).forEach((d) => {
      batch.update(d.ref, getFields(d.data()));
    });
    await batch.commit();
    console.log(`  ${Math.min(i + BATCH_SIZE, docs.length)} / ${docs.length}`);
  }
}

async function main() {
  console.log('── discussions ──');
  const discussions = await db.collection('discussions').get();
  console.log(`Found ${discussions.size} documents`);
  await batchUpdate(discussions.docs, (d) => {
    const replyCount = d.replyCount ?? 0;
    const engagement = d.engagement ?? replyCount;
    return {
      feedScore: hotScore(replyCount * 2, createdMs(d)),
      engagement,
    };
  });

  console.log('── posts ──');
  const posts = await db.collection('posts').get();
  console.log(`Found ${posts.size} documents`);
  await batchUpdate(posts.docs, (d) => ({
    feedScore: hotScore(
      (d.likes?.length ?? 0) * 3 + (d.commentCount ?? 0) * 2,
      createdMs(d),
    ),
  }));

  console.log('Done ✓');
}

main().catch((err) => { console.error(err); process.exit(1); });
