/**
 * Notifications.
 *
 * The design's footer line — "You're all caught up · max 10 a week" — is a promise,
 * not decoration. It is repeated here because an app that asks a family for their
 * memories has to be trusted not to nag them for it.
 *
 * There is no notifications table yet: pushes are sent when a guest contributes, but
 * nothing records them. So this screen shows the real, derivable events it can stand
 * behind, and says so where it cannot.
 */

import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Skeleton } from '../src/components/chrome';
import { Avatar } from '../src/components/home-ui';
import { Icon } from '../src/components/icons';
import { EmptyState } from '../src/components/layout';
import { Text } from '../src/components/Text';
import { useMemories } from '../src/hooks/repo';
import { relativeTime } from '../src/components/labels';
import { useSession } from '../src/state/auth';
import { useTheme } from '../src/state/theme';
import { layout, radius, space } from '../src/theme/tokens';

export default function Notifications() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { uid } = useSession();
  const { data: memories, loading } = useMemories(uid);
  const { c } = useTheme();

  // Every memory that has picked up a contribution is a real event we can name
  // without inventing anything: who is unknown, but that it happened is not.
  const events = memories
    .filter((m) => m.contributorCount > 0)
    .sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <View style={[styles.root, { backgroundColor: c.ink, paddingTop: insets.top }]}>
      <View style={styles.head}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
          style={[styles.backDot, { backgroundColor: c.surfaceRaised }]}
        >
          <Icon name="back" size={18} color={c.text} />
        </Pressable>
        <Text variant="heading">Notifications</Text>
      </View>

      {/* Scrollable, and it was not.
          The list lived in a plain View inside a flex:1 root, so once a person had
          more notifications than fit the screen the rest were simply unreachable —
          and the "you're all caught up" line at the bottom was unreachable with
          them. An inbox that cannot be scrolled to the end is not an inbox. */}
      <ScrollView
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + space.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <Skeleton height={72} />
        ) : events.length === 0 ? (
          <EmptyState line="Nothing yet. When someone adds their side to one of your memories, it appears here." />
        ) : (
          events.map((m) => (
            <View key={m.id}>
              <Pressable
                onPress={() => router.push({ pathname: '/memory/[id]', params: { id: m.id } })}
                accessibilityRole="button"
                accessibilityLabel={`${m.contributorCount} added to ${m.title}`}
                style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
              >
                <Avatar name={m.title} size={40} />
                <View style={styles.grow}>
                  <Text variant="ui">
                    {m.contributorCount === 1
                      ? 'Someone added their side to '
                      : `${m.contributorCount} people added their side to `}
                    <Text variant="uiStrong">“{m.title}”</Text>
                  </Text>
                  <Text variant="meta" tone="muted">
                    {relativeTime(m.updatedAt)}
                  </Text>
                </View>
                <Icon name="chevronRight" size={17} color={c.textMuted} />
              </Pressable>
              <View style={[styles.divider, { backgroundColor: c.hairline }]} />
            </View>
          ))
        )}

        <Text variant="meta" tone="muted" center style={styles.foot}>
          You&apos;re all caught up · max 10 a week
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: layout.gutter,
    paddingVertical: space.md,
  },
  backDot: {
    width: 36,
    height: 36,
    borderRadius: radius.avatar,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { paddingHorizontal: layout.gutter },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.base },
  divider: { height: StyleSheet.hairlineWidth },
  grow: { flex: 1, gap: 2 },
  foot: { paddingTop: space.xl },
});
