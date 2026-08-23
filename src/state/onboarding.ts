/**
 * What someone told us during setup.
 *
 * Two questions, and they have to earn their place. An onboarding question whose
 * answer is never used again is worse than no question: it costs the one moment of
 * attention a new user reliably gives, and it teaches them that this app asks things
 * it does not listen to. So both answers are read back — the first shapes the prompt
 * on the compose sheet, the second is shown on the People screen.
 *
 * Stored on the device, not in Postgres. These are a hint about what to say next, not
 * a fact about the account: nothing here is worth a column, a migration and a
 * round trip, and losing it on reinstall costs a slightly more generic placeholder.
 * If it ever drives something server-side, that is the moment to move it.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const FIRST_KEY = 'tellatale.setup.first.v1';
const CIRCLE_KEY = 'tellatale.setup.circle.v1';
const DONE_KEY = 'tellatale.setup.done.v1';

/**
 * Set by sign-up before the session exists, so the route guard knows a brand-new
 * account is on its way to setup.
 *
 * Without it there is a race the user can see: signing up establishes a session, the
 * guard notices someone signed in sitting on an auth route and sends them home, and
 * only then does the sign-up screen navigate to setup — so Home flashes for a frame
 * on the way past. Deciding this in the guard rather than racing it there is the fix.
 *
 * It also distinguishes a new account from an existing one that predates setup. Only
 * accounts created after this shipped carry the flag, so nobody who already has an
 * archive is dropped into onboarding.
 */
const PENDING_KEY = 'tellatale.setup.pending.v1';

export async function markSetupPending() {
  await AsyncStorage.setItem(PENDING_KEY, '1');
}

/** True only between creating an account and finishing setup. */
export async function isSetupPending(): Promise<boolean> {
  const [pending, done] = await AsyncStorage.multiGet([PENDING_KEY, DONE_KEY]);
  return pending[1] === '1' && done[1] !== '1';
}

export type FirstMemoryChoice = 'someone-missed' | 'parents-young' | 'a-day';

export interface FirstMemoryOption {
  key: FirstMemoryChoice;
  emoji: string;
  title: string;
  note: string;
  /** Placeholder used on the compose sheet once this is chosen. */
  prompt: string;
}

export const FIRST_MEMORY_OPTIONS: FirstMemoryOption[] = [
  {
    key: 'someone-missed',
    emoji: '🕯️',
    title: 'A photo of someone you miss',
    note: 'The people we don’t want to forget',
    prompt: 'Who is in this photo, and what do you want remembered about them?',
  },
  {
    key: 'parents-young',
    emoji: '📷',
    title: 'Your parents when they were young',
    note: 'Before you knew them',
    prompt: 'What was going on here, before you were around to see it?',
  },
  {
    key: 'a-day',
    emoji: '🌿',
    title: 'A day you’d want your kids to know about',
    note: 'Something worth passing on',
    prompt: 'What happened that day, and why does it still matter?',
  },
];

export const CIRCLE_OPTIONS = [
  'Grandparents',
  'Parents',
  'Siblings',
  'Aunts & uncles',
  'Cousins',
  'Kids',
] as const;

export type CircleGroup = (typeof CIRCLE_OPTIONS)[number];

export interface SetupAnswers {
  first: FirstMemoryChoice | null;
  circle: CircleGroup[];
  done: boolean;
}

export async function readSetup(): Promise<SetupAnswers> {
  const [first, circle, done] = await AsyncStorage.multiGet([
    FIRST_KEY,
    CIRCLE_KEY,
    DONE_KEY,
  ]);

  return {
    first: (first[1] as FirstMemoryChoice | null) ?? null,
    // Parsed defensively: this is device storage, which survives app versions and can
    // hold whatever an older build wrote.
    circle: safeList(circle[1]),
    done: done[1] === '1',
  };
}

function safeList(raw: string | null): CircleGroup[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is CircleGroup =>
      (CIRCLE_OPTIONS as readonly string[]).includes(v)
    );
  } catch {
    return [];
  }
}

export async function saveSetup(first: FirstMemoryChoice, circle: CircleGroup[]) {
  await AsyncStorage.multiSet([
    [FIRST_KEY, first],
    [CIRCLE_KEY, JSON.stringify(circle)],
    [DONE_KEY, '1'],
  ]);
  await AsyncStorage.removeItem(PENDING_KEY);
}

/** Leaving setup without answering still closes it — it is asked once, not enforced. */
export async function skipSetup() {
  await AsyncStorage.multiSet([[DONE_KEY, '1']]);
  await AsyncStorage.removeItem(PENDING_KEY);
}

/** The compose placeholder, tailored to what they said they would add first. */
export function promptFor(first: FirstMemoryChoice | null): string {
  const match = FIRST_MEMORY_OPTIONS.find((o) => o.key === first);
  return (
    match?.prompt ??
    "What's the story? Who's in it, where were you, what do you remember..."
  );
}
