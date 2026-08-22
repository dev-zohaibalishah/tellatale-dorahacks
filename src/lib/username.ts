/**
 * Username <-> synthetic email mapping.
 *
 * Supabase Auth is email-keyed; the product wants usernames. The mapping is a pure
 * function, so sign-in needs no lookup — which also means there is no endpoint a
 * stranger can poll to discover whether a username exists.
 *
 * MUST stay identical to `emailFor` in supabase/functions/auth-signup/index.ts.
 */

export const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,24}$/;
export const MIN_PASSWORD_LENGTH = 8;

const DOMAIN = 'tellatale.app';

export function emailForUsername(username: string): string {
  return `${username.trim().toLowerCase()}@${DOMAIN}`;
}

/** Returns a human-readable problem, or null when the username is acceptable. */
export function validateUsername(raw: string): string | null {
  const username = raw.trim();
  if (!username) return 'Choose a username.';
  if (username.length < 3) return 'At least 3 characters.';
  if (username.length > 24) return 'At most 24 characters.';
  if (!USERNAME_PATTERN.test(username)) {
    return 'Letters, numbers and underscores only.';
  }
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return 'Choose a password.';
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `At least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return null;
}

/**
 * Advisory only — never blocks. A strength meter that refuses to let someone in is a
 * signup-conversion problem, not a security control; rate limiting is the control.
 */
export function passwordStrength(password: string): {
  score: 0 | 1 | 2 | 3;
  label: string;
} {
  if (password.length < MIN_PASSWORD_LENGTH) return { score: 0, label: 'Too short' };

  let variety = 0;
  if (/[a-z]/.test(password)) variety += 1;
  if (/[A-Z]/.test(password)) variety += 1;
  if (/[0-9]/.test(password)) variety += 1;
  if (/[^a-zA-Z0-9]/.test(password)) variety += 1;

  const long = password.length >= 12;

  if (variety <= 1 && !long) return { score: 1, label: 'Weak' };
  if (variety >= 3 && long) return { score: 3, label: 'Strong' };
  return { score: 2, label: 'Fair' };
}
