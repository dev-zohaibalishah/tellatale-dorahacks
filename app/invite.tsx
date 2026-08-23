/**
 * Invite family — the circle's own front door.
 *
 * Distinct from the per-memory invite, and the distinction is the point. A memory
 * invite says "add what you remember about this photograph" and expires into a single
 * contribution. This one says "you are part of this family's archive", and what it
 * grants is standing: you see the questions, you can answer them, you can ask your
 * own.
 *
 * The seat list below is the quiet half and the more useful one. "Zara — Cousin —
 * Invite" is a person the family knows about and has not reached, and writing her
 * down is what turns "we should get Zara on this" from a thought into something the
 * app will keep reminding you about.
 */

import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Button } from '../src/components/Button';
import { Header, Skeleton } from '../src/components/chrome';
import { useConfirm, useToast } from '../src/components/feedback';
import { Avatar } from '../src/components/home-ui';
import { Icon } from '../src/components/icons';
import { Card, Screen } from '../src/components/layout';
import { Text } from '../src/components/Text';
import { repository } from '../src/data';
import { useCircle, useMembers } from '../src/hooks/circle';
import * as haptics from '../src/lib/haptics';
import { hasLinkHost } from '../src/lib/links';
import { copyText, shareLink } from '../src/lib/share';
import { useSession } from '../src/state/auth';
import { nameFor, useProfile } from '../src/state/profile';
import { useTheme } from '../src/state/theme';
import { layout, radius, space } from '../src/theme/tokens';
import type { CircleMember } from '../src/data/repository';

/** Mirrors buildInviteUrl, for a circle rather than a memory. */
function circleUrl(token: string): string {
  if (Platform.OS === 'web' && globalThis.location) {
    return `${globalThis.location.origin}/join/${token}`;
  }
  return `tellatale://join/${token}`;
}

export default function Invite() {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const { uid } = useSession();
  const { profile } = useProfile();
  const { c } = useTheme();

  const { data: circle, loading, reload } = useCircle(uid);
  const { data: members, reload: reloadMembers } = useMembers(circle?.id);

  const [creating, setCreating] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('');

  async function createCircle() {
    if (!uid || creating) return;
    setCreating(true);
    try {
      // Named after the account holder by default — "The Nawaz Family" reads better
      // than "My Circle", and it is the first thing they will want to change.
      const suggested = `The ${nameFor(profile).split(' ').pop() ?? 'Family'} Family`;
      await repository().createCircle(uid, suggested);
      haptics.succeeded();
      reload();
    } catch (e) {
      haptics.failed();
      toast(e instanceof Error ? e.message : 'That could not be created.', 'bad');
    } finally {
      setCreating(false);
    }
  }

  async function addSeat() {
    if (!circle || !name.trim() || adding) return;
    setAdding(true);
    try {
      await repository().addMember(circle.id, name, relationship || null);
      setName('');
      setRelationship('');
      haptics.succeeded();
      reloadMembers();
    } catch (e) {
      haptics.failed();
      toast(e instanceof Error ? e.message : 'That could not be added.', 'bad');
    } finally {
      setAdding(false);
    }
  }

  if (loading) {
    return (
      <Screen>
        <Header onBack={() => router.back()} title="Invite family" />
        <Skeleton height={240} />
      </Screen>
    );
  }

  if (!circle) {
    return (
      <Screen>
        <Header
          onBack={() => router.back()}
          eyebrow="Your circle"
          title="Start the family circle"
        />
        <Text variant="body" tone="muted">
          A circle is what makes the questions work. Anyone in it can ask the family
          something and answer what others ask — and nothing else in your archive is
          shared by joining.
        </Text>
        <Button
          label="Create the circle"
          variant="accent"
          full
          loading={creating}
          onPress={createCircle}
        />
      </Screen>
    );
  }

  const url = circleUrl(circle.inviteToken);
  const joined = members.filter((m) => m.joinedAt !== null);
  const waiting = members.filter((m) => m.joinedAt === null);

  return (
    <Screen>
      <Header onBack={() => router.back()} title="Invite family" />

      <Card>
        <View style={styles.qrBlock}>
          {/* Always light, never themed. A QR is a contrast contract — a dark-mode
              code with an inverted quiet zone is one half of scanners will refuse. */}
          <View style={styles.qrPlate}>
            <QRCode value={url} size={168} color="#131820" backgroundColor="#FFFFFF" quietZone={8} ecl="M" />
          </View>

          <Text variant="heading" center>
            Add someone to {circle.name}
          </Text>
          <Text variant="meta" tone="muted" center>
            Anyone with the link can join and start adding memories.
          </Text>
        </View>
      </Card>

      <Button
        label="Copy invite link"
        variant="accent"
        full
        onPress={async () => {
          const ok = await copyText(url);
          toast(ok ? 'Invite link copied.' : 'The link could not be copied.', ok ? 'good' : 'bad');
        }}
      />
      <Button
        label="Share via…"
        variant="outline"
        full
        onPress={async () => {
          const outcome = await shareLink(url, `Join ${circle.name} on TellaTale`);
          if (outcome === 'failed') toast('That could not be shared.', 'bad');
        }}
      />

      {!hasLinkHost ? (
        <View style={[styles.warning, { borderColor: c.warn }]}>
          <Text variant="eyebrow" tone="warn">
            This link only opens on this device
          </Text>
          <Text variant="meta" tone="muted">
            No link domain is configured, so it uses the app&apos;s URL scheme. Set
            EXPO_PUBLIC_LINK_HOST before sending this to anyone.
          </Text>
        </View>
      ) : null}

      {joined.length > 0 ? (
        <>
          <Text variant="eyebrow" tone="muted">
            In {circle.name}
          </Text>
          <View style={styles.list}>
            {joined.map((member) => (
              <MemberRow key={member.id} member={member} />
            ))}
          </View>
        </>
      ) : null}

      <Text variant="eyebrow" tone="muted">
        Not in the app yet
      </Text>

      {waiting.length > 0 ? (
        <View style={styles.list}>
          {waiting.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              onInvite={async () => {
                const outcome = await shareLink(
                  url,
                  `${member.displayName} — join ${circle.name} on TellaTale`
                );
                if (outcome === 'failed') toast('That could not be shared.', 'bad');
              }}
              onRemove={async () => {
                const ok = await confirm({
                  title: `Remove ${member.displayName}?`,
                  body: 'This only removes the name from the list. Nothing they added is affected.',
                  confirmLabel: 'Remove',
                  destructive: true,
                });
                if (!ok) return;
                await repository().removeMember(member.id).catch(() => {});
                reloadMembers();
              }}
            />
          ))}
        </View>
      ) : (
        <Text variant="body" tone="muted">
          Write down the people you have not reached yet. The app will keep them on
          this list until they join.
        </Text>
      )}

      <View style={[styles.addRow, { borderColor: c.hairline }]}>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Name"
          placeholderTextColor={c.textMuted}
          maxLength={60}
          accessibilityLabel="Their name"
          style={[styles.input, { color: c.text }]}
        />
        <TextInput
          value={relationship}
          onChangeText={setRelationship}
          placeholder="Cousin"
          placeholderTextColor={c.textMuted}
          maxLength={40}
          accessibilityLabel="Their relationship"
          style={[styles.input, styles.relation, { color: c.text }]}
        />
        <Button
          label="Add"
          variant="ink"
          size="compact"
          loading={adding}
          disabled={name.trim().length === 0 || adding}
          onPress={addSeat}
        />
      </View>

      <Text variant="meta" tone="muted">
        Joining this circle lets someone see the questions and the answers to them. It
        does not give them your other memories.
      </Text>
    </Screen>
  );
}

function MemberRow({
  member,
  onInvite,
  onRemove,
}: {
  member: CircleMember;
  onInvite?: () => void;
  onRemove?: () => void;
}) {
  const { c } = useTheme();
  return (
    <View style={styles.member}>
      <Avatar name={member.displayName} size={40} />
      <View style={styles.grow}>
        <Text variant="ui">{member.displayName}</Text>
        {member.relationship ? (
          <Text variant="label" tone="muted">
            {member.relationship}
          </Text>
        ) : null}
      </View>

      {onInvite ? (
        <Button label="Invite" variant="ink" size="compact" onPress={onInvite} />
      ) : (
        <Icon name="check" size={17} color={c.textMuted} />
      )}

      {onRemove ? (
        <Pressable
          onPress={onRemove}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${member.displayName}`}
          hitSlop={8}
        >
          <Icon name="close" size={15} color={c.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  qrBlock: { alignItems: 'center', gap: space.md },
  qrPlate: { backgroundColor: '#FFFFFF', padding: space.md, borderRadius: radius.button },
  list: { gap: space.sm },
  member: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56 },
  grow: { flex: 1 },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: space.sm,
  },
  input: { flex: 2, minHeight: layout.minTouchTarget, paddingHorizontal: space.md },
  relation: { flex: 1 },
  warning: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radius.button,
    padding: space.md,
    gap: space.xs,
  },
});
