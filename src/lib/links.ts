/**
 * Invite + share links.
 *
 * The PRD (§7.6) is emphatic that Firebase Dynamic Links shut down on 25 Aug 2025 and
 * the durable pattern is platform-native App Links / Universal Links on our own
 * domain, with a web landing page that handles the not-installed case.
 *
 * `EXPO_PUBLIC_LINK_HOST` is that domain. Until it exists, links fall back to the
 * app scheme, which works for a same-device demo but not for a real invite — a guest
 * without the app installed gets nothing. Ship the domain before user testing.
 */

import * as Linking from 'expo-linking';

const host = process.env.EXPO_PUBLIC_LINK_HOST;

export const hasLinkHost = Boolean(host);

export function buildInviteUrl(token: string): string {
  if (host) return `https://${host}/c/${token}`;
  return Linking.createURL(`/contribute/${token}`);
}

/**
 * The link to a published story — which is the same link as the invite, deliberately.
 *
 * It used to be `/s/<memoryId>`, and that was dead in two independent ways. There is
 * no `/story/[id]` route in the app, so it 404'd on the way in; and even with one, a
 * memory id is not a credential — a recipient has no account, and RLS would refuse to
 * read the row. Everything a person without an account can see comes through the
 * invite token and the `guest-memory` function that resolves it server-side.
 *
 * The contributor screen already shows the published story once the owner approves and
 * publishes it, so one token serves both halves of the loop: come and add what you
 * remember, then come back and read what everyone remembered. One link, one landing
 * page, one thing that can break.
 */
export function buildStoryUrl(inviteToken: string): string {
  return buildInviteUrl(inviteToken);
}

/** Verbatim invitation copy from the MVP spec §2. Do not paraphrase. */
export const INVITE_PROMPT = 'What do you remember about this image? Add your piece of the story.';

/** The anchor question a guest lands on. */
export const GUEST_QUESTION = 'What do you remember about this photo?';
