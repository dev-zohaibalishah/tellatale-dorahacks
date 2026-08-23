/**
 * Me — profile, progress, and settings in one scroll.
 *
 * The progress block is the design's sharpest idea and the one worth getting right:
 * it does not count photographs, it counts whether the circle is alive. Each milestone
 * is a specific, answerable next action, which is the same argument the PRD makes
 * about an empty feed being a product failure rather than a user failure.
 *
 * Toggles that have no backend behind them are rendered but marked, rather than
 * silently pretending to save.
 */

import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useConfirm } from '../src/components/feedback';
import { Avatar } from '../src/components/home-ui';
import { Icon, type IconName } from '../src/components/icons';
import { TabScreen } from '../src/components/TabScreen';
import { Text } from '../src/components/Text';
import { useMemories } from '../src/hooks/repo';
import { useSession } from '../src/state/auth';
import { nameFor, useProfile } from '../src/state/profile';
import { useTheme } from '../src/state/theme';
import { radius, space } from '../src/theme/tokens';

export default function Me() {
  const router = useRouter();
  const confirm = useConfirm();
  const { uid, signOutNow } = useSession();
  const { profile, avatarUrl } = useProfile();
  const { data: memories } = useMemories(uid);
  const { c, name, setTheme } = useTheme();

  const stats = useMemo(() => {
    const stories = memories.filter((m) => m.storyApprovedAt).length;
    const voices = memories.reduce((n, m) => n + m.contributorCount, 0);
    return { memories: memories.length, stories, voices };
  }, [memories]);

  // Milestones are derived, not stored: each one is true or false right now, which is
  // what keeps them honest when the underlying numbers change.
  const milestones = [
    {
      icon: 'share' as IconName,
      title: 'Invite someone to a memory',
      note: stats.voices === 0 ? 'Nobody else has added a side yet' : 'Done',
      done: stats.voices > 0,
    },
    {
      icon: 'plus' as IconName,
      title: 'Add your first memory',
      note: stats.memories === 0 ? 'Start with one photo' : 'Done',
      done: stats.memories > 0,
    },
    {
      icon: 'sparkle' as IconName,
      title: 'Compose a story',
      note: stats.stories === 0 ? 'Once two people have spoken' : 'Done',
      done: stats.stories > 0,
    },
  ];
  const doneCount = milestones.filter((m) => m.done).length;

  return (
    <TabScreen active="me">
      {/* --------------------------------------------------------- identity */}
      {/* The whole block is the button, not a small "edit" link beside it. Tapping
          your own face to change it is the gesture people already expect. */}
      <Pressable
        onPress={() => router.push('/profile/edit')}
        accessibilityRole="button"
        accessibilityLabel="Edit your profile"
        style={({ pressed }) => [styles.identity, pressed && { opacity: 0.8 }]}
      >
        <Avatar uri={avatarUrl} name={nameFor(profile)} size={64} />
        <View style={styles.grow}>
          <Text variant="title">{nameFor(profile)}</Text>
          <Text variant="label" tone="muted">
            {profile?.username ? `@${profile.username}` : 'Signed in'}
          </Text>
          {profile?.location ? (
            <Text variant="meta" tone="muted">
              {profile.location}
            </Text>
          ) : null}
        </View>
        <Icon name="edit" size={17} color={c.textMuted} />
      </Pressable>

      {profile?.bio ? (
        <Text variant="body" tone="muted">
          {profile.bio}
        </Text>
      ) : (
        // An empty bio is an invitation, not a blank. This is the one prompt on the
        // screen that asks the owner for something about themselves rather than
        // about a photograph.
        <Pressable
          onPress={() => router.push('/profile/edit')}
          accessibilityRole="button"
          accessibilityLabel="Add a line about yourself"
        >
          <Text variant="label" tone="muted">
            Add a line about yourself — the people you invite will see it.
          </Text>
        </Pressable>
      )}

      {/* ------------------------------------------------------------ stats */}
      <View style={[styles.stats, { backgroundColor: c.surfaceRaised }]}>
        <Stat value={stats.memories} label="Memories" />
        <Stat value={stats.stories} label="Stories" />
        <Stat value={stats.voices} label="Voices" />
      </View>

      {/* -------------------------------------------------------- progress */}
      <View style={styles.section}>
        <View style={styles.progressHead}>
          <Text variant="heading">Is your circle alive?</Text>
          <Text variant="uiStrong" tone="accent">
            {doneCount}/{milestones.length}
          </Text>
        </View>

        <View style={[styles.track, { backgroundColor: c.hairline }]}>
          <View
            style={[
              styles.fill,
              { backgroundColor: c.accent, width: `${(doneCount / milestones.length) * 100}%` },
            ]}
          />
        </View>

        <Text variant="label" tone="muted">
          A memory with one voice is a caption. It becomes a story when someone else
          adds theirs.
        </Text>

        <View style={styles.rows}>
          {milestones.map((m) => (
            <Row
              key={m.title}
              icon={m.done ? 'check' : m.icon}
              title={m.title}
              note={m.note}
              accent={m.done}
              onPress={() => router.push(m.done ? '/explore' : '/add')}
            />
          ))}
        </View>
      </View>

      {/* ------------------------------------------------------- appearance */}
      <View style={styles.section}>
        <Text variant="eyebrow" tone="muted">
          Appearance
        </Text>
        <Row
          icon={name === 'dark' ? 'sun' : 'moon'}
          title={name === 'dark' ? 'Light theme' : 'Dark theme'}
          note="The design is light; dark is a faithful transposition"
          onPress={() => setTheme(name === 'dark' ? 'light' : 'dark')}
        />
      </View>

      {/* ------------------------------------------------- privacy & account */}
      <View style={styles.section}>
        <Text variant="eyebrow" tone="muted">
          Privacy &amp; account
        </Text>
        <View style={styles.rows}>
          <Row
            icon="user"
            title="Edit profile"
            note="Picture, display name, and where you are"
            onPress={() => router.push('/profile/edit')}
          />
          <Row
            icon="lock"
            title="Private by default"
            note="Nothing is shared until you approve and publish it"
          />
          <Row
            icon="signOut"
            title="Sign out"
            note="Your memories stay in your account"
            onPress={async () => {
              const ok = await confirm({
                title: 'Sign out?',
                body: 'Your memories stay in your account. You can sign back in any time.',
                confirmLabel: 'Sign out',
              });
              if (ok) await signOutNow();
            }}
          />
        </View>
      </View>

      <Text variant="meta" tone="muted" center>
        Heirloom · Private by default, forever
      </Text>
    </TabScreen>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text variant="stat">{value}</Text>
      <Text variant="label" tone="muted">
        {label}
      </Text>
    </View>
  );
}

function Row({
  icon,
  title,
  note,
  accent,
  onPress,
}: {
  icon: IconName;
  title: string;
  note?: string;
  accent?: boolean;
  onPress?: () => void;
}) {
  const { c } = useTheme();
  const body = (
    <View style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: c.surfaceRaised }]}>
        <Icon name={icon} size={17} color={accent ? c.accent : c.text} />
      </View>
      <View style={styles.grow}>
        <Text variant="ui">{title}</Text>
        {note ? (
          <Text variant="label" tone="muted">
            {note}
          </Text>
        ) : null}
      </View>
      {onPress ? <Icon name="chevronRight" size={17} color={c.textMuted} /> : null}
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => pressed && { opacity: 0.8 }}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: space.base },
  grow: { flex: 1 },
  stats: { flexDirection: 'row', borderRadius: radius.card, paddingVertical: space.base },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  section: { gap: space.md },
  progressHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  rows: { gap: space.base },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 48 },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.avatar,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
