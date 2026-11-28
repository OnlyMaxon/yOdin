import http2 from 'node:http2';
import { defineSecret } from 'firebase-functions/params';
import { SignJWT, importPKCS8 } from 'jose';

// Push to iOS goes straight to Apple rather than through firebase-admin.
//
// `expo-notifications` hands back a native token: an FCM registration token on
// Android, but a raw APNs device token on iOS. firebase-admin only speaks FCM
// tokens, so the iOS half would silently go nowhere if it were sent the same
// way. Rather than add the Firebase iOS SDK to the app just to get an FCM
// token out of it, the function talks APNs directly.
//
// A separate key from Sign in with Apple: an Apple key is created with its
// services ticked, and the SIWA one is not valid for APNs. The team id is the
// same, so that secret is reused.
const APPLE_APNS_KEY = defineSecret('APPLE_APNS_KEY');
const APPLE_APNS_KEY_ID = defineSecret('APPLE_APNS_KEY_ID');
const APPLE_TEAM_ID = defineSecret('APPLE_TEAM_ID');

// Bound onto whichever trigger calls sendApns — a secret not declared on the
// function is simply absent at runtime, and the send would fail on a key that
// reads as undefined.
export const APNS_SECRETS = [APPLE_APNS_KEY, APPLE_APNS_KEY_ID, APPLE_TEAM_ID];

const BUNDLE_ID = 'app.yodin';
const PROD_HOST = 'https://api.push.apple.com';
const SANDBOX_HOST = 'https://api.sandbox.push.apple.com';

// Apple rejects a provider token regenerated more often than once every 20
// minutes and expires it after 60, so it is minted once per warm instance and
// reused. Well inside both bounds.
const TOKEN_TTL_MS = 30 * 60 * 1000;
let cached: { jwt: string; at: number } | null = null;

async function providerToken(): Promise<string> {
  if (cached && Date.now() - cached.at < TOKEN_TTL_MS) return cached.jwt;
  const key = await importPKCS8(APPLE_APNS_KEY.value().replace(/\\n/g, '\n'), 'ES256');
  const jwt = await new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: APPLE_APNS_KEY_ID.value() })
    .setIssuer(APPLE_TEAM_ID.value())
    .setIssuedAt(Math.floor(Date.now() / 1000))
    .sign(key);
  cached = { jwt, at: Date.now() };
  return jwt;
}

type ApnsResult = { ok: boolean; stale: boolean };

function postOnce(
  host: string,
  token: string,
  jwt: string,
  payload: string,
): Promise<{ status: number; reason: string }> {
  return new Promise((resolve) => {
    const session = http2.connect(host);
    // Without this a dead socket keeps the function alive until the platform
    // timeout, which on a trigger means paying for the whole window.
    const done = (status: number, reason: string) => {
      session.close();
      resolve({ status, reason });
    };
    session.on('error', () => resolve({ status: 0, reason: 'session-error' }));

    const req = session.request({
      ':method': 'POST',
      ':path': `/3/device/${token}`,
      authorization: `bearer ${jwt}`,
      'apns-topic': BUNDLE_ID,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'content-type': 'application/json',
    });

    let status = 0;
    let body = '';
    req.on('response', (headers) => {
      status = Number(headers[':status'] ?? 0);
    });
    req.on('error', () => done(0, 'request-error'));
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      let reason = '';
      try {
        reason = body ? (JSON.parse(body).reason ?? '') : '';
      } catch {
        reason = body.slice(0, 120);
      }
      done(status, reason);
    });
    req.end(payload);
  });
}

// A token is only valid against the environment it was issued in. Release and
// TestFlight builds are production; a build run from Xcode is sandbox, and
// Apple answers BadDeviceToken rather than saying which. Trying production
// first and falling back keeps a developer's own device working without
// storing the environment alongside every token.
async function post(token: string, jwt: string, payload: string): Promise<ApnsResult> {
  let res = await postOnce(PROD_HOST, token, jwt, payload);
  if (res.status === 400 && res.reason === 'BadDeviceToken') {
    res = await postOnce(SANDBOX_HOST, token, jwt, payload);
  }
  // 410 Unregistered is Apple saying the app is gone from that device; a
  // BadDeviceToken surviving both environments is a token that was never
  // valid. Both are worth deleting, nothing else is.
  const stale =
    res.status === 410 || (res.status === 400 && res.reason === 'BadDeviceToken');
  return { ok: res.status === 200, stale };
}

export async function sendApns(
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, string>,
): Promise<{ stale: string[] }> {
  if (tokens.length === 0) return { stale: [] };
  const jwt = await providerToken();
  const payload = JSON.stringify({
    aps: { alert: { title, body }, sound: 'default' },
    ...data,
  });

  const results = await Promise.all(
    tokens.map(async (t) => ({ token: t, res: await post(t, jwt, payload) })),
  );
  return { stale: results.filter((r) => r.res.stale).map((r) => r.token) };
}
