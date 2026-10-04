---
layout: default
title: Privacy Policy — yOdin
permalink: /privacy-policy/
---

# Privacy Policy for yOdin

**Last updated:** 20 September 2026
**Effective date:** 20 September 2026

yOdin ("the App", "we", "us") is operated by **Jalil Orujli**, Chmielna 69,
Warsaw, Poland. This policy explains what personal data the App collects, why,
and what rights you have. Contact us any time at **hello@onlymaxon.com**.

By creating an account you agree to this policy and to the
[terms of use](/yOdin/terms-of-use/), which set out the community rules and what
happens when they are broken. If you do not agree, please do not use the App.

---

## 1. Who this policy covers

This policy applies to the yOdin mobile application (Android package
`app.yodin`) and the backend services it talks to. It does not cover
third-party websites that other users may link to from their posts.

---

## 2. What we collect

### 2.1 Information you give us

**Account data**, collected when you register:

| Data | Required | Why |
|---|---|---|
| Email address | Yes | Sign-in, email verification, account recovery, service notices |
| Password | Yes | Authentication. Stored only by Google Firebase Authentication — we never see or store your password ourselves |
| First and last name | Yes | Displayed on your profile and next to your content |
| Username (@handle) | Yes | Unique identifier so other users can mention you |
| Nationality and country of residence | Yes | Community filtering — lets users find people and content from their community. Both are picked from a fixed list of countries; the App has no field for a city or street address |
| Profile photo | No | Shown on your profile |
| Bio | No | Short description shown on your profile |
| Languages you speak | No | Helps match you with relevant discussions |

**Content data**, collected when you use the App: posts, discussions, comments,
replies, event participation (RSVP), the photos and videos you attach, and the
reports you file about other users' content.

**Social data**: the accounts you follow, the reputation points you earn, and
the accounts you block. Your block list is private — it is readable only by you,
and never by the people on it.

### 2.2 Information generated automatically

- **Moderation records** — if your content is removed following a report, we
  record the number of removals and bans on your account. This drives the
  escalating restriction system described in section 6.
- **Timestamps** — when your account and each piece of content were created.

### 2.3 What we do NOT collect

We want to be explicit about this, because many social apps do collect it:

- **No GPS or location of any kind.** The nationality and country on your
  profile are values you pick from a list yourself. The App never reads your
  device location, and asks for no location permission.
- **No analytics or behavioural tracking.** There is no analytics SDK in the App.
- **No advertising identifiers, no ad networks, no third-party trackers.**
- **No push notification tokens.** Notifications are shown inside the App only.
- **No contacts, calendar, microphone, or call data.**

---

## 3. Device permissions

| Permission | When it is asked | What we do with it |
|---|---|---|
| Photos / media library | Only when you attach media to a post or discussion, or set a profile photo | The files you pick are uploaded as your content. We do not scan or index your library |
| Camera | Only when you choose to take a photo instead of picking an existing one | The photo you take is uploaded as your content. The App does not record video or audio, and does not access the camera in the background |

You can revoke either permission in Android settings at any time; the App
remains usable without them, minus the ability to attach media.

---

## 4. Why we process your data, and on what legal basis

| Purpose | Legal basis (GDPR Art. 6) |
|---|---|
| Creating and running your account | Performance of a contract |
| Displaying your content and profile to other users | Performance of a contract |
| Verifying your email address | Performance of a contract |
| Moderating content, handling reports, enforcing bans | Legitimate interest in a safe community |
| Letting you block other accounts | Legitimate interest in your safety |
| Preventing a banned account from immediately returning under a new registration | Legitimate interest in preventing abuse |
| Responding to your support requests | Legitimate interest |
| Complying with lawful requests from authorities | Legal obligation |

We do not sell your personal data, and we do not use it for advertising or for
building a profile of you.

### Decisions made automatically

Two restrictions are applied by software rather than by a person, so we would
rather spell them out than hide behind a blanket denial:

- **Comment bans.** A moderator decides every content removal; the count of
  removals is then kept automatically, and each fifth confirmed removal triggers
  a temporary ban on commenting that lengthens with repetition (3 → 7 → 30
  days). The judgement is human; only the arithmetic and the timer are not.
- **Blocked re-registration.** If an account with moderation history is deleted,
  a one-way hash of its email address is kept for a year, and a matching signup
  is undone automatically.

Neither decision has legal effects, and both are reversible. If you believe one
was applied wrongly, write to **hello@onlymaxon.com** and a person will look at
it.

---

## 5. Who your data is shared with

### 5.1 Other users

Your name, username, profile photo, bio, nationality, country, languages,
points, and everything you post are **visible to other users of the App**. Treat
anything you post as public. Your email address is never shown to other users,
and neither is the list of accounts you have blocked.

### 5.2 Service providers

| Provider | What they process | Purpose |
|---|---|---|
| **Google Firebase** (Authentication, Cloud Firestore, Cloud Storage, Cloud Functions) — Google Ireland Ltd. / Google LLC | Account data, content, media | Hosting the App's database, files, authentication and server logic |
| **Algolia** | Public content of discussions and the author's display name | Search inside the App |

These providers act as processors on our instructions and are bound by their own
data-protection terms. We do not share your data with anyone else, except where
section 4 requires it by law.

### 5.3 International transfers

Firebase and Algolia may process data on servers outside your country, including
in the European Union and the United States. Such transfers rely on the
Standard Contractual Clauses approved by the European Commission.

---

## 6. Moderation and enforcement

The App relies on user reports. When content is reported, a moderator reviews it
and either keeps or removes it. Removals accumulate on the author's account and
lead to temporary restrictions on commenting, which lengthen with each repeat
offence. We keep these records for as long as the account exists, because
discarding them would reset a repeat offender's history.

Reports are not anonymous to us: we store which account filed each report, so
that we can act on abuse of the reporting system itself. Reporters are never
disclosed to the reported user, but they are visible to moderators, who are
trusted community members rather than only us. Moderators can see reported
content, including content that is otherwise hard to reach, and nothing else
about your account.

### Blocking

You can block another account. Blocking is not only a filter on what you see:
the blocked account cannot reply in your discussions, comment on your posts, or
reach you with a mention, and the two of you stop following each other.

Your block list is private — it is stored so that only you can read it, and it
is never shown to anyone, including the people on it. One consequence is
unavoidable and worth stating: for their app to stop showing them your content,
their device has to learn that a block exists, so a blocked person can work out
that you blocked them.

---

## 7. How long we keep data

| Data | Retention |
|---|---|
| Account and profile | Until you delete your account |
| Your own posts and discussions, and their media | Until you delete them, or your account |
| Replies and comments you left under other people's content | Kept after account deletion, with every author field removed so they no longer identify you |
| Your @handle | Reserved indefinitely after deletion, so nobody can take it over and inherit mentions of you |
| Block lists | Until you remove the block, or delete your account |
| Moderation records (strikes, bans) | For the life of the account |
| A one-way keyed hash of the email address of an account that had moderation strikes or bans | 12 months after deletion, to prevent immediate re-registration. It cannot be reversed into an email address, and accounts with a clean record leave no such record |
| Reports | 12 months after resolution |
| Backups | Up to 30 days after deletion from the live database |

---

## 8. Your rights

Depending on where you live, you have the right to:

- **Access** the personal data we hold about you
- **Correct** inaccurate data — most of it is editable in the App under Profile
- **Delete** your account and personal data
- **Object to or restrict** processing based on legitimate interest
- **Port** your data to another service in a machine-readable format
- **Withdraw consent** where processing is based on consent
- **Complain** to your national data-protection authority

To exercise any of these, write to **hello@onlymaxon.com**. We respond within 30
days.

### Deleting your account

You can delete your account from within the App: **Profile → Settings → Delete
account**. You confirm with your password, and deletion starts immediately —
there is no waiting period and no way to undo it.

This removes your account, your profile and photo, your own posts and
discussions together with everything under them, your uploaded media, your
likes, saved items, event sign-ups and follows, and the notifications addressed
to you.

Replies and comments you left under **other people's** posts and discussions
stay, because deleting them would tear holes in conversations other readers
rely on — but every author field is stripped from them, so they no longer
identify you. Section 7 lists this and everything else that outlives an account.

If you no longer have the App installed, email us from your registered address
and we will delete the account for you. Step-by-step instructions are also
published at
[nikitashep.github.io/yOdin/delete-account](https://nikitashep.github.io/yOdin/delete-account/).

---

## 9. Children

yOdin is not intended for children under 13, and we do not knowingly collect
data from them. If you believe a child under 13 has created an account, contact
us at **hello@onlymaxon.com** and we will remove it. Where local law sets a higher
minimum age for consent to data processing, that age applies instead.

---

## 10. Security

Data is transmitted over TLS and stored in Google Firebase with access governed
by server-side security rules, so that users can only read and write what they
are entitled to. Passwords are handled entirely by Firebase Authentication and
are never visible to us. No system is perfectly secure; if a breach affects your
personal data, we will notify you and the competent authority as required by law.

---

## 11. Changes to this policy

We may update this policy. Material changes will be announced in the App before
they take effect, and the "Last updated" date above will change. Continuing to
use the App after a change means you accept the updated policy.

---

## 12. Contact

**Jalil Orujli**
Chmielna 69
Warsaw, Poland
Email: **hello@onlymaxon.com**

<!--
Data-protection officer, if you appoint one:
DPO: [NAME], [EMAIL]
-->
