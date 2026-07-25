import { ref, uploadBytes, getDownloadURL, listAll, deleteObject } from 'firebase/storage';
import { storage } from './firebase';

async function uploadOne(path: string, uri: string, contentType = 'image/jpeg'): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob, { contentType });
  return await getDownloadURL(storageRef);
}

export async function uploadAvatar(uid: string, uri: string): Promise<string> {
  return uploadOne(`avatars/${uid}/${Date.now()}.jpg`, uri);
}

// Post/discussion media is stored under the author's own uid folder
// (posts/{uid}/{postId}/…) so the Storage rules can restrict writes to the
// owner — nobody else can overwrite or plant files in someone's post.

// Upload many already-optimized photos in parallel under the author's post folder.
export async function uploadPostImages(uid: string, postId: string, uris: string[]): Promise<string[]> {
  return Promise.all(uris.map((uri, i) => uploadOne(`posts/${uid}/${postId}/${i}.jpg`, uri)));
}

export async function uploadDiscussionImages(uid: string, discussionId: string, uris: string[]): Promise<string[]> {
  return Promise.all(uris.map((uri, i) => uploadOne(`discussions/${uid}/${discussionId}/${i}.jpg`, uri)));
}

// Upload a post's video plus its poster still. The poster is a tiny JPEG used
// in the feed so the (larger) video is only downloaded when the user taps play.
export async function uploadPostVideo(
  uid: string,
  postId: string,
  videoUri: string,
  posterUri: string,
): Promise<{ videoURL: string; videoPoster: string }> {
  const [videoURL, videoPoster] = await Promise.all([
    uploadOne(`posts/${uid}/${postId}/video.mp4`, videoUri, 'video/mp4'),
    posterUri ? uploadOne(`posts/${uid}/${postId}/poster.jpg`, posterUri) : Promise.resolve(''),
  ]);
  return { videoURL, videoPoster };
}

export async function uploadDiscussionVideo(
  uid: string,
  discussionId: string,
  videoUri: string,
  posterUri: string,
): Promise<{ videoURL: string; videoPoster: string }> {
  const [videoURL, videoPoster] = await Promise.all([
    uploadOne(`discussions/${uid}/${discussionId}/video.mp4`, videoUri, 'video/mp4'),
    posterUri ? uploadOne(`discussions/${uid}/${discussionId}/poster.jpg`, posterUri) : Promise.resolve(''),
  ]);
  return { videoURL, videoPoster };
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
