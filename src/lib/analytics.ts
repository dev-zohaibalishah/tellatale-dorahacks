/**
 * Event tracking for the six metrics the MVP spec says to track, and nothing else.
 *
 * The spec is explicit that only the metrics proving the core loop matter, so this
 * deliberately has no generic screen-view firehose. Each event below maps to one row
 * of the success-metrics table:
 *
 *   participant           → registered or guest participants
 *   story_approved        → completed story cards + owner approval rate
 *   remark_added          → average contributors per card
 *   invite_opened         → denominator for invite-to-contribution conversion
 *   story_rated           → user rating after story creation
 *
 * The sink is pluggable. Until one is registered, events are buffered locally so a
 * demo run is still measurable after the fact — no vendor, no network, no consent
 * problem. Nothing here ever carries remark text, contributor names, or image data.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export type AnalyticsEvent =
  | { name: 'participant'; role: 'owner' | 'guest' }
  | { name: 'memory_created'; memoryType: string }
  | { name: 'invite_shared'; channel: 'copy' | 'share' | 'qr' }
  | { name: 'invite_opened' }
  | { name: 'remark_added'; certainty: string }
  | { name: 'story_composed'; provider: string; remarkCount: number }
  | { name: 'story_regenerated' }
  | { name: 'story_approved'; remarkCount: number }
  | { name: 'story_published' }
  | { name: 'story_rated'; rating: number }
  | { name: 'reaction'; reaction: string };

type Sink = (event: AnalyticsEvent, at: number) => void;

const KEY = 'tellatale.analytics.v1';
const MAX_BUFFERED = 500;

let sink: Sink | null = null;

/** Point events at a real destination. Call once, at startup, if one exists. */
export function registerSink(fn: Sink) {
  sink = fn;
}

export function track(event: AnalyticsEvent) {
  const at = Date.now();
  if (sink) {
    try {
      sink(event, at);
    } catch {
      // Analytics must never be able to break a user action.
    }
    return;
  }
  buffer(event, at);
}

/**
 * Writes are serialised through this chain.
 *
 * Buffering is read-modify-write against a single key, and two events fired in the
 * same tick — which is exactly what the guest screen does, `invite_opened` alongside
 * `participant` — both read the same snapshot and the second write silently drops the
 * first. That failure is invisible until you go looking for a conversion number that
 * is missing its denominator.
 */
let queue: Promise<void> = Promise.resolve();

function buffer(event: AnalyticsEvent, at: number) {
  queue = queue.then(async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      const rows: unknown[] = raw ? JSON.parse(raw) : [];
      rows.push({ ...event, at });
      // Bounded — a long demo session must not grow storage without limit.
      await AsyncStorage.setItem(KEY, JSON.stringify(rows.slice(-MAX_BUFFERED)));
    } catch {
      // Ignore — a failed write must not break the chain for later events.
    }
  });
}

/** Everything captured so far, for reading off the funnel after a test session. */
export async function drain(): Promise<Array<AnalyticsEvent & { at: number }>> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
