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
// to what.
//
// Bump only on a **material** change — one that alters what a user is agreeing
// to — because bumping means shipping a new build and, eventually, re-asking
// existing users. Clarifications and added cross-references do not count: the
// page's "Last updated" date moves, this constant does not. It last moved for
// the 2026-10-04 revision (operator, jurisdiction, 18+ minimum age); the
// 2026-10-05 edit only spelled out the existing CSAE prohibition and linked the
// Child Safety Standards, so it stayed put.
export const TERMS_VERSION = '2026-10-04';
