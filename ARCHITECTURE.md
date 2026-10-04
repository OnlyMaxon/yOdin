# yOdin — Architecture

Living reference for the yOdin mobile app. Describes how the code is put
together, why the boundaries are where they are, and which trade-offs are
deliberate. Keep it in sync when structure changes.

> Stack note: Expo has changed. Before writing native/SDK code, read the
> versioned docs at https://docs.expo.dev/versions/v54.0.0/.

---

## 1. What yOdin is

A social mobile app where people connect across nationalities and locations.
Four tabs:

- **Forum** — global Q&A discussions with Algolia full-text search, "answered"
  filter, nationality filter, and a smart-scored feed.
- **Feed** — global posts (news / events / places / lifestyle), event RSVP,
  category + nationality filters, smart-scored feed.
- **Notifications** — realtime badge + list (replies, accepted answers, event
  sign-ups, moderation notices).
- **Profile** — avatar, my posts / discussions, saved items, follow stats,
  settings, edit profile, and (for moderators) the Reports queue.

---

## 2. Tech stack

- **Expo SDK ~54**, React Native 0.81, React 19, TypeScript, `newArchEnabled`.
- **Firebase JS SDK v12**: Auth (AsyncStorage persistence), Firestore, Storage,
  and Functions (callables, pinned to `europe-west1` — see §9).
- **Firebase Cloud Functions v2** (Node 22, Admin SDK) — server-authoritative
  counters, scoring, points, moderation, Algolia sync, account deletion,
  blocking.
- **Algolia v5** (`algoliasearch`) — forum full-text search (Search-Only key on
  the client; Write key only in Cloud Functions via Secret Manager).
- **React Navigation v7** — Native Stack + Material Top Tabs (`tabBarPosition:
  "bottom"`).
- **Zustand v5** — global client state.
- **i18next + expo-localization** — 27 languages, RTL-aware.
- **expo-image-picker / expo-image-manipulator / expo-media-library** — media
  capture, optimization, and a custom Telegram-style photo picker.
- **expo-video / expo-video-thumbnails** — inline video playback + posters.

---

## 3. Layering & data flow

```
Screen (UI + local state)
  → Zustand store (client cache, optimistic updates)
  → Service (Firestore/Storage/Algolia calls)
  → Firebase
        ↑ Cloud Functions (Admin SDK) own the "truth" for
          counters, feedScore, points, moderation, Algolia
```

Rules of the layering:

- **Screens never import `firebase/firestore` directly** — they go through a
  service. (One deliberate exception: screens read `auth.currentUser` from
  `services/firebase` for identity.)
- **Stores hold the optimistic client view.** Writes are applied to the store
  immediately, the network call runs after, and the store is reverted on
  failure (see `FollowButton`, `FeedScreen.handleVote`, etc.).
- **Anything forgeable is server-only.** The client cannot write `points`,
  `feedScore`, `commentCount`, `replyCount`, `engagement`, or moderation
  fields — Cloud Functions compute them from real sub-documents. This closes
  the historical "farm points / inflate counters" holes.

### Stores (`src/store/`)

- `useAuthStore` — `firebaseUser`, `profile` (Firestore user doc), `isModerator`
  (from a custom claim), `pendingEmailVerification`.
- `usePostStore` — feed posts + filter + pagination flags + optimistic mutators
  (vote, save, participant, commentCount).
- `useFeedStore` — **stores `Discussion` objects, not "feed" posts.** The name
  is legacy; it drives the Forum. Renaming it is intentionally deferred because
  it threads through the whole forum flow and the rename buys nothing but
  churn. Treat "feed store = discussions" as a known convention.
- `useNotificationStore` — notifications + derived `unreadCount`.
- `useThemeStore` — light/dark/system preference (persisted to AsyncStorage).

---

## 4. Navigation

```
App
└── RootNavigator            (AppState: loading | auth | emailVerification | onboarding | main)
    ├── Auth → AuthNavigator (Welcome → Register → ForgotPassword → Onboarding)
    ├── EmailVerification    (mandatory; unverified users are held here)
    ├── Onboarding           (nationality + location required to reach main)
    └── Main → TabNavigator  (Material Top Tabs, bottom)
        ├── Forum   → ForumStack   (ForumHome | DiscussionDetail | UserProfile | FollowList)
        ├── Feed    → FeedStack    (FeedHome | UserProfile | DiscussionDetail | FollowList)
        ├── Notifications → NotificationsStack (…​| PostDetail)
        └── Profile → ProfileStack (…​| Reports — moderators only)
```

- `RootNavigator.routeForUser()` is the single routing decision for a signed-in
  user: it refreshes the token (moderator claim), reloads the user (to catch a
  just-clicked verification link), and gates on `emailVerified` before letting
  anyone reach onboarding/main.
- The custom bottom `TabBar` hides itself on `FULLSCREEN_ROUTES`
  (`DiscussionDetail`) so the message composer sits at the device bottom under
  the keyboard. The center `+` button creates content only on Forum/Feed.
- `TAB_BAR_HEIGHT = 64` (`constants/layout.ts`); all FlatList content screens
  pad `paddingBottom: 96` to clear it.
- **Screen prop types are currently `navigation: any` / `route: any`.** This is
  a known typing gap (see §12).

---

## 5. Screens & services map

### Services (`src/services/`)
- `firebase.ts` — app/auth/db/storage/functions init. `getReactNativePersistence`
  is imported from **`@firebase/auth`** (not `firebase/auth`); the `@ts-ignore` is
  intentional (Metro resolves the RN build at runtime). **Do not change this.**
  The `functions` instance is created with an explicit region — a callable in the
  default region would simply 404.
- `authService.ts` — register/login/logout, `getUserProfile` (single source of
  truth for reading a user), profile update, password reset, resend
  verification, `deleteOwnAccount` (§9). Email is **not** stored in Firestore
  (lives in Auth only).
- `postService.ts` / `discussionService.ts` — CRUD + queries + votes/saves +
  event RSVP (`joinEvent` is a transaction so the cap can't be raced).
- `storageService.ts` — image/video/poster/avatar uploads + `deleteStorageFolder`
  cleanup.
- `notificationService.ts` — realtime subscription, create, mark-read, cleanup.
- `reportService.ts` — file/list/resolve reports; removal deletes the target.
- `userService.ts` — follow/unfollow (self-update of `following[]`), follower
  count/list.
- `algoliaService.ts` — forum search (lazy client; no-op without keys).
- `errorHandler.ts` — maps Firebase auth codes → i18n keys.
- `i18n.ts` — 27 languages, device-locale default, RTL handling.
- `utils/author.ts` — `isDeletedAuthor()`. One predicate, not a check copied into
  every screen that renders an author (§9).

### Media pipeline
`PhotoPickerSheet` (expo-media-library grid + system camera) → `optimizeImage`
(downscale longest side to 1280px, JPEG q0.6) → `uploadPostImages` /
`uploadDiscussionImages`. Video: system picker → `processVideoAsset` (≤60s,
≤50 MB, generates a small poster) → `uploadPostVideo` / `uploadDiscussionVideo`.
A post/discussion carries **either** photos **or** one short video.

---

## 6. Data model (`src/types/index.ts`)

- **User** — profile fields (incl. `username` @handle + optional `bio`),
  `following[]`, `points`, and server-owned moderation fields
  (`commentBlockedUntil`, `moderationStrikes`, `banCount`).
- **Post** — author denormalized fields, `category`, `imageURLs[]` **or**
  `videoURL`/`videoPoster`, `likes[]`/`dislikes[]`, `commentCount`, `savedBy[]`,
  and event RSVP (`signupEnabled`, `participantLimit`, `participants[]`,
  optional `eventDate` ms timestamp).
- **Discussion** — author fields, `question`, media, `replyCount`, `engagement`,
  `savedBy[]`, accepted-answer denormalization (`acceptedReplyId`/`Text`/
  `AuthorName`), `isAnswered`.
- **Reply** — author fields, `text`, `likes[]`/`dislikes[]`, `parentReplyId`
  (Reddit-style threading; rendered Telegram-style as a flat stream with quote
  jumps).
- **AppNotification** — `type: reply | accepted | participant | mention |
  removed | blocked`; carries the discussion or post it refers to. The list
  badges a per-type glyph on the sender's avatar.
- **Report** — `targetType: post | discussion | comment | reply`, `targetPath`
  (for nested comment/reply removal), `reason` (one of 10), `status`.

Denormalization is deliberate: author name/photo/flag are copied onto each
content doc so a feed card renders with zero extra reads. The cost is that
anything touching an author has to rewrite every copy — see the deletion sweep
in §9.

### Collections outside the four content types

- `usernames/{handle}` → `{ uid }` — uniqueness guard and @mention index.
  Create-only, so claiming a taken handle fails atomically. After an account is
  deleted the entry stays as `{ deleted: true }` with **no uid**: reserved
  forever, resolving to nobody.
- `users/{uid}/blocked/{uid}` and `users/{uid}/blockedBy/{uid}` — blocking (§9).
- `blockedEmails/{hash}` — server-only, keyed hashes of the emails of deleted
  rule-breakers, with a Firestore TTL policy on `expiresAt` (§9).

---

## 7. Feed scoring

Two layers:

- **Server `feedScore` (authoritative order).** A Reddit-style "hot" score in
  `functions/src/index.ts`: `log10(engagement+1) + (createdAtMs/1000 - EPOCH)/45000`.
  Anchored to absolute time, so it's monotonic in recency with a log engagement
  boost — new content surfaces and old sinks with no decay job. Set to 0 on
  create, then overwritten by the onCreate/onUpdate function. Queries order by
  `feedScore desc`.
- **Client `weightedSort` (re-rank).** When no filters are active, the client
  re-ranks the loaded page by `recency*0.35 + engagement*0.30 + follows*0.20 +
  nationality*0.15` (personalization the server can't do per-user).

> Known limitation: `weightedSort` re-ranks **within each 15-item page**, while
> the server paginates by `feedScore`. So personalization only reorders inside a
> page, and cross-page order can look inconsistent. See §12.

`engagement` (replies + reply votes) also selects the "Question of the day"
(`fetchTopQuestion`).

---

## 8. Moderation

- **Moderator status** = Firebase custom claim `moderator:true` (set server-side
  by an out-of-repo `set-moderator.js`). Verified identically on the client
  (`config/moderation.ts`) and in the rules (`request.auth.token.moderator`).
  No hardcoded emails; the claim rides inside the signed token.
- **Reporting** — any verified user files a report (`ReportSheet`, 10 reasons).
  Reports cover posts, questions, comments, replies.
- **Removal** — a moderator marks a report `removed`; `reportService`
  deletes the target. `onReportUpdated` then (a) notifies the author, (b) adds a
  strike, (c) every 5 strikes applies an escalating comment ban
  (3d → 7d → 30d). Strikes are only added on **moderator-confirmed** removals,
  so a ban can't be farmed by mass-reporting.
- **Ban enforcement** — the Firestore `notBlocked()` rule rejects comment/reply
  creates while `now < commentBlockedUntil`. The client also hides the composer.

---

## 9. Account deletion & blocking

Both exist because Google Play's UGC policy requires them: an in-app path to
delete an account **and** a web one, plus a way to block users in any app with
1:1 interaction — @mentions count.

### Deleting an account

`deleteAccount` is a **callable** (`functions/src/accountDeletion.ts`), not
client code. The work spans other people's documents, two Storage buckets and
the Auth record; a client killed halfway would leave an account half removed,
and the rules would refuse most of it anyway.

| Data | Outcome |
|---|---|
| Auth record, profile, avatar, media | deleted |
| Own posts and discussions | deleted whole, subcollections included — so other people's replies under them go too, exactly as when the author deletes a discussion by hand |
| Replies/comments under **other people's** content | kept, every author field cleared |
| Accepted-answer name on a discussion (and in Algolia) | cleared |
| uid in likes, saves, RSVPs, follow lists | removed |
| Notifications to them / from them | deleted / anonymised |
| @handle | reserved forever |

Design points worth keeping:

- **Auth is touched first and deleted last.** First, so a missing IAM permission
  fails the call *before* anything is destroyed. Last, because until the Auth
  record is gone the user can sign in and retry — every step is idempotent.
- **Re-authentication is enforced server-side.** The client re-enters the
  password, and the function rejects tokens whose `auth_time` is older than five
  minutes, so the prompt can't be skipped by calling the API from a phone that is
  already signed in.
- **The surviving content carries a sentinel, not a translated string.**
  `authorId: 'deleted'` with blank author fields; `utils/author.ts` turns that
  into a localized label at render time. Writing "Deleted account" into the
  database would show one language to all 27 locales.
- **Media is deleted from the bucket the app actually uses** (`yodin-23362`,
  EU), not the project's default US bucket — `getStorage().bucket()` with no
  name points at the wrong one. The old default bucket is swept too, for the few
  stale avatars still in it.
- **Ban evasion.** If the account had strikes or bans, a keyed HMAC of its
  normalised email (plus-tags stripped, Gmail dots collapsed) goes into
  `blockedEmails` for a year, expiring via a Firestore TTL policy. Signup is
  entirely client-side and cannot be refused in-app, so `onUserProfileCreated`
  fires on the profile write and undoes the whole registration when the hash
  matches. `RootNavigator` notices the Auth record vanishing under a live session
  and explains why instead of parking the user on the verification screen.

### Blocking

| Path | Written by | Read by |
|---|---|---|
| `users/{blocker}/blocked/{blocked}` | the owner | the owner only |
| `users/{blocked}/blockedBy/{blocker}` | the mirror trigger only | the owner only |

Blocking is **not** a visual filter. The rules helper `hasBlockedMe()` refuses a
comment on your post, a reply in your discussion, and any notification aimed at
you — which is what a mention is. Hiding alone would let someone you blocked keep
writing under your posts for everyone else to read.

The list is private, and that is exactly what forces the mirror: the blocked
person's app cannot read the blocker's list, so it would have no way to hide the
blocker's content. Each side filters on its own half. The accepted cost is that a
blocked person can infer they were blocked — unavoidable once the content
disappears for them anyway.

`onBlockCreated` also drops the follow **both ways**. The client can only do half
of that: the follow list lives on the follower's own document, which only they may
write, so the blocked person would otherwise keep following. Unblocking restores
visibility but leaves the follows broken.

### Public documents

`docs/` is published as a GitHub Pages site (`docs/_config.yml` + a
self-contained layout, no theme gem, light and dark): the privacy policy, the
account-deletion page Play links to, and the terms of use. Their URLs live in one
place, `src/config/links.ts`, because the app links to all three.
`play-store-listing.md` is excluded from the build — it is internal working copy.
Jekyll only renders Markdown that carries front matter; without it the file is
served as raw text.

---

## 10. Security model

### Firestore rules (`firestore.rules`)
- `isVerified()` (email_verified) is required to create posts/discussions/
  replies/comments/reports.
- `notBlocked()` gates comment/reply creation on the ban timestamp.
- Content updates are **field-scoped**: votes may only touch `likes/dislikes`
  and only add/remove the caller's own uid (`ownUidArrayChange`); saves only
  `savedBy`; RSVP only `participants` (and respects the cap); accepting an
  answer only the three accepted-* fields and only once.
- `points`, `feedScore`, `engagement`, counters are **not** client-writable.
- Notifications: recipient reads/updates(`read`)/deletes; any user creates only
  with `fromUserId == self` and a type in the allowed client set
  (`reply | accepted | participant`) — moderation notices are Admin-SDK only.
- Reports: create requires verified + `reportedBy == self` + `status ==
  'pending'`; read/update/delete are moderator-only.
- `hasBlockedMe(uid)` gates comment creates, reply creates and **every**
  notification create. It reads a private block list through `exists()`, which
  rules evaluate with full access — enforcement without exposing the list.
- `users/{uid}/blocked/**` is owner-only; `users/{uid}/blockedBy/**` is
  owner-readable and server-written; `blockedEmails/**` denies clients outright.

### Storage rules (`storage.rules`)
- `avatars/{uid}/…` — write requires `request.auth.uid == uid` + image + <5 MB.
- `posts/{postId}/…` and `discussions/{discussionId}/…` — image <5 MB **or**
  video <50 MB.

### Cloud Functions — 15, all in `europe-west1`
`index.ts` holds the 11 content triggers: Algolia create/update/delete sync;
feedScore seeding & recompute; comment/reply counters; `engagement` maintenance;
points award on accepted answer; `onReportUpdated` moderation pipeline.
`accountDeletion.ts` adds `deleteAccount` + `onUserProfileCreated`, and
`blocking.ts` adds `onBlockCreated` + `onBlockDeleted` (§9). Secrets (Algolia
Write key, `EMAIL_HASH_KEY`) live in Secret Manager, never on the client.

> **Region trap.** `setGlobalOptions({ region })` is a call in the *body* of
> `index.ts`, while modules it imports at the top define their functions first —
> they never see it. Firestore triggers survive this (their region comes from the
> database location), but a callable silently deploys to `us-central1`, which for
> account deletion meant processing an EU user's data in the US. Both extra
> modules pin the region explicitly; do the same in any new one.

> **Runtime IAM.** Functions run as `411063608880-compute@developer…`, which has
> only the roles someone granted by hand — not Editor. It needed
> `roles/datastore.user` once (silent trigger failures for months) and
> `roles/firebaseauth.admin` for deletion. A new capability may well need another.

---

## 11. UI conventions & design system

**Design tokens** (`src/theme/`):
- `colors.ts` — `LightColors` / `DarkColors` via `useTheme()`. Palette is
  **locked 1:1 to the Figma design kit** (light = its `:root`, dark = `.dark`):
  purple-brand violet (`#6C35DE`), airy lavender ground (`#F3F0FB`), white
  surfaces, a lavender-biased secondary grey, category accents (news=primary,
  events=coral, places=emerald, lifestyle=pink).
- `spacing.ts` — `Spacing` (4·8·12·16·20·24·32) and `Radius` (sm/md/lg/pill).
  Use these instead of magic numbers.
- `typography.ts` — font sizes + weight constants.

**Shared UI components** (`src/components/`) — build screens from these; don't
re-implement per screen:
- `Card` — standard surface (white, radius `lg`, soft brand-tinted shadow,
  `onPress` optional). Pass `style` to override (e.g. the answered variant).
- `Avatar` — photo or initials, any `size`, `onPress` optional.
- `Chip` — filter pill (`active` = filled brand).
- `EmptyState` — empty-list block.
- `EventDateBlock` — compact day/month block + locale-formatted when/where line
  for `events` posts carrying an `eventDate` (used by Feed + PostDetail).
- Feed and Forum are the reference screens built on these; roll the same set out
  when restyling others.

**Font — Inter, via wrappers (important convention):** React 19 removed the
`Text.defaultProps` global-font shortcut and render-patching is unsafe on the new
architecture, so Inter is applied through drop-in wrappers:
- **Import `Text` from `components/AppText` and `TextInput` from
  `components/AppTextInput`, NOT from `react-native`.** They map the style's
  `fontWeight` to the matching Inter cut (custom fonts don't derive weights).
  New files must follow this or their text falls back to the system font.
- Fonts load in `App.tsx` via `useFonts` (`expo-font` + `@expo-google-fonts/inter`),
  gated before first render. Inter is a native asset → shows instantly in Expo Go,
  but a standalone/sideload build must be **rebuilt** to include it.

**Other conventions:**
- Every screen builds dynamic styles with `makeStyles(colors, insets…)`;
  high-traffic screens memoize with `useMemo` (see §12).
- All user-facing text is i18n (`t(...)`); only brand strings are literal.
- Bottom-sheet modals: rounded top, drag handle, close button, footer action
  outside the ScrollView. FlatList screens pad `paddingBottom: 96`; headers pad
  `insets.top + 12`.
- **PostDetailModal** is one tall bottom sheet: the post is the FlatList
  `ListHeaderComponent`, comments follow in the same list, and the comment input
  is pinned at the bottom. `KeyboardAvoidingView` is unreliable inside a Modal,
  so the keyboard is handled manually (track its height → lift the input by it +
  pad the list tail via an animated footer). The nation filter and the profile
  side-menu are matching left drawers (both slide from the left, `yOdin` header
  + close ✕).

---

## 12. Known limitations & open items

These are **intentional deferrals or accepted trade-offs**, not accidental
bugs. Listed so nobody rediscovers them the hard way.

### Security
- **Storage writes are now owner-scoped** (implemented 2026-07-25; was the top
  open item). Post/discussion media uploads to `posts/{uid}/{postId}/…` and
  `discussions/{uid}/{discussionId}/…`; `storage.rules` allows create/update only
  when `request.auth.uid ==` the `{uid}` path segment, and delete only for the
  author or a moderator. The legacy two-segment path (`posts/{postId}/…`) is kept
  **read-only** so pre-existing images keep loading (their media isn't cleaned on
  delete — best-effort, negligible). Closes vandalism (overwriting another
  author's files) and cross-user planting. **Deploy coupling:** new code writes
  the 3-segment path that the *old* rules reject, so `firebase deploy --only
  storage` must land with/before the code or uploads silently fail. Residual: a
  user can still fill *their own* uid folder — full anti-abuse needs **Firebase
  App Check** (native config; tracked in the team's Trello, not a code task here).
- **Moderation fields are world-readable.** `users` docs are readable by any
  authenticated user and include `commentBlockedUntil` / `moderationStrikes` /
  `banCount`. Firestore has no field-level read rules; to hide ban state, move
  these to a private subcollection (`users/{uid}/private/moderation`).
- Auth token lives in AsyncStorage, not SecureStore (deferred).
- App Check / Google Sign-In are deferred (need a dev build).
- **Terms of Use are consented to once, at registration.** Play requires
  acceptance *before* a user can create content, so the gate sits on the signup
  button rather than on the first post. The document lives on the Pages site, not
  in the app, which keeps it editable without an app update but means it needs
  network to read. If the terms change materially, there is currently no
  mechanism to ask existing users to accept the new version — announcing it in
  the app, as §8 of the terms promises, is a manual job for now.
- **The block list is private, the ban-evasion hash is not reversible, but
  neither hides the obvious.** A blocked person can infer the block from
  content disappearing; a banned person can register with a fresh address. Both
  are accepted: the point is friction and enforcement, not secrecy.

### Stability / correctness
- **`weightedSort` vs. server pagination** (§7): personalization re-ranks only
  within a page. Proper fix is to sort only the first page, or fold the weights
  into the server `feedScore`.
- **Unbounded profile queries.** `fetchUserPosts/Discussions`,
  `fetchSavedPosts/Discussions`, `fetchFollowers/Following` have no `limit()`.
  Fine for now; add pagination before any user accumulates thousands of items.
  (Left uncapped deliberately: adding a bare `limit` would silently hide older
  content with no "load more" UI.)
- **`engagement` vs. `feedScore` inputs.** "Question of the day" uses
  `engagement` (replies + votes); the forum `feedScore` recompute uses
  `replyCount*2` and ignores votes. Minor inconsistency; unify if it matters.
- **Blocked users are filtered on the client.** Firestore's `not-in` caps at ten
  values, so blocked authors cannot be excluded in the query. Consequences: a
  page of 20 sometimes renders fewer, and `replyCount`/`commentCount` still
  count hidden content — those counters are shared by everyone and cannot
  reflect one reader's block list.
- **Account deletion is not transactional.** It is a sequence of idempotent
  steps ending with the Auth record, so a failure mid-way is safe to retry, but
  between the first step and the last the account is partly gone. A single
  atomic delete is impossible across Auth, two buckets and many documents.

### Repository hygiene
- **Nine files are committed with CRLF** while `core.autocrlf=input` normalises
  on commit. Editing one with a tool that rewrites the file converts every line
  and turns a three-line change into a 750-line diff (`ForumScreen.tsx` did
  exactly this). Either preserve the endings when writing, or normalise all nine
  in a dedicated commit — never mixed into a feature change.

### Architecture / typing
- **`useFeedStore` is misnamed** (holds discussions). Rename deferred on purpose
  — it's woven through the whole forum flow and the rename is pure churn with a
  real risk of breaking that logic. Documented as a convention instead.
- **`navigation: any` / `route: any`** across screens. Introduce typed
  `NativeStackScreenProps` per stack when convenient.
- **Inline `renderItem` / card components** in the list screens are recreated
  each render, which limits `React.memo`. Extracting memoized card components is
  a worthwhile but non-trivial refactor (many closure deps), deferred to avoid a
  risky blind change.

---

## 13. Contributors

- **OnlyMaxon** — original author, `main`.
- **nikitashep** — feature PRs (media, moderation, filters, attachments, …).
