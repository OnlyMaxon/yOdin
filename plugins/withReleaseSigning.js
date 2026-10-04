const { withAppBuildGradle } = require('expo/config-plugins');

// Expo regenerates android/ on every prebuild, so the release signing config
// can't just be hand-edited into app/build.gradle -- it would be wiped. This
// plugin re-applies it each time.
//
// The keystore itself and its passwords live outside the repo, in
// ~/.gradle/gradle.properties:
//
//   YODIN_UPLOAD_STORE_FILE=/Users/you/keystores/yodin-upload.jks
//   YODIN_UPLOAD_KEY_ALIAS=yodin-upload
//   YODIN_UPLOAD_STORE_PASSWORD=...
//   YODIN_UPLOAD_KEY_PASSWORD=...
//
// On a machine without those properties the build still works and falls back to
// the debug key, so a fresh clone isn't broken -- it just can't produce an
// upload-signable artifact.

const SIGNING_CONFIG = `
        release {
            if (project.hasProperty('YODIN_UPLOAD_STORE_FILE')) {
                storeFile file(YODIN_UPLOAD_STORE_FILE)
                storePassword YODIN_UPLOAD_STORE_PASSWORD
                keyAlias YODIN_UPLOAD_KEY_ALIAS
                keyPassword YODIN_UPLOAD_KEY_PASSWORD
            }
        }`;

const RELEASE_SIGNING_REF =
  "signingConfig project.hasProperty('YODIN_UPLOAD_STORE_FILE') ? signingConfigs.release : signingConfigs.debug";

function addReleaseSigningConfig(contents) {
  // Check for our own marker rather than for a `release {` block: a lazy match
  // from `signingConfigs {` reaches the release *build type* further down the
  // file and would report a false positive.
  if (contents.includes('storeFile file(YODIN_UPLOAD_STORE_FILE)')) {
    return contents; // already present
  }
  const anchor = /(signingConfigs\s*\{)/;
  if (!anchor.test(contents)) {
    throw new Error(
      '[withReleaseSigning] no signingConfigs block found in app/build.gradle'
    );
  }
  return contents.replace(anchor, `$1${SIGNING_CONFIG}`);
}

function pointReleaseBuildTypeAtIt(contents) {
  if (contents.includes(RELEASE_SIGNING_REF)) {
    return contents; // already pointed
  }
  // Match the signingConfig line inside buildTypes.release specifically -- the
  // debug build type above it has an identical line.
  const target =
    /(buildTypes\s*\{[\s\S]*?\brelease\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/;
  if (!target.test(contents)) {
    throw new Error(
      '[withReleaseSigning] could not find the release build type signingConfig to replace'
    );
  }
  return contents.replace(target, `$1${RELEASE_SIGNING_REF}`);
}

module.exports = withReleaseSigning;
module.exports.addReleaseSigningConfig = addReleaseSigningConfig;
module.exports.pointReleaseBuildTypeAtIt = pointReleaseBuildTypeAtIt;

function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      throw new Error(
        '[withReleaseSigning] expected app/build.gradle to be Groovy, got ' +
          cfg.modResults.language
      );
    }
    let contents = cfg.modResults.contents;
    contents = addReleaseSigningConfig(contents);
    contents = pointReleaseBuildTypeAtIt(contents);
    cfg.modResults.contents = contents;
    return cfg;
  });
};
