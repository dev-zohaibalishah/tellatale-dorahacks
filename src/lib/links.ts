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

export function buildStoryUrl(memoryId: string): string {
  if (host) return `https://${host}/s/${memoryId}`;
  return Linking.createURL(`/story/${memoryId}`);
}

/** Verbatim invitation copy from the MVP spec §2. Do not paraphrase. */
export const INVITE_PROMPT = 'What do you remember about this image? Add your piece of the story.';

/** The anchor question a guest lands on. */
export const GUEST_QUESTION = 'What do you remember about this photo?';
