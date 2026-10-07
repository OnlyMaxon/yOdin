const { withAndroidManifest } = require('expo/config-plugins');

// WRITE_EXTERNAL_STORAGE has to stay in the manifest for Android 12 and older,
// even though nothing in the app writes to shared storage.
//
// The reason is expo-image-picker: on anything below API 33 it asks for
// WRITE_EXTERNAL_STORAGE unconditionally, without first checking whether the
// permission is declared (see getMediaLibraryPermissions in ImagePickerModule.kt).
// Android denies a request for an undeclared permission instantly, so
// requestMediaLibraryPermissionsAsync() resolves as `denied` and the video
// picker silently refuses to open. expo-media-library guards the same request
// with hasManifestPermission(), which is why photos were unaffected.
//
// Simply un-blocking the permission would declare it for every Android version.
// Capping it at API 32 keeps it off Android 13+, where the system ignores it
// anyway and the granular READ_MEDIA_* permissions took over.
const PERMISSION = 'android.permission.WRITE_EXTERNAL_STORAGE';
const MAX_SDK = '32';

function setScopedWritePermission(manifest) {
  const list = manifest['uses-permission'] ?? [];
  const existing = list.find((p) => p.$?.['android:name'] === PERMISSION);
  const entry = existing ?? { $: {} };

  entry.$['android:name'] = PERMISSION;
  entry.$['android:maxSdkVersion'] = MAX_SDK;
  // Libraries declare this permission unbounded. Without an explicit replace the
  // merger keeps the wider declaration and the cap is silently lost.
  entry.$['tools:node'] = 'replace';

  if (!existing) list.push(entry);
  manifest['uses-permission'] = list;
  return manifest;
}

module.exports = function withLegacyStoragePermission(config) {
  return withAndroidManifest(config, (cfg) => {
    cfg.modResults.manifest = setScopedWritePermission(cfg.modResults.manifest);
    return cfg;
  });
};

module.exports.setScopedWritePermission = setScopedWritePermission;
