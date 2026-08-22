/**
 * Firebase Cloud Messaging — the only thing Firebase does in this architecture.
 *
 * Uses the HTTP v1 API, which requires an OAuth2 access token rather than the retired
 * legacy server key. Getting one means signing a JWT assertion with the service
 * account's private key, so that is done here with Web Crypto (no Node, no
 * firebase-admin, which does not run cleanly on Deno's edge runtime).
 *
 * Configuration: FIREBASE_SERVICE_ACCOUNT holds the service account JSON as a single
 * string secret. Never anything with an EXPO_PUBLIC_ prefix — that would ship the
 * signing key inside the app bundle.
 *
 * Notification delivery is best-effort by design. A push that fails must never fail
 * the write that triggered it: someone's memory being saved matters, the notification
 * about it does not.
 */

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

let cachedToken: { value: string; expiresAt: number } | null = null;

function serviceAccount(): ServiceAccount | null {
  const raw = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ServiceAccount;
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) return null;
    return parsed;
  } catch {
    console.error('FIREBASE_SERVICE_ACCOUNT is not valid JSON');
    return null;
  }
}

export function pushConfigured(): boolean {
  return serviceAccount() !== null;
}

function base64url(input: ArrayBuffer | string): string {
  const bytes =
    typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** PEM -> CryptoKey. The stored key has literal \n escapes when it comes from env. */
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const body = pem
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const der = Uint8Array.from(atob(body), (ch) => ch.charCodeAt(0));
  return crypto.subtle.importKey(
    'pkcs8',
    der.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

async function accessToken(sa: ServiceAccount): Promise<string | null> {
  // 60s of slack so a token cannot expire mid-flight.
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })
  );

  try {
    const key = await importPrivateKey(sa.private_key);
    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      key,
      new TextEncoder().encode(`${header}.${claims}`)
    );
    const assertion = `${header}.${claims}.${base64url(signature)}`;

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
    });

    if (!res.ok) {
      console.error('token exchange failed', res.status, await res.text());
      return null;
    }

    const body = (await res.json()) as { access_token: string; expires_in: number };
    cachedToken = {
      value: body.access_token,
      expiresAt: Date.now() + body.expires_in * 1000,
    };
    return cachedToken.value;
  } catch (err) {
    console.error('could not mint an FCM access token', err);
    return null;
  }
}

export interface PushMessage {
  title: string;
  body: string;
  /** Deep-link target, e.g. `/memory/<id>`. */
  route?: string;
}

/**
 * Sends to every token supplied. Returns the tokens FCM rejected as permanently
 * invalid so the caller can prune them — a device that has uninstalled should not be
 * retried forever.
 */
export async function sendPush(
  tokens: string[],
  message: PushMessage
): Promise<{ sent: number; invalid: string[] }> {
  const sa = serviceAccount();
  if (!sa || tokens.length === 0) return { sent: 0, invalid: [] };

  const token = await accessToken(sa);
  if (!token) return { sent: 0, invalid: [] };

  const endpoint = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;
  const invalid: string[] = [];
  let sent = 0;

  // HTTP v1 has no multicast; one request per token. Fine at this volume, and it is
  // what lets a single dead token be identified rather than failing the whole batch.
  await Promise.all(
    tokens.map(async (deviceToken) => {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${token}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            message: {
              token: deviceToken,
              notification: { title: message.title, body: message.body },
              data: message.route ? { route: message.route } : undefined,
              android: { priority: 'HIGH' },
              apns: { payload: { aps: { sound: 'default' } } },
            },
          }),
        });

        if (res.ok) {
          sent += 1;
          return;
        }

        // 404 UNREGISTERED / 400 INVALID_ARGUMENT mean this token is dead for good.
        if (res.status === 404 || res.status === 400) {
          invalid.push(deviceToken);
        }
        console.error('push rejected', res.status, await res.text());
      } catch (err) {
        console.error('push failed', err);
      }
    })
  );

  return { sent, invalid };
}
