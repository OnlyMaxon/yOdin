// The published legal documents, hosted on the studio's own domain (not on a
// contributor's personal GitHub Pages, which is where these used to point). The
// Markdown in docs/ is the source these pages are written from; re-publishing a
// page is enough to update what the app links to — there is nothing to ship in
// an app update. Keep the two copies in sync when either changes.
//
// Play requires the privacy policy and the deletion page as store listing URLs,
// and the terms to be accepted in-app before a user can post anything.
const SITE = 'https://onlymaxon.com/apps/yodin';

export const TERMS_URL = `${SITE}/terms/`;
export const PRIVACY_URL = `${SITE}/privacy/`;
export const DELETE_ACCOUNT_URL = `${SITE}/delete-account/`;

// Which published revision of the terms the signup gate is accepting. Stored
// with each new profile (`User.acceptedTermsVersion`) so we can tell who agreed
// to what. Bump this whenever the published terms change materially — and keep
// it equal to the "Last updated" date on the published page.
export const TERMS_VERSION = '2026-10-04';
