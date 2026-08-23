/**
 * Notifications.
 *
 * This screen used to derive its contents from the memory list: every memory whose
 * contributor count was above zero became one row. That was not a feed of events, it
 * was a feed of *memories that have had events*, and the difference showed. Three
 * people adding to the same photograph produced one line. A fourth changed nothing
 * visible. The time shown was the memory's `updated_at`, which moves when the owner
 * flips a toggle and has nothing to do with anyone contributing. Nothing could be
 * marked read, because there was nothing to mark.
 *
 * It now reads `public.notifications`, which database triggers write when a remark or
 * a reaction lands — under the service role for guests, under the contributor for
 * signed-in ones, from one trigger either way.
 *
 * The footer promise — "max 10 a week" — is about push, and it is a real constraint on
 * a product that asks a family for their memories. This list is the archive of what
 * happened; it does not throttle, because looking is not being interrupted.
 */

import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Skeleton } from '../src/components/chrome';
import { Avatar } from '../src/components/home-ui';
import { Icon, type IconName } from '../src/components/icons';
import { relativeTime } from '../src/components/labels';
import { EmptyState } from '../src/components/layout';
import { Text } from '../src/components/Text';
import { repository } from '../src/data';
import { useMemories, useNotifications } from '../src/hooks/repo';
import { useSession } from '../src/state/auth';
import { useTheme } from '../src/state/theme';
import { layout, radius, space } from '../src/theme/tokens';
import type { AppNotification } from '../src/data/repository';
import { reactionLabel, type Reaction } from '../shared/story';

/** Yesterday, this week, earlier — the only groups a list this size earns. */
function bucketOf(createdAt: number, now: number): string {
  const day = 86_400_000;
  const age = now - createdAt;
  if (age < day) return 'Today';
  if (age < 2 * day) return 'Yesterday';
  if (age < 7 * day) return 'This week';
  return 'Earlier';
}

export default function Notifications() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { uid } = useSession();
  const { c } = useTheme();

  const { data: items, loading, error } = useNotifications(uid);
  // Titles are not denormalised onto the notification row. The owner's memory list is
  // already loaded and watched, so it is the cheapest place to resolve them, and it
  // stays correct when a memory is renamed.
  const { data: memories } = useMemories(uid);

  const titleFor = useMemo(() => {
    const map = new Map(memories.map((m) => [m.id, m.title]));
    return (id: string) => map.get(id) ?? 'a memory';
  }, [memories]);

  const unread = items.filter((n) => n.readAt === null).length;

  /**
   * Mark read on the way out, not on arrival.
   *
   * Clearing the moment the screen mounts means the unread markers vanish under the
   * reader's eyes before they have found which rows were new — the badge is spent on
   * nothing. Marking on unmount leaves them visible for the whole visit and clears
   * them for next time.
   */
  const hasUnread = useRef(false);
  hasUnread.current = unread > 0;

  useEffect(() => {
    return () => {
      if (hasUnread.current) {
        void repository().markNotificationsRead().catch(() => {});
      }
    };
  }, []);

  const grouped = useMemo(() => {
    const now = Date.now();
    const out: { label: string; rows: AppNotification[] }[] = [];
    for (const n of items) {
      const label = bucketOf(n.createdAt, now);
      const last = out[out.length - 1];
      if (last && last.label === label) last.rows.push(n);
      else out.push({ label, rows: [n] });
    }
    return out;
  }, [items]);

  const open = useCallback(
    (n: AppNotification) => {
      router.push({ pathname: '/memory/[id]', params: { id: n.memoryId } });
    },
    [router]
  );

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
        <View style={styles.grow}>
          <Text variant="heading">Notifications</Text>
          {unread > 0 ? (
            <Text variant="meta" tone="accent">
              {unread} new
            </Text>
          ) : null}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + space.xl }]}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.loadingStack}>
            <Skeleton height={72} />
            <Skeleton height={72} />
          </View>
        ) : error ? (
          <Text variant="body" tone="muted">
            {error}
          </Text>
        ) : items.length === 0 ? (
          <EmptyState line="Nothing yet. When someone opens one of your invite links and adds what they remember, it appears here." />
        ) : (
          grouped.map((group) => (
            <View key={group.label} style={styles.group}>
              <Text variant="eyebrow" tone="muted">
                {group.label}
              </Text>
              {group.rows.map((n) => (
                <NotificationRow
                  key={n.id}
                  notification={n}
                  memoryTitle={titleFor(n.memoryId)}
                  onPress={() => open(n)}
                />
              ))}
            </View>
          ))
        )}

        <Text variant="meta" tone="muted" center style={styles.foot}>
          You&apos;re all caught up · max 10 pushes a week
        </Text>
      </ScrollView>
    </View>
  );
}

/* ------------------------------------------------------------------- row */

function iconFor(kind: AppNotification['kind']): IconName {
  return kind === 'reaction_added' ? 'star' : 'comment';
}

/** Reaction previews arrive as the enum value; say them the way the product does. */
function describe(n: AppNotification, memoryTitle: string): string {
  if (n.kind === 'reaction_added') {
    const label = n.preview
      ? (reactionLabel[n.preview as Reaction] ?? 'reacted')
      : 'reacted';
    return `Someone read “${memoryTitle}” — ${label.toLowerCase()}`;
  }
  const who = n.actorName?.trim() || 'Someone';
  return `${who} added their side to “${memoryTitle}”`;
}

function NotificationRow({
  notification: n,
  memoryTitle,
  onPress,
}: {
  notification: AppNotification;
  memoryTitle: string;
  onPress: () => void;
}) {
  const { c } = useTheme();
  const unread = n.readAt === null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${describe(n, memoryTitle)}${unread ? ', unread' : ''}`}
      accessibilityHint="Open this memory"
      style={({ pressed }) => [
        styles.row,
        // The unread tint is the whole row, not a dot. A dot is easy to miss on a
        // phone held at arm's length, which is how most of these get read.
        unread && { backgroundColor: c.surfaceRaised },
        pressed && { opacity: 0.85 },
      ]}
    >
      <View style={styles.avatarWrap}>
        <Avatar name={n.kind === 'remark_added' ? n.actorName : null} size={40} />
        <View
          style={[
            styles.kindDot,
            { backgroundColor: c.surface, borderColor: c.hairline },
          ]}
        >
          <Icon name={iconFor(n.kind)} size={11} color={c.textMuted} />
        </View>
      </View>

      <View style={styles.grow}>
        <Text variant="ui">{describe(n, memoryTitle)}</Text>

        {n.kind === 'remark_added' && n.preview ? (
          // Their words, marked as a quote. This is the whole reason to open the app.
          <Text
            variant="body"
            tone="muted"
            numberOfLines={2}
            style={[styles.quote, { borderLeftColor: c.hairline }]}
          >
            {n.preview}
          </Text>
        ) : null}

        <Text variant="meta" tone="muted">
          {relativeTime(n.createdAt)}
        </Text>
      </View>

      {unread ? <View style={[styles.unreadDot, { backgroundColor: c.accent }]} /> : null}
      <Icon name="chevronRight" size={17} color={c.textMuted} />
    </Pressable>
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
  list: { paddingHorizontal: layout.gutter, gap: space.lg },
  loadingStack: { gap: space.md },
  group: { gap: space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.card,
    minHeight: 64,
  },
  avatarWrap: { width: 40, height: 40 },
  kindDot: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grow: { flex: 1, gap: 3 },
  quote: { paddingLeft: space.sm, borderLeftWidth: 2 },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  foot: { paddingTop: space.lg },
});
