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
- **Firebase JS SDK v12**: Auth (AsyncStorage persistence), Firestore, Storage.
- **Firebase Cloud Functions v2** (Node 22, Admin SDK) — server-authoritative
  counters, scoring, points, moderation, Algolia sync.
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
  a known typing gap (see §11).

---

## 5. Screens & services map

### Services (`src/services/`)
- `firebase.ts` — app/auth/db/storage init. `getReactNativePersistence` is
  imported from **`@firebase/auth`** (not `firebase/auth`); the `@ts-ignore` is
  intentional (Metro resolves the RN build at runtime). **Do not change this.**
- `authService.ts` — register/login/logout, `getUserProfile` (single source of
  truth for reading a user), profile update, password reset, resend
  verification. Email is **not** stored in Firestore (lives in Auth only).
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

### Media pipeline
`PhotoPickerSheet` (expo-media-library grid + system camera) → `optimizeImage`
(downscale longest side to 1280px, JPEG q0.6) → `uploadPostImages` /
`uploadDiscussionImages`. Video: system picker → `processVideoAsset` (≤60s,
≤50 MB, generates a small poster) → `uploadPostVideo` / `uploadDiscussionVideo`.
A post/discussion carries **either** photos **or** one short video.

---

## 6. Data model (`src/types/index.ts`)

- **User** — profile fields + `following[]`, `points`, and server-owned
  moderation fields (`commentBlockedUntil`, `moderationStrikes`, `banCount`).
- **Post** — author denormalized fields, `category`, `imageURLs[]` **or**
  `videoURL`/`videoPoster`, `likes[]`/`dislikes[]`, `commentCount`, `savedBy[]`,
  and event RSVP (`signupEnabled`, `participantLimit`, `participants[]`).
- **Discussion** — author fields, `question`, media, `replyCount`, `engagement`,
  `savedBy[]`, accepted-answer denormalization (`acceptedReplyId`/`Text`/
  `AuthorName`), `isAnswered`.
- **Reply** — author fields, `text`, `likes[]`/`dislikes[]`, `parentReplyId`
  (Reddit-style threading; rendered Telegram-style as a flat stream with quote
  jumps).
- **AppNotification** — `type: reply | accepted | participant | removed |
  blocked`; carries the discussion or post it refers to.
- **Report** — `targetType: post | discussion | comment | reply`, `targetPath`
  (for nested comment/reply removal), `reason` (one of 10), `status`.

Denormalization is deliberate: author name/photo/flag are copied onto each
content doc so a feed card renders with zero extra reads.

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
> page, and cross-page order can look inconsistent. See §11.

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

## 9. Security model

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

### Storage rules (`storage.rules`)
- `avatars/{uid}/…` — write requires `request.auth.uid == uid` + image + <5 MB.
- `posts/{postId}/…` and `discussions/{discussionId}/…` — image <5 MB **or**
  video <50 MB.

### Cloud Functions (`functions/src/index.ts`) — 12 triggers
Algolia create/update/delete sync; feedScore seeding & recompute; comment/reply
counters; `engagement` maintenance; points award on accepted answer;
`onReportUpdated` moderation pipeline. All secrets (Algolia Write key) live in
Google Cloud Secret Manager, never on the client.

---

## 10. UI conventions & design system

**Design tokens** (`src/theme/`):
- `colors.ts` — `LightColors` / `DarkColors` via `useTheme()`. Palette is
  purple-brand: airy lavender-neutral ground (`#F3F0FB`), white surfaces,
  a chosen lavender-biased secondary grey, category accents (news=primary,
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
  high-traffic screens memoize with `useMemo` (see §11).
- All user-facing text is i18n (`t(...)`); only brand strings are literal.
- Bottom-sheet modals: rounded top, drag handle, close button, footer action
  outside the ScrollView. FlatList screens pad `paddingBottom: 96`; headers pad
  `insets.top + 12`.

---

## 11. Known limitations & open items

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

## 12. Contributors

- **OnlyMaxon** — original author, `main`.
- **nikitashep** — feature PRs (media, moderation, filters, attachments, …).
