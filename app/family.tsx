/**
 * Family — two tabs, and the split is the point.
 *
 *   People We Tag — everyone who appears in the photos, whether or not they use the
 *                   app. Nani does not need an account to be the most-photographed
 *                   person in the archive.
 *   In The App    — who actually joined, and who was invited and has not.
 *
 * Neither list exists in the schema yet. Rather than mock them, this shows what the
 * app genuinely knows — the contributors on your memories — and says plainly what is
 * still to come. Fake relatives on a family screen would be the worst possible place
 * to invent data.
 */

import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '../src/components/Button';
import { Skeleton } from '../src/components/chrome';
import { Avatar } from '../src/components/home-ui';
import { Icon } from '../src/components/icons';
import { EmptyState } from '../src/components/layout';
import { TabScreen } from '../src/components/TabScreen';
import { Text } from '../src/components/Text';
import { useMemories } from '../src/hooks/repo';
import * as haptics from '../src/lib/haptics';
import { useSession } from '../src/state/auth';
import { useTheme } from '../src/state/theme';
import { radius, space } from '../src/theme/tokens';

type Tab = 'tagged' | 'inApp';

export default function Family() {
  const { uid, displayName, username } = useSession();
  const { data: memories, loading } = useMemories(uid);
  const { c } = useTheme();
  const [tab, setTab] = useState<Tab>('tagged');

  const totalContributions = useMemo(
    () => memories.reduce((n, m) => n + m.contributorCount, 0),
    [memories]
  );

  return (
    <TabScreen active="family">
      <View style={styles.head}>
        <Text variant="title">Family</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Search family" hitSlop={8}>
          <View style={[styles.searchDot, { backgroundColor: c.surfaceRaised }]}>
            <Icon name="search" size={17} color={c.text} />
          </View>
        </Pressable>
      </View>

      <View style={styles.tabs}>
        <TabLink label="People We Tag" active={tab === 'tagged'} onPress={() => setTab('tagged')} />
        <TabLink label="In The App" active={tab === 'inApp'} onPress={() => setTab('inApp')} />
      </View>

      {loading ? (
        <Skeleton height={160} />
      ) : tab === 'tagged' ? (
        <>
          <Text variant="body" tone="muted">
            Everyone who appears in your photos — whether they use the app or not.
          </Text>

          {/* Face tagging is designed but not yet in the schema, so the only person
              this screen can name truthfully is the account holder. */}
          <View style={styles.grid}>
            <PersonTile
              name={displayName ?? username ?? 'You'}
              relation="You"
              count={memories.length}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add person"
              style={styles.tile}
            >
              <View style={[styles.addCircle, { borderColor: c.hairline }]}>
                <Icon name="plus" size={22} color={c.textMuted} />
              </View>
              <Text variant="label" tone="muted">
                Add person
              </Text>
            </Pressable>
          </View>

          <View style={[styles.note, { backgroundColor: c.surfaceRaised }]}>
            <Text variant="label" tone="muted">
              Tagging faces in photos is not built yet. Once it is, everyone in your
              archive appears here with the number of memories they are in — including
              relatives who never install the app.
            </Text>
          </View>
        </>
      ) : (
        <>
          <View style={[styles.joinRow, { backgroundColor: c.surfaceRaised }]}>
            <View style={styles.grow}>
              <Text variant="heading">
                {totalContributions === 0
                  ? 'Nobody else yet'
                  : `${totalContributions} ${totalContributions === 1 ? 'contribution' : 'contributions'} so far`}
              </Text>
              <Text variant="label" tone="muted">
                {totalContributions === 0
                  ? 'Share a memory to bring someone in'
                  : 'From people you invited'}
              </Text>
            </View>
            <Button label="Invite" size="compact" onPress={() => { /* per-memory invite */ }} />
          </View>

          <EmptyState
            line="A shared member list needs circles, which are not modelled yet. Today, people are invited per memory — open a memory and share its link or QR."
          />
        </>
      )}
    </TabScreen>
  );
}

function PersonTile({
  name,
  relation,
  count,
}: {
  name: string;
  relation: string;
  count: number;
}) {
  return (
    <View style={styles.tile}>
      <Avatar name={name} size={72} />
      <Text variant="heading">{name}</Text>
      <Text variant="label" tone="muted">
        {relation}
      </Text>
      <Text variant="label" tone="muted">
        {count} {count === 1 ? 'memory' : 'memories'}
      </Text>
    </View>
  );
}

function TabLink({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={() => {
        if (!active) haptics.selected();
        onPress();
      }}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={[styles.tabLink, active && { borderBottomColor: c.text }]}
    >
      <Text variant="uiStrong" tone={active ? 'default' : 'muted'}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  searchDot: {
    width: 38,
    height: 38,
    borderRadius: radius.avatar,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabs: { flexDirection: 'row', gap: space.lg },
  tabLink: { paddingBottom: space.sm, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.lg, columnGap: space.base },
  tile: { width: '30%', alignItems: 'center', gap: 3 },
  addCircle: {
    width: 72,
    height: 72,
    borderRadius: radius.avatar,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  note: { borderRadius: radius.card, padding: space.base },
  joinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderRadius: radius.card,
    padding: space.base,
  },
  grow: { flex: 1 },
});
