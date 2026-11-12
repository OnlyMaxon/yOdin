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

### The 12 November 2026 rejection

Build 7 came back on two guidelines. Both are answered in the code and in the
listing; what is left is a screen recording, which only a physical device can
produce.

**2.3.7 — price in metadata.** The third screenshot read *"Free. No ads, no
tracking, no location."* Apple counts "free" as a price reference and does not
allow it in screenshots, only in the description. The panel copy in
`scripts/make-appstore-screenshots.py` now describes what the screen does, and
the uploaded assets were replaced rather than added to.

**1.2 — user-generated content.** The terms existed and the gate existed, but
not where a reviewer meets them: the checkbox rendered only in register mode,
and the clickwrap line sat below the provider buttons naming Microsoft alone.
Signing in with the demo account, or with Apple, showed no agreement at all.
Three things changed — the notice is provider-neutral and renders above every
way in (welcome screen and both modes of the auth screen), both it and the
checkbox now say in so many words that objectionable content and abusive users
are not tolerated, and the published terms carry the zero-tolerance rule in
their opening section and again above the prohibited-content table.

Apple also asked for a screen recording, captured on a physical device, showing
the terms before sign-in, the report action, and the block action. Attach it to
the reply in App Store Connect and keep the link in these notes for later
submissions.

**Notes for the reviewer** (mirrors what the ASC `appStoreReviewDetails.notes`
field holds; 1.2 and 5.1.1(v) are what a Social app gets checked against):

> yOdin is a community app for people living abroad: posts, Q&A discussions,
> comments and events, scoped to a nationality the user picks.
>
> WHAT CHANGED IN THIS BUILD (answering the 12 Nov 2026 rejection)
>
> Guideline 1.2 — terms of use. The agreement is now shown before every way
> into the app, not only while registering:
> • Launch screen, under "Create Account" / "Log In" — the zero-tolerance
>   notice, with both documents as tappable links.
> • Sign-up and sign-in screen — the same statement in a bordered card above
>   the Continue button and above the Sign in with Apple / Microsoft buttons.
>   While registering the card also carries the acceptance checkbox, and
>   Continue stays disabled until it is ticked. The accepted revision is stored
>   on the account.
> • The published terms state the rule in their opening section and again above
>   the list of prohibited content.
>
> Guideline 2.3.7 — the screenshot that mentioned price has been replaced.
>
> WHERE TO SEE EACH MECHANISM
> 1. Terms before sign-in — cold-launch the app; the notice is on the first
>    screen, below the two buttons, and again above every sign-in control.
> 2. Report content — Feed ▸ any post ▸ the flag icon under the post. Ten
>    reasons plus an optional description. The same flag is on discussions,
>    comments and replies.
> 3. Block a user — tap an author's name or avatar ▸ the block icon beside
>    their name ▸ confirm. Enforced in the Firestore rules, not only in the UI.
>    Profile ▸ Blocked accounts lists and unblocks them.
>
> Moderation — reports land in a moderator queue; moderators are granted by a
> server-side Firebase custom claim, which the security rules verify, and can
> remove content and apply escalating restrictions up to a permanent ban.
> Contact for reports and appeals: hello@onlymaxon.com.
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
