import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { PUSH_STRINGS } from './pushStrings';
import { sendApns } from './apns';

// Every notification in the app is a Firestore document, and the in-app list
// renders it live through onSnapshot. That only works while the app is open —
// which is why nothing reached the lock screen before this.
//
// Rather than teach each of the seven places that create a notification to
// also send a push, this hangs off the document itself, inside the existing
// onNotificationCreated trigger. One place to change, and it covers moderation
// notices written by the Admin SDK and the social ones written by clients.
//
// It runs *after* that trigger's identity correction, and takes the corrected
// name as an argument rather than reading the document again. A client writes
// `fromUserName` itself, so an uncorrected one can read "yOdin Support" — and
// a push puts it on the lock screen, where it is more convincing than
// anywhere inside the app.

// Must match the channel the app creates in pushService.ts. Android drops a
// notification addressed to a channel that does not exist.
const CHANNEL_ID = 'default';

// sendEachForMulticast caps at 500 tokens per call. Nobody has 500 devices,
// but the loop costs nothing and removes the cliff.
const TOKEN_CHUNK = 500;

const MODERATION = new Set(['removed', 'blocked']);

function db() {
  return getFirestore();
}

// Body text in the recipient's language, falling back to English. i18next does
// the interpolation on the device; here only one placeholder ever appears, in
// the ban notice, so it is substituted directly rather than pulling in a
// templating dependency.
function pushBody(type: string, language: string, blockDays: number): string | null {
  const table = PUSH_STRINGS[language] ?? PUSH_STRINGS.en;
  const text = table?.[type] ?? PUSH_STRINGS.en?.[type];
  if (!text) return null;
  return text.replace('{{count}}', String(blockDays));
}

export async function sendNotificationPush(
  n: FirebaseFirestore.DocumentData,
  trustedName: string,
): Promise<void> {
  {
    const toUserId: string = n.toUserId ?? '';
    if (!toUserId) return;

    // Tokens live in a subcollection rather than on the profile, because the
    // profile is readable by every signed-in user and a push token is not
    // something to hand out.
    const [profile, tokenDocs] = await Promise.all([
      db().doc(`users/${toUserId}`).get().catch(() => null),
      db().collection(`users/${toUserId}/pushTokens`).get().catch(() => null),
    ]);
    // Android tokens are FCM registration tokens and go through
    // firebase-admin; iOS tokens are raw APNs device tokens, which
    // firebase-admin cannot send to at all. The platform written at
    // registration is what tells them apart — see apns.ts.
    const all = tokenDocs?.docs.map((d) => ({ token: d.id, platform: String(d.get('platform') ?? '') })) ?? [];
    const fcmTokens = all.filter((t) => t.platform !== 'ios').map((t) => t.token);
    const apnsTokens = all.filter((t) => t.platform === 'ios').map((t) => t.token);
    if (all.length === 0) return;

    const type: string = n.type ?? '';
    const language: string = profile?.get('language') ?? 'en';
    const body = pushBody(type, language, Number(n.blockDays ?? 0));
    if (!body) return;

    // A social notice leads with who it came from, the way the in-app row
    // does. A moderation notice has no sender, so it speaks as the app.
    const title = MODERATION.has(type) || !trustedName ? 'yOdin' : trustedName;

    // What the app needs to open the right screen on tap. FCM data values must
    // be strings.
    const data: Record<string, string> = { type };
    if (n.postId) data.postId = String(n.postId);
    if (n.discussionId) data.discussionId = String(n.discussionId);
    if (n.discussionQuestion) data.discussionQuestion = String(n.discussionQuestion);

    const stale: string[] = [];

    for (let i = 0; i < fcmTokens.length; i += TOKEN_CHUNK) {
      const slice = fcmTokens.slice(i, i + TOKEN_CHUNK);
      const res = await getMessaging()
        .sendEachForMulticast({
          tokens: slice,
          notification: { title, body },
          data,
          android: { priority: 'high', notification: { channelId: CHANNEL_ID } },
        })
        .catch(() => null);
      if (!res) continue;

      // A token outlives the install it came from. FCM says so explicitly, and
      // keeping dead ones means every later send pays for them.
      res.responses.forEach((r, idx) => {
        const code = r.error?.code;
        if (
          code === 'messaging/registration-token-not-registered' ||
          code === 'messaging/invalid-registration-token' ||
          code === 'messaging/invalid-argument'
        ) {
          stale.push(slice[idx]);
        }
      });
    }

    const apns = await sendApns(apnsTokens, title, body, data).catch(() => ({ stale: [] }));
    stale.push(...apns.stale);

    await Promise.all(
      stale.map((t) => db().doc(`users/${toUserId}/pushTokens/${t}`).delete().catch(() => {})),
    );
  }
}
