# App Store Connect — submission answers for yOdin (iOS)

Apple-side companion to `docs/play-store-listing.md`. Everything below is either
verified against the code or copied from the Play answers where Apple asks the
same question. Build **1.1.0 (7)** is the one to submit — device-verified:
Apple sign-in, Microsoft sign-in, camera, and account deletion on all three
account types.

## App Review Information

**Contact:** Jalil Orujli · hello@onlymaxon.com

**Demo account** — the reviewer cannot use the app without one, and the Firestore
rules reject every write from an unverified address, so the demo email **must be
confirmed** before submitting. An unverified demo account reads as a broken app.

```
Email:    <demo@…>        (verified)
Password: <…>
```

**Notes for the reviewer** (paste as-is; 1.2 and 5.1.1(v) are what a Social app
gets checked against):

> yOdin is a community app for people living abroad: posts, Q&A discussions,
> comments and events, scoped to a nationality the user picks.
>
> Moderation of user-generated content (guideline 1.2):
> • Reporting — every post, discussion, comment and reply has a Report action
>   (reason + optional detail) available to any signed-in user.
> • Review — reports land in a moderator queue; moderators are granted by a
>   server-side Firebase custom claim, which the security rules verify, and can
>   remove content and apply escalating restrictions up to a ban.
> • Blocking — any user can block another; blocked users cannot interact, and
>   the block is enforced in the security rules, not only in the UI.
> • Terms — the community rules prohibit objectionable content, and accepting
>   them is a gate on sign-up (the accepted revision is recorded per account).
> • Contact — hello@onlymaxon.com, published in-app and on the listing.
>
> Account deletion (5.1.1(v)) — Profile ▸ Delete account. It re-proves the
> session first (password, Sign in with Apple, or Microsoft, matching how the
> account was created), then a server function erases the account, its content
> and its media, and revokes the Apple refresh token. There is also a web path:
> https://onlymaxon.com/apps/yodin/delete-account/
>
> Sign in with Apple (4.8) is offered alongside Microsoft sign-in and email.
>
> Minimum age is 18; the app is not directed at children.

## App Privacy (nutrition labels)

Same substance as the Play Data safety table — Apple's wording differs.

Collected and **linked to the user**, all for **App Functionality** only (no
tracking, no third-party sharing, no advertising identifier):

| Apple category | Item |
|---|---|
| Contact Info | Name, Email Address |
| Identifiers | User ID |
| User Content | Photos or Videos, Other User Content (posts, comments, bio, nationality, languages, country) |

- Used for tracking: **No**
- Data linked to the user: **Yes** (the items above)
- Data not linked to the user: **none**
- Not collected: location, financial info, health, contacts, browsing history,
  search history, diagnostics, usage data, advertising data.

## Age rating

- Unrestricted web access: **No**
- User-generated content: **Yes** — with reporting, blocking and moderation
- No violence, sexual content, profanity, drugs, gambling, or horror themes
- Expected rating: **17+** (the UGC answers drive this); the terms and privacy
  policy both state an 18 minimum, so do not declare anything lower.

## Export compliance

Uses only standard HTTPS/TLS → exempt. Answer **Yes** to "uses encryption", then
**Yes** to the exemption for standard encryption.

## Listing copy

Reuse the English description, subtitle and keywords from
`docs/play-store-listing.md` — they were already corrected against what the code
actually does.

## Screenshots

Required: **6.7"** iPhone (1290×2796). Suggested set — Feed, Discussion detail,
New post, Notifications, Profile.
