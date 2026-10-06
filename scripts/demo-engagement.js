#!/usr/bin/env node
/**
 * Temporarily put plausible engagement numbers on feed posts so the Play Store
 * screenshots do not show an empty, brand-new app -- then put everything back.
 *
 *   node scripts/demo-engagement.js --seed      # write demo counts, saving a backup
 *   node scripts/demo-engagement.js --restore   # put the original values back
 *   node scripts/demo-engagement.js --status    # show what is currently seeded
 *
 * Runs through the Admin SDK, which bypasses security rules. That is the point:
 * the rules correctly allow one vote per account, and they should stay that way.
 * Nothing in the app or in firestore.rules is modified, so there is no temporary
 * change that could be forgotten and shipped.
 *
 * The backup is written before the first value is touched, and --restore refuses
 * to guess: without the backup file it does nothing.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const KEY = path.join(ROOT, 'serviceAccountKey.json');
const BACKUP = path.join(ROOT, 'demo-engagement-backup.json');

// Fields this script is allowed to touch. Anything else -- feedScore, author,
// content -- is left to the server triggers and to the app.
const FIELDS = ['likes', 'dislikes', 'commentCount'];

// firebase-admin 14 dropped the old `admin.credential.cert` namespace, so the
// modular entry points are required directly.
const { initializeApp, cert } = require(path.join(ROOT, 'node_modules/firebase-admin/lib/app'));
const { getFirestore } = require(path.join(ROOT, 'node_modules/firebase-admin/lib/firestore'));

function die(msg) {
  console.error(`\n  ${msg}\n`);
  process.exit(1);
}

// Deterministic pseudo-random from the document id, so re-running --seed gives
// the same numbers instead of reshuffling the screenshots.
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function pick(id, salt, min, max) {
  return min + (hash(id + salt) % (max - min + 1));
}

// Fake uids, never real ones. They only need to make the arrays the right
// length: the app shows likes.length, and compares the signed-in uid against
// the array to decide whether the heart is filled -- a demo id never matches,
// so the screenshots show posts the viewer has not voted on.
function fakeUids(id, salt, n) {
  return Array.from({ length: n }, (_, i) => `demo_${hash(id + salt + i).toString(36)}`);
}

async function main() {
  const mode = process.argv[2];
  if (!['--seed', '--restore', '--status'].includes(mode)) {
    die('Usage: node scripts/demo-engagement.js --seed | --restore | --status');
  }
  if (!fs.existsSync(KEY)) die(`serviceAccountKey.json not found at ${KEY}`);

  initializeApp({ credential: cert(require(KEY)) });
  const db = getFirestore();

  const snap = await db.collection('posts').get();
  if (snap.empty) die('No posts in Firestore -- create a few first, then seed.');

  if (mode === '--status') {
    const seeded = fs.existsSync(BACKUP);
    console.log(`\n  posts: ${snap.size}`);
    console.log(`  backup: ${seeded ? BACKUP : 'none -- nothing is seeded'}\n`);
    snap.forEach((d) => {
      const v = d.data();
      console.log(
        `  ${d.id}  likes=${(v.likes || []).length}` +
          `  dislikes=${(v.dislikes || []).length}` +
          `  comments=${v.commentCount || 0}`,
      );
    });
    console.log();
    return;
  }

  if (mode === '--restore') {
    if (!fs.existsSync(BACKUP)) {
      die('No backup file -- nothing to restore. (Did --seed ever run?)');
    }
    const saved = JSON.parse(fs.readFileSync(BACKUP, 'utf8'));
    const batch = db.batch();
    let n = 0;
    for (const [id, original] of Object.entries(saved)) {
      const ref = db.collection('posts').doc(id);
      // Restore exactly what was there, including fields that were absent.
      const update = {};
      for (const f of FIELDS) {
        update[f] = original[f] === undefined ? null : original[f];
      }
      batch.set(ref, update, { merge: true });
      n++;
    }
    await batch.commit();
    fs.unlinkSync(BACKUP);
    console.log(`\n  restored ${n} posts, removed the backup file.`);
    console.log('  Note: fields that did not exist before are now explicitly null.\n');
    return;
  }

  // --seed
  if (fs.existsSync(BACKUP)) {
    die(`Already seeded (${BACKUP} exists). Run --restore first.`);
  }

  const backup = {};
  snap.forEach((d) => {
    const v = d.data();
    backup[d.id] = { likes: v.likes, dislikes: v.dislikes, commentCount: v.commentCount };
  });
  // Write the backup to disk BEFORE touching anything.
  fs.writeFileSync(BACKUP, JSON.stringify(backup, null, 2), 'utf8');

  const batch = db.batch();
  snap.forEach((d) => {
    const likes = pick(d.id, 'l', 4, 47);
    const dislikes = pick(d.id, 'd', 0, 3);
    const comments = pick(d.id, 'c', 0, 11);
    batch.update(d.ref, {
      likes: fakeUids(d.id, 'l', likes),
      dislikes: fakeUids(d.id, 'd', dislikes),
      commentCount: comments,
    });
  });
  await batch.commit();

  console.log(`\n  seeded ${snap.size} posts. Backup: ${BACKUP}`);
  console.log('  Take the screenshots, then run --restore.\n');
  console.log('  Heads up: commentCount is a counter, so a post will advertise');
  console.log('  comments it does not have. Screenshot the feed, not a post\'s');
  console.log('  comment list -- or ask for real demo comments instead.\n');
}

main().catch((e) => die(e.stack || String(e)));
