/**
 * Haptics.
 *
 * Same discipline as the reserved orange in the design tokens: this is spent on
 * meaning, not sprinkled on every touch. A phone that buzzes at every tap teaches
 * people to stop noticing it, which wastes the one channel that can say "that
 * mattered" without a word on screen.
 *
 * What earns a haptic:
 *   • contributing — posting a memory, adding your side, approving a story
 *   • an outcome — success or failure of something the user committed to
 *   • a discrete choice landing — picking a certainty, ticking consent
 *
 * What does not: navigation, scrolling, opening a sheet, typing, secondary buttons.
 *
 * Every call is fire-and-forget and swallows its errors. A device with no haptic
 * engine, a denied vibrate permission, or a web browser must degrade to silence and
 * never break the interaction it was decorating.
 */

import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/** expo-haptics is a no-op on web, but skipping the call avoids the round trip. */
const enabled = Platform.OS === 'ios' || Platform.OS === 'android';

function safe(run: () => Promise<void>): void {
  if (!enabled) return;
  void run().catch(() => {
    // No haptic engine, or VIBRATE not granted. Nothing to recover from.
  });
}

/**
 * A contribution landed — a memory posted, a remark added, a story approved.
 * Medium rather than heavy: this is a confirmation, not an alarm.
 */
export function contributed(): void {
  safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
}

/** Something the user committed to worked. */
export function succeeded(): void {
  safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

/** Something the user committed to failed. Paired with a message — never alone. */
export function failed(): void {
  safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
}

/** A reversible warning: a destructive confirm opening, a limit reached. */
export function warned(): void {
  safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
}

/** A discrete choice landed — a certainty picked, a collection toggled. */
export function selected(): void {
  safe(() => Haptics.selectionAsync());
}

/** A light tick for a primary action that is not itself a contribution. */
export function pressed(): void {
  safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}
