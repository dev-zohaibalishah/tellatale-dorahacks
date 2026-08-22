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

/** Local-only ids. Not used for anything security-bearing. */
export function localId(prefix: string): string {
  return `${prefix}_${randomToken(8).toLowerCase()}`;
}
