/**
 * Home — the Figma's first screen behind the tab bar.
 *
 * Reading order is the argument: greeting, circle name, a question, the compose bar,
 * what needs doing, a waiting request, and only then the feed. Someone opening the app
 * is invited to contribute three times before they are handed anything to scroll.
 *
 * Data is real where the backend has it and honestly absent where it does not — the
 * design shows Requests, Tag faces and Flashbacks counts that nothing populates yet,
 * so those chips are present but carry no invented numbers. See the notes by
 * `todoCounts`.
 */

import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '../src/components/Button';
import { Skeleton } from '../src/components/chrome';
import {
  Avatar,
  ComposeBar,
  FeedFilterRow,
  type FeedFilterKey,
  SectionRow,
  TodoChip,
} from '../src/components/home-ui';
import { Icon } from '../src/components/icons';
import { EmptyState } from '../src/components/layout';
import { MemoryFeedCard } from '../src/components/MemoryFeedCard';
import { TabBar, type TabKey } from '../src/components/TabBar';
import { Text } from '../src/components/Text';
import { useLocalBackend } from '../src/data';
import { useImageUrl, useMemories, useNotifications } from '../src/hooks/repo';
import { track } from '../src/lib/analytics';
import { usePushRegistration } from '../src/push/usePushRegistration';
import { useSession } from '../src/state/auth';
import { nameFor, useProfile } from '../src/state/profile';
import { useTheme } from '../src/state/theme';
import { layout, space } from '../src/theme/tokens';
import { type Memory } from '../shared/story';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

/** "Aug 1994" / "1979" — the design never shows a full date. */
function formatWhen(memory: Memory): string | null {
  return memory.dateHint?.trim() || null;
}

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { uid, ready } = useSession();
  const { profile, avatarUrl } = useProfile();
  const { c } = useTheme();

  const { data: memories, loading } = useMemories(uid);
  const { data: notifications } = useNotifications(uid);
  usePushRegistration(uid);

  const [tab, setTab] = useState<TabKey>('home');
  const [filter, setFilter] = useState<FeedFilterKey>('all');

  useEffect(() => {
    if (ready && uid) track({ name: 'participant', role: 'owner' });
  }, [ready, uid]);

  // Tabs other than Home are separate routes; selecting one navigates and leaves this
  // screen's own tab state on 'home' so returning does not land somewhere unexpected.
  function selectTab(next: TabKey) {
    if (next === 'home') return;
    setTab('home');
    router.push(next === 'explore' ? '/explore' : next === 'people' ? '/people' : '/me');
  }

  const totalContributors = useMemo(
    () => memories.reduce((n, m) => n + m.contributorCount, 0),
    [memories]
  );

  // Private and public are the only two states a memory has, so the counts are a
  // partition of the list rather than three independent queries.
  const counts = useMemo(() => {
    const publicCount = memories.filter((m) => m.visibility === 'public').length;
    return {
      all: memories.length,
      private: memories.length - publicCount,
      public: publicCount,
    };
  }, [memories]);

  const shown = useMemo(() => {
    if (filter === 'all') return memories;
    return memories.filter((m) =>
      filter === 'public' ? m.visibility === 'public' : m.visibility !== 'public'
    );
  }, [memories, filter]);

  const unreadCount = notifications.filter((n) => n.readAt === null).length;
  const firstName = nameFor(profile).split(' ')[0];

  return (
    <View style={[styles.root, { backgroundColor: c.ink }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + space.md, paddingBottom: layout.tabBar + space.xxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ------------------------------------------------------- greeting */}
        <View style={styles.topRow}>
          <View style={styles.grow}>
            <Text variant="label" tone="muted">
              {greeting()}
            </Text>
            <Text variant="heading">{firstName ? `Hey ${firstName}` : 'Hey there'}</Text>
          </View>

          <Pressable
            onPress={() => router.push('/notifications')}
            accessibilityRole="button"
            accessibilityLabel={
              unreadCount > 0
                ? `Notifications, ${unreadCount} unread`
                : 'Notifications'
            }
            hitSlop={8}
            style={styles.bell}
          >
            <Icon name="bell" size={22} color={c.text} />
            {/* A count, not just a dot. "Someone added something" and "four people
                did" are different enough to be worth the pixels — and this is the
                number the whole product is trying to move. */}
            {unreadCount > 0 ? (
              <View style={[styles.badge, { backgroundColor: c.accent, borderColor: c.ink }]}>
                <Text variant="meta" style={{ color: c.onAccent, fontSize: 10 }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Text>
              </View>
            ) : null}
          </Pressable>

          <Pressable
            onPress={() => router.push('/me')}
            accessibilityRole="button"
            accessibilityLabel="Your profile"
          >
            <Avatar uri={avatarUrl} name={nameFor(profile)} size={38} />
          </Pressable>
        </View>

        {/* ------------------------------------------------- circle + prompt */}
        <View style={styles.promptBlock}>
          <Text variant="eyebrow" tone="muted">
            Your circle
          </Text>
          <Text variant="title">What will you remember today?</Text>
        </View>

        <ComposeBar onPress={() => router.push('/add')} />

        {/* --------------------------------------------------- things to do */}
        <View style={styles.section}>
          <SectionRow title="Things to do" onAction={() => router.push('/me')} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.todoRow}
          >
            <TodoChip
              icon="comment"
              label="Requests"
              dot={false}
              onPress={() => router.push('/notifications')}
            />
            <TodoChip icon="tag" label="Tag faces" onPress={() => router.push('/people')} />
            <TodoChip icon="sparkle" label="Flashbacks" onPress={() => router.push('/explore')} />
          </ScrollView>

          {/* A second layer, and a different job. The row above navigates away; this
              one changes what the feed below shows and stays where it is. */}
          <FeedFilterRow active={filter} counts={counts} onChange={setFilter} />
        </View>

        {/* ------------------------------------------------ waiting question
            Memory Requests are designed but not yet in the schema, so this only
            appears once there is a real one to show. Rendering a placeholder here
            would be inventing family activity, which is the one thing this product
            must never do. */}

        {/* --------------------------------------------------------- feed */}
        <View style={styles.section}>
          <SectionRow
            title="Recently added"
            onAction={memories.length > 0 ? () => router.push('/explore') : undefined}
          />

          {!ready || loading ? (
            <View style={styles.feed}>
              <Skeleton height={240} />
              <Skeleton height={240} />
            </View>
          ) : memories.length === 0 ? (
            <EmptyState
              line="Nothing here yet. A memory starts with one photo and what you remember about it — the people who were there fill in the rest."
              action={
                <Button label="Add a memory" onPress={() => router.push('/add')} />
              }
            />
          ) : shown.length === 0 ? (
            // The archive is not empty; this filter is. Saying so — rather than
            // reusing the "add your first memory" copy — is the difference between
            // a filter and a bug.
            <EmptyState
              line={
                filter === 'public'
                  ? 'None of your memories are public yet. Approve a story, then turn on link sharing to publish it.'
                  : 'Every one of your memories is public. Nothing is being kept private right now.'
              }
            />
          ) : (
            <View style={styles.feed}>
              {shown.map((memory) => (
                <FeedRow key={memory.id} memory={memory} authorName={firstName || 'You'} />
              ))}
            </View>
          )}
        </View>

        {useLocalBackend ? (
          <Text variant="meta" tone="muted" center>
            On this device only — no backend configured.
          </Text>
        ) : totalContributors === 0 && memories.length > 0 ? (
          <Text variant="meta" tone="muted" center>
            Nobody else has added their side yet. Share a memory to change that.
          </Text>
        ) : null}
      </ScrollView>

      <TabBar
        active={tab}
        onSelect={selectTab}
        onAdd={() => router.push('/add')}
      />
    </View>
  );
}

/** Split out so each card can resolve its own signed image URL. */
function FeedRow({ memory, authorName }: { memory: Memory; authorName: string }) {
  const router = useRouter();
  const { url, failed } = useImageUrl(memory.imagePath);

  // The design shows contributor avatars. Remarks are not loaded on this screen, so
  // the count drives how many placeholders appear rather than inventing identities.
  const contributors = Array.from({ length: Math.min(memory.contributorCount, 3) }).map(
    () => ({ name: null, uri: null })
  );

  return (
    <MemoryFeedCard
      title={memory.title}
      imageUrl={url}
      imageFailed={failed}
      when={formatWhen(memory)}
      where={memory.locationHint}
      authorName={authorName}
      contributors={contributors}
      contributorCount={memory.contributorCount}
      onPress={() => router.push({ pathname: '/memory/[id]', params: { id: memory.id } })}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: layout.gutter, gap: space.lg },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  grow: { flex: 1 },
  bell: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: 4,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promptBlock: { gap: space.sm },
  section: { gap: space.md },
  todoRow: { gap: space.sm, paddingVertical: 2 },
  feed: { gap: space.xl },
});
