import * as Crypto from 'expo-crypto';

/**
 * Invite tokens are the highest-risk surface in the product (PRD §8.3): anyone
 * holding one can read the image and post a remark. They must be unguessable, so
 * they come from the platform CSPRNG, never Math.random().
 *
 * 20 bytes of base32 ≈ 160 bits. Ambiguous glyphs (I, L, O, U, 0, 1) are excluded so
 * a token stays readable if someone dictates one over the phone.
 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';

export function randomToken(bytes = 20): string {
  const raw = Crypto.getRandomBytes(bytes);
  let out = '';
  for (let i = 0; i < raw.length; i++) out += ALPHABET[raw[i] % ALPHABET.length];
  return out;
}

/**
 * A v4 UUID, from Expo's crypto rather than the web global.
 *
 * `globalThis.crypto.randomUUID()` is not a safe assumption in this app. Hermes has
 * no `crypto` global of its own, so whether one exists depends on a polyfill being
 * installed as a side effect of some other import — which is true in a browser, true
 * often enough on device to pass a quick test, and false exactly when it matters.
 * The failure is `crypto.randomUUID is not a function` at the moment someone taps
 * Post or picks a profile picture: it worked on web and threw on a phone.
 *
 * `expo-crypto` is already a dependency and is the same CSPRNG `randomToken` uses.
 * Routing both through this module means there is one answer to "where does
 * randomness come from" rather than two.
 */
export function uuid(): string {
  return Crypto.randomUUID();
}

/** Local-only ids. Not used for anything security-bearing. */
export function localId(prefix: string): string {
  return `${prefix}_${randomToken(8).toLowerCase()}`;
}
