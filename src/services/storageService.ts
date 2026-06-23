import { ref, uploadBytes, getDownloadURL, listAll, deleteObject } from 'firebase/storage';
import { storage } from './firebase';

async function uploadOne(path: string, uri: string): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
  return await getDownloadURL(storageRef);
}

export async function uploadAvatar(uid: string, uri: string): Promise<string> {
  return uploadOne(`avatars/${uid}/${Date.now()}.jpg`, uri);
}

// Upload many already-optimized photos in parallel under the post's folder.
export async function uploadPostImages(postId: string, uris: string[]): Promise<string[]> {
  return Promise.all(uris.map((uri, i) => uploadOne(`posts/${postId}/${i}.jpg`, uri)));
}

export async function uploadDiscussionImages(discussionId: string, uris: string[]): Promise<string[]> {
  return Promise.all(uris.map((uri, i) => uploadOne(`discussions/${discussionId}/${i}.jpg`, uri)));
}

// Remove every file under a folder (used to clean up a deleted post/discussion's
// images). Best-effort: individual failures are swallowed so deletion never hangs.
export async function deleteStorageFolder(folderPath: string): Promise<void> {
  try {
    const listing = await listAll(ref(storage, folderPath));
    await Promise.all(listing.items.map((item) => deleteObject(item).catch(() => {})));
  } catch {
    // Folder missing or unreadable — nothing to clean up.
  }
}
