/**
 * One-time migration: writes feedScore to all existing posts and discussions.
 *
 * Run from the functions/ directory (so firebase-admin is available):
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

async function batchUpdate(
  docs: QueryDocumentSnapshot[],
  getScore: (data: FirebaseFirestore.DocumentData) => number,
): Promise<void> {
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    docs.slice(i, i + BATCH_SIZE).forEach((d) => {
      batch.update(d.ref, { feedScore: getScore(d.data()) });
    });
    await batch.commit();
    console.log(`  ${Math.min(i + BATCH_SIZE, docs.length)} / ${docs.length}`);
  }
}

async function main() {
  console.log('── discussions ──');
  const discussions = await db.collection('discussions').get();
  console.log(`Found ${discussions.size} documents`);
  await batchUpdate(discussions.docs, (d) => (d.replyCount ?? 0) * 2);

  console.log('── posts ──');
  const posts = await db.collection('posts').get();
  console.log(`Found ${posts.size} documents`);
  await batchUpdate(posts.docs, (d) => (d.likes?.length ?? 0) * 3 + (d.commentCount ?? 0) * 2);

  console.log('Done ✓');
}

main().catch((err) => { console.error(err); process.exit(1); });
