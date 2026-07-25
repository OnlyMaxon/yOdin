import {
  collection,
  addDoc,
  doc,
  deleteDoc,
  updateDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { Report, ReportStatus, ReportTargetType } from '../types';
import { deletePost } from './postService';
import { deleteDiscussion } from './discussionService';

// Anyone signed in can file a report against a post, forum question, comment or
// reply. `targetPath` is the target's full document path (needed to remove a
// nested comment/reply later).
export async function createReport(data: {
  targetType: ReportTargetType;
  targetId: string;
  targetPath?: string;
  targetTitle: string;
  targetAuthorId: string;
  reportedBy: string;
  reason: string;
}): Promise<void> {
  await addDoc(collection(db, 'reports'), {
    ...data,
    status: 'pending' as ReportStatus,
    createdAt: serverTimestamp(),
  });
}

// Moderator removal: delete the reported content. Posts/discussions go through
// their own service (which also cleans up storage); nested comments/replies are
// deleted by path. The accompanying strike/notification is handled server-side
// by the onReportUpdated Cloud Function once the report is marked 'removed'.
export async function removeReportedContent(report: Report): Promise<void> {
  if (report.targetType === 'post') {
    await deletePost(report.targetId, report.targetAuthorId);
  } else if (report.targetType === 'discussion') {
    await deleteDiscussion(report.targetId, report.targetAuthorId);
  } else if (report.targetPath) {
    await deleteDoc(doc(db, report.targetPath));
  }
}

// Live stream of all reports (newest first). Readable only by moderators —
// the security rules reject this listener for everyone else.
export function subscribeReports(onChange: (reports: Report[]) => void): () => void {
  const q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Report))),
    () => {
      // Silent: a transient/permission listener error shouldn't crash the shell.
    },
  );
}

// Moderator decision: 'removed' (target deleted) or 'kept' (left in place).
export async function resolveReport(reportId: string, status: ReportStatus): Promise<void> {
  await updateDoc(doc(db, 'reports', reportId), { status });
}
