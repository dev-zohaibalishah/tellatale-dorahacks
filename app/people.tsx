/**
 * People — two tabs, and the split is the point.
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

import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
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
import { nameFor, useProfile } from '../src/state/profile';
import { useTheme } from '../src/state/theme';
import { radius, space } from '../src/theme/tokens';

type Tab = 'tagged' | 'inApp';

export default function People() {
  const router = useRouter();
  const { uid } = useSession();
  const { profile, avatarUrl } = useProfile();
  const { data: memories, loading } = useMemories(uid);
  const { c } = useTheme();
  const [tab, setTab] = useState<Tab>('tagged');

  const totalContributions = useMemo(
    () => memories.reduce((n, m) => n + m.contributorCount, 0),
    [memories]
  );

  /**
   * Inviting is per-memory, because a contribution is always about one photograph.
   * So "invite someone" means "pick a memory to invite them to" — and when there is
   * an obvious one, skip the picking. `useMemories` sorts newest first, so the most
   * recent memory is the one they were most likely just looking at.
   */
  const inviteSomeone = useCallback(() => {
    const newest = memories[0];
    if (newest) {
      router.push({ pathname: '/memory/[id]/invite', params: { id: newest.id } });
    } else {
      // Nothing to invite anyone to yet. Sending them to an empty picker would be a
      // dead end; sending them to the composer is the actual next step.
      router.push('/add');
    }
  }, [memories, router]);

  return (
    <TabScreen active="people">
      {/* The design has a search control here. There is nothing to search: the only
          name this screen can state truthfully is the account holder's, because face
          tagging is not in the schema. A magnifier that opens nothing is a promise
          the screen cannot keep, so it is not drawn. */}
      <View style={styles.head}>
        <Text variant="title">People</Text>
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
              name={nameFor(profile)}
              avatarUri={avatarUrl}
              relation="You"
              count={memories.length}
            />
            {/* Was a dead tile: rendered as a button, wired to nothing. The one
                honest way to "add a person" today is to invite them to a memory. */}
            <Pressable
              onPress={inviteSomeone}
              accessibilityRole="button"
              accessibilityLabel="Invite someone to a memory"
              style={({ pressed }) => [styles.tile, pressed && { opacity: 0.8 }]}
            >
              <View style={[styles.addCircle, { borderColor: c.hairline }]}>
                <Icon name="plus" size={22} color={c.textMuted} />
              </View>
              <Text variant="label" tone="muted">
                Invite someone
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
            <Button label="Invite" size="compact" onPress={inviteSomeone} />
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
  avatarUri,
  relation,
  count,
}: {
  name: string;
  avatarUri?: string | null;
  relation: string;
  count: number;
}) {
  return (
    <View style={styles.tile}>
      <Avatar uri={avatarUri} name={name} size={72} />
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
