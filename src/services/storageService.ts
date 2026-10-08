import { ref, uploadBytes, getDownloadURL, listAll, deleteObject } from 'firebase/storage';
import { storage } from './firebase';

// Read a local file into a React Native Blob.
//
// This is deliberately XMLHttpRequest and not `fetch`. React Native's own fetch
// is the whatwg-fetch polyfill sitting on top of XHR, so this is the exact
// mechanism `fetch(uri).blob()` used — but from SDK 56 on, `expo/fetch` takes
// over `globalThis.fetch` and its `blob()` throws on every call on a device
// (expo/expo#47468). XMLHttpRequest stays React Native's own, so going one
// layer down survives that change.
//
// The blob has to be a native, file-backed one. Firebase builds its multipart
// body with `new Blob([header, data, footer])`, and RN's BlobManager accepts
// string and Blob parts while rejecting ArrayBuffer and typed arrays outright
// ("Creating blobs from 'ArrayBuffer' and 'ArrayBufferView' are not supported").
// That rules out handing Firebase a Uint8Array: `uploadBytes` throws, and
// `uploadBytesResumable` is worse — it only takes the resumable path above
// 256 KB, so an optimized photo silently falls back to the same multipart code
// and the exception lands inside a promise callback that never settles, hanging
// the upload instead of failing it.
//
// Being file-backed also means a 20 MB video never lands in the JS heap.
function blobFromUri(uri: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => resolve(xhr.response as Blob);
    xhr.onerror = () => reject(new Error(`Failed to read ${uri}`));
    xhr.responseType = 'blob';
    xhr.open('GET', uri, true);
    xhr.send(null);
  });
}

// Every upload in the app funnels through here: avatars, post and discussion
// photos, and video with its poster.
async function uploadOne(path: string, uri: string, contentType = 'image/jpeg'): Promise<string> {
  const blob = await blobFromUri(uri);
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
