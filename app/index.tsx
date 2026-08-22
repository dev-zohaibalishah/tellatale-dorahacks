/**
 * The dashboard.
 *
 * Three tabs, and the split is a product statement rather than a filing system:
 *
 *   Memories        — photographs you started, and are waiting on other people for.
 *   Shared with me  — photographs someone else started that you spoke into.
 *   Collections     — groupings you made across both.
 *
 * "Shared with me" only has contents when a contributor was signed in at the time,
 * because contributing never requires an account and that is not being walked back.
 * The empty state says exactly that rather than looking broken.
 *
 * Still not a feed. Nothing here surfaces a memory you have no relationship to.
 */

import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '../src/components/Button';
import {
  ActionBar,
  Header,
  IconButton,
  Skeleton,
  StatusPill,
  type Status,
} from '../src/components/chrome';
import {
  collectionIcon,
  FilterRail,
  SearchBar,
  StatStrip,
  Tabs,
  type TabDef,
} from '../src/components/dashboard-ui';
import { useConfirm, useToast } from '../src/components/feedback';
import { Icon } from '../src/components/icons';
import { Card, EmptyState, Row, Screen } from '../src/components/layout';
import { PhotoPlate } from '../src/components/PhotoPlate';
import { Text } from '../src/components/Text';
import { repository, useLocalBackend } from '../src/data';
import type { SharedMemory } from '../src/data/repository';
import {
  useCollections,
  useDashboardSummary,
  useReloadOnFocus,
  useSharedWithMe,
} from '../src/hooks/dashboard';
import { useImageUrl, useMemories } from '../src/hooks/repo';
import { track } from '../src/lib/analytics';
import { usePushRegistration } from '../src/push/usePushRegistration';
import { useSession } from '../src/state/auth';
import { useTheme } from '../src/state/theme';
import { radius, space } from '../src/theme/tokens';
import { memoryTypeLabel, type Memory } from '../shared/story';

type Tab = 'mine' | 'shared' | 'collections';

export default function Dashboard() {
  const router = useRouter();
  const { uid, ready, username, displayName, signOutNow } = useSession();
  const { name, setTheme, c } = useTheme();
  const confirm = useConfirm();
  const toast = useToast();

  const [tab, setTab] = useState<Tab>('mine');
  const [query, setQuery] = useState('');
  const [collectionFilter, setCollectionFilter] = useState<string | null>(null);
  const [memberships, setMemberships] = useState<Record<string, string[]>>({});

  const { data: memories, loading, error } = useMemories(uid);
  const collections = useCollections(uid);
  const shared = useSharedWithMe(uid);
  const summary = useDashboardSummary(uid);

  usePushRegistration(uid);

  // Returning from the create/collection modals must not leave stale counts on screen.
  useReloadOnFocus([collections.reload, shared.reload, summary.reload]);

  useEffect(() => {
    if (ready && uid) track({ name: 'participant', role: 'owner' });
  }, [ready, uid]);

  // Membership map for the collection filter, loaded once per memory set rather than
  // per card — filtering should not fan out a query for every row on screen.
  useEffect(() => {
    if (!memories.length) return;
    let cancelled = false;
    void Promise.all(
      memories.map(
        async (m) => [m.id, await repository().collectionsForMemory(m.id)] as const
      )
    )
      .then((pairs) => {
        if (!cancelled) setMemberships(Object.fromEntries(pairs));
      })
      .catch(() => {
        /* filtering degrades to "uncategorised" rather than breaking the list */
      });
    return () => {
      cancelled = true;
    };
  }, [memories]);

  const visibleMemories = useMemo(() => {
    const q = query.trim().toLowerCase();
    return memories.filter((m) => {
      if (collectionFilter && !(memberships[m.id] ?? []).includes(collectionFilter)) {
        return false;
      }
      if (!q) return true;
      return (
        m.title.toLowerCase().includes(q) ||
        m.originalRemark.toLowerCase().includes(q) ||
        (m.locationHint ?? '').toLowerCase().includes(q) ||
        (m.dateHint ?? '').toLowerCase().includes(q)
      );
    });
  }, [memories, query, collectionFilter, memberships]);

  const visibleShared = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return shared.data;
    return shared.data.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        (m.locationHint ?? '').toLowerCase().includes(q)
    );
  }, [shared.data, query]);

  const tabs: TabDef<Tab>[] = [
    { key: 'mine', label: 'Memories', count: memories.length },
    { key: 'shared', label: 'Shared', count: shared.data.length },
    { key: 'collections', label: 'Collections', count: collections.data.length },
  ];

  const s = summary.data;

  return (
    <Screen
      footer={
        tab === 'collections' ? (
          <ActionBar>
            <Button
              label="New collection"
              variant="contribute"
              full
              onPress={() => router.push('/collection/new')}
            />
          </ActionBar>
        ) : tab === 'mine' && memories.length > 0 ? (
          <ActionBar>
            <Button
              label="Start a memory"
              variant="contribute"
              full
              onPress={() => router.push('/create')}
            />
          </ActionBar>
        ) : undefined
      }
    >
      <Header
        eyebrow={username ? `Signed in as ${username}` : 'A photograph is only half of it'}
        title={displayName ? `Hello, ${displayName}` : 'TellaTale'}
        right={
          <Row gap={space.xs}>
            <IconButton
              name={name === 'dark' ? 'sun' : 'moon'}
              label={name === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              tone="muted"
              onPress={() => setTheme(name === 'dark' ? 'light' : 'dark')}
            />
            <IconButton
              name="signOut"
              label="Sign out"
              tone="muted"
              onPress={async () => {
                const ok = await confirm({
                  title: 'Sign out?',
                  body: 'Your memories stay in your account. You can sign back in any time.',
                  confirmLabel: 'Sign out',
                });
                if (ok) await signOutNow();
              }}
            />
          </Row>
        }
      />

      {/* Voices first. A count of photographs is a storage metric, and this is not a
          storage product — the number that says whether it is working is how many
          other people have spoken. */}
      <StatStrip
        stats={[
          { label: 'Voices collected', value: s.contributorsTotal, emphasis: true },
          { label: 'Memories', value: s.memoriesOwned },
          { label: 'Stories approved', value: s.storiesApproved },
        ]}
      />

      {useLocalBackend ? <DeviceOnlyNotice /> : null}

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab !== 'collections' ? (
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder={tab === 'mine' ? 'Search your memories' : 'Search shared memories'}
        />
      ) : null}

      {tab === 'mine' && collections.data.length > 0 ? (
        <FilterRail
          options={collections.data.map((col) => ({
            key: col.id,
            label: col.name,
            kind: col.kind,
          }))}
          active={collectionFilter}
          onChange={setCollectionFilter}
        />
      ) : null}

      {/* ------------------------------------------------------------ mine */}
      {tab === 'mine' ? (
        !ready || loading ? (
          <View style={styles.list}>
            <Skeleton height={112} />
            <Skeleton height={112} />
          </View>
        ) : error ? (
          <EmptyState line={error} />
        ) : memories.length === 0 ? (
          <EmptyState
            line="Nothing here yet. A memory starts with one photo and what you remember about it — the people who were there fill in the rest."
            action={
              <Button
                label="Start a memory"
                variant="contribute"
                onPress={() => router.push('/create')}
              />
            }
          />
        ) : visibleMemories.length === 0 ? (
          <EmptyState
            line={
              collectionFilter
                ? 'Nothing in this collection yet. Open a memory to add it to one.'
                : `Nothing matches “${query.trim()}”.`
            }
          />
        ) : (
          <View style={styles.list}>
            {visibleMemories.map((memory) => (
              <MemoryRow
                key={memory.id}
                memory={memory}
                onPress={() =>
                  router.push({ pathname: '/memory/[id]', params: { id: memory.id } })
                }
              />
            ))}
          </View>
        )
      ) : null}

      {/* ---------------------------------------------------------- shared */}
      {tab === 'shared' ? (
        shared.loading ? (
          <View style={styles.list}>
            <Skeleton height={112} />
          </View>
        ) : shared.error ? (
          <EmptyState line={shared.error} />
        ) : visibleShared.length === 0 ? (
          <EmptyState line={SHARED_EMPTY} />
        ) : (
          <View style={styles.list}>
            {visibleShared.map((memory) => (
              <SharedRow key={memory.id} memory={memory} />
            ))}
          </View>
        )
      ) : null}

      {/* ----------------------------------------------------- collections */}
      {tab === 'collections' ? (
        collections.loading ? (
          <View style={styles.list}>
            <Skeleton height={72} />
            <Skeleton height={72} />
          </View>
        ) : collections.error ? (
          <EmptyState line={collections.error} />
        ) : collections.data.length === 0 ? (
          <EmptyState
            line="Collections group memories that belong together — a trip, a house, a person. A memory can sit in more than one."
            action={
              <Button
                label="New collection"
                variant="contribute"
                onPress={() => router.push('/collection/new')}
              />
            }
          />
        ) : (
          <View style={styles.list}>
            {/* The card is NOT itself a button. Wrapping the row in a Pressable and
                then nesting the delete IconButton inside it produced a <button> inside
                a <button> — invalid HTML, and ambiguous for assistive tech about what
                activating the outer control would do. Only the open target is
                pressable; the delete sits beside it as a sibling. */}
            {collections.data.map((col) => (
              <Card key={col.id}>
                <Row gap={space.md}>
                  <Pressable
                    onPress={() => {
                      setCollectionFilter(col.id);
                      setTab('mine');
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`${col.name}, ${col.memoryCount} memories`}
                    accessibilityHint="Show the memories in this collection"
                    style={({ pressed }) => [styles.colOpen, pressed && { opacity: 0.8 }]}
                  >
                    <View style={[styles.colIcon, { borderColor: c.hairline }]}>
                      <Icon name={collectionIcon(col.kind)} size={18} color={c.signal} />
                    </View>
                    <View style={styles.grow}>
                      <Text variant="heading">{col.name}</Text>
                      <Text variant="meta" tone="muted">
                        {memoryTypeLabel[col.kind]} ·{' '}
                        {col.memoryCount === 0
                          ? 'Empty'
                          : `${col.memoryCount} ${col.memoryCount === 1 ? 'memory' : 'memories'}`}
                      </Text>
                    </View>
                  </Pressable>

                  <IconButton
                    name="trash"
                    label={`Delete ${col.name}`}
                    tone="muted"
                    onPress={async () => {
                      const ok = await confirm({
                        title: `Delete “${col.name}”?`,
                        body: 'The collection goes. Every memory in it stays exactly where it is.',
                        confirmLabel: 'Delete',
                        destructive: true,
                      });
                      if (!ok) return;
                      await repository().deleteCollection(col.id);
                      collections.reload();
                      summary.reload();
                      toast('Collection deleted.');
                    }}
                  />
                </Row>
              </Card>
            ))}
          </View>
        )
      ) : null}
    </Screen>
  );
}

/* ------------------------------------------------------------------- rows */

function MemoryRow({ memory, onPress }: { memory: Memory; onPress: () => void }) {
  const { c } = useTheme();
  const url = useImageUrl(memory.imagePath);

  const meta = [
    memoryTypeLabel[memory.memoryType],
    memory.contributorCount === 0
      ? 'No one else yet'
      : `${memory.contributorCount} ${memory.contributorCount === 1 ? 'voice' : 'voices'}`,
    memory.dateHint,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={memory.title}
      accessibilityHint="Open this memory"
      style={({ pressed }) => pressed && { opacity: 0.8 }}
    >
      <Card padded={false}>
        <Row gap={0} style={styles.row}>
          <View style={styles.thumb}>
            <PhotoPlate
              uri={url}
              aspect={1}
              rounded={false}
              accessibilityLabel={`Photo for ${memory.title}`}
            />
          </View>
          <View style={styles.rowText}>
            <Text variant="heading" numberOfLines={2}>
              {memory.title}
            </Text>
            <Text variant="meta" tone="muted" numberOfLines={1}>
              {meta}
            </Text>
            <StatusPill status={statusOf(memory)} />
          </View>
          <View style={styles.chevron}>
            <Icon name="chevron" size={18} color={c.textMuted} />
          </View>
        </Row>
      </Card>
    </Pressable>
  );
}

/**
 * A memory somebody else owns. No chevron and no navigation: a contributor has no
 * owner console to open, and a tap target that leads nowhere is worse than none. What
 * they get is the record that their words are in there, and whether it went public.
 */
function SharedRow({ memory }: { memory: SharedMemory }) {
  const { c } = useTheme();
  const url = useImageUrl(memory.imagePath);
  const published = Boolean(memory.storyApprovedAt) && memory.visibility === 'public';

  return (
    <Card padded={false}>
      <Row gap={0} style={styles.row}>
        <View style={styles.thumb}>
          <PhotoPlate
            uri={url}
            aspect={1}
            rounded={false}
            accessibilityLabel={`Photo for ${memory.title}`}
          />
        </View>
        <View style={styles.rowText}>
          <Text variant="heading" numberOfLines={2}>
            {memory.title}
          </Text>
          <Text variant="meta" tone="muted" numberOfLines={1}>
            {memory.myRemarks === 1
              ? 'You added one memory'
              : `You added ${memory.myRemarks} memories`}
            {memory.contributorCount > memory.myRemarks
              ? ` · ${memory.contributorCount} voices in total`
              : ''}
          </Text>
          <Text variant="metaLabel" tone={published ? 'signal' : 'muted'}>
            {published ? 'Story published' : 'Story not shared yet'}
          </Text>
        </View>
        <View style={styles.chevron}>
          <Icon name="lock" size={16} color={c.textMuted} />
        </View>
      </Row>
    </Card>
  );
}

const SHARED_EMPTY = useLocalBackend
  ? 'Nothing shared with you. This device has no account system, so contributions cannot be linked back to you here.'
  : 'Nothing yet. When you add your memory to someone else’s photo while signed in, it appears here. Contributions made without signing in stay anonymous — that is deliberate, and it means they cannot be listed.';

function statusOf(m: Memory): Status {
  if (m.storyApprovedAt && m.visibility === 'public') return 'published';
  if (m.storyApprovedAt) return 'approved';
  if (m.contributorCount > 0) return 'collecting';
  return 'draft';
}

/**
 * Honest about where the data lives. Without a Supabase project the app runs on
 * device storage, which means an invite link cannot be opened on someone else's
 * phone — and someone demoing this needs to know that before they hand over a QR
 * code, not after.
 */
function DeviceOnlyNotice() {
  const { c } = useTheme();
  return (
    <View style={[styles.notice, { borderColor: c.hairline }]}>
      <Text variant="metaLabel" tone="muted">
        On this device only
      </Text>
      <Text variant="meta" tone="muted">
        No backend is configured, so memories are stored locally and invite links will
        not open on another phone.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.sm },
  row: { alignItems: 'stretch' },
  thumb: { width: 92 },
  rowText: { flex: 1, gap: space.xs, padding: space.md, justifyContent: 'center' },
  chevron: { justifyContent: 'center', paddingRight: space.md },
  grow: { flex: 1, gap: 2 },
  colOpen: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md },
  colIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.button,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notice: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 10,
    padding: space.md,
    gap: space.xs,
  },
});
