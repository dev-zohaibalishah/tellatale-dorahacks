/**
 * Shared with me — memories somebody else owns that you have added to.
 *
 * This existed everywhere except on screen. The migration ships a security-definer
 * `memories_shared_with_me()` that deliberately withholds `owner_id` and
 * `invite_token`, both repository adapters implement it, and the dashboard hooks call
 * it — and nothing in the app routed anywhere near any of that. A feature built down
 * to the database and never given a door.
 *
 * Two things it does not show, and both are deliberate:
 *
 *   The photograph. Storage policies scope reads to your own uid prefix, so a
 *   contributor genuinely cannot sign a URL for the owner's file. Rendering a plate
 *   here would produce a row of "could not be loaded" boxes and blame the network for
 *   a permission that is working exactly as intended. Serving these would need an
 *   Edge Function that checks contribution and signs under the service role — the
 *   same shape as `guest-memory`.
 *
 *   The owner. You know who invited you; the app does not need to confirm it, and the
 *   RPC does not return it.
 */

import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Header, Skeleton } from '../src/components/chrome';
import { Icon } from '../src/components/icons';
import { relativeTime } from '../src/components/labels';
import { EmptyState, Screen } from '../src/components/layout';
import { Text } from '../src/components/Text';
import { useSharedWithMe } from '../src/hooks/dashboard';
import { useSession } from '../src/state/auth';
import { useTheme } from '../src/state/theme';
import { radius, space } from '../src/theme/tokens';
import type { SharedMemory } from '../src/data/repository';

export default function SharedWithMe() {
  const router = useRouter();
  const { uid } = useSession();
  const { data: shared, loading, error } = useSharedWithMe(uid);

  return (
    <Screen>
      <Header
        onBack={() => router.back()}
        eyebrow="Shared with me"
        title="Memories you added to"
      />

      {loading ? (
        <View style={styles.list}>
          <Skeleton height={88} />
          <Skeleton height={88} />
        </View>
      ) : error ? (
        <Text variant="body" tone="muted">
          {error}
        </Text>
      ) : shared.length === 0 ? (
        <EmptyState
          line="Nothing yet. When you open someone's invite link while signed in, their memory is listed here so you can find your way back to what you wrote."
        />
      ) : (
        <View style={styles.list}>
          {shared.map((m) => (
            <Card key={m.id} memory={m} />
          ))}
        </View>
      )}

      <Text variant="meta" tone="muted">
        Only memories you contributed to while signed in appear here. Anything added
        anonymously stays anonymous — including to you.
      </Text>
    </Screen>
  );
}

function Card({ memory }: { memory: SharedMemory }) {
  const { c } = useTheme();

  const stamp = [memory.dateHint, memory.locationHint].filter(Boolean).join(' · ');
  const published = Boolean(memory.storyApprovedAt) && memory.visibility === 'public';

  return (
    <View style={[styles.card, { backgroundColor: c.surfaceRaised }]}>
      <View style={styles.cardHead}>
        <View style={styles.grow}>
          <Text variant="heading" numberOfLines={2}>
            {memory.title}
          </Text>
          {stamp ? (
            <Text variant="label" tone="muted">
              {stamp}
            </Text>
          ) : null}
        </View>
        <Icon name={published ? 'globe' : 'lock'} size={16} color={c.textMuted} />
      </View>

      <View style={styles.meta}>
        <Text variant="meta" tone="muted">
          {memory.myRemarks} {memory.myRemarks === 1 ? 'memory' : 'memories'} from you
          {memory.contributorCount > memory.myRemarks
            ? ` · ${memory.contributorCount} in total`
            : ''}
        </Text>
        {memory.lastContributedAt ? (
          <Text variant="meta" tone="muted">
            You added yours {relativeTime(memory.lastContributedAt)}
          </Text>
        ) : null}
      </View>

      <Text variant="meta" tone="muted">
        {published
          ? 'The owner has published the story.'
          : 'The owner has not published a story yet.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.md },
  card: { borderRadius: radius.card, padding: space.base, gap: space.sm },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  grow: { flex: 1, gap: 2 },
  meta: { gap: 2 },
});
