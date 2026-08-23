/**
 * The invite sheet.
 *
 * The QR is the point. Most of the people who can add to a memory are in the room
 * already — at a wedding, at a funeral, at a kitchen table with an old album open —
 * and a code someone can hold up beats a link they have to type or a contact they
 * have to find. It renders on a white plate in both themes because a dark-mode QR
 * with an inverted quiet zone is a code that half of scanners will refuse.
 *
 * The invitation wording is the MVP spec's, verbatim, and is shown here before it is
 * sent so the owner knows exactly what the other person will read.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Button } from '../../../src/components/Button';
import { Header, Loading } from '../../../src/components/chrome';
import { useToast } from '../../../src/components/feedback';
import { Icon } from '../../../src/components/icons';
import { Card, Row, Screen } from '../../../src/components/layout';
import { Text } from '../../../src/components/Text';
import { repository } from '../../../src/data';
import { useMemory } from '../../../src/hooks/repo';
import { track } from '../../../src/lib/analytics';
import { hasLinkHost, INVITE_PROMPT } from '../../../src/lib/links';
import { copyText, shareLink } from '../../../src/lib/share';
import { useTheme } from '../../../src/state/theme';
import { radius, space } from '../../../src/theme/tokens';

export default function Invite() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { c } = useTheme();
  const { data: memory, loading } = useMemory(id);

  if (loading || !memory) {
    return (
      <Screen>
        <Header onBack={() => router.back()} backIcon="close" backLabel="Close" />
        {loading ? (
          <Loading line="Loading the invite…" />
        ) : (
          <Text variant="body" tone="muted">
            That memory could not be found.
          </Text>
        )}
      </Screen>
    );
  }

  const url = repository().inviteUrl(memory);
  const message = `${memory.title}\n\n${INVITE_PROMPT}`;

  async function copy() {
    const ok = await copyText(url);
    if (ok) track({ name: 'invite_shared', channel: 'copy' });
    toast(ok ? 'Invite link copied.' : 'The link could not be copied.', ok ? 'good' : 'bad');
  }

  async function share() {
    const outcome = await shareLink(url, message);
    if (outcome !== 'failed') track({ name: 'invite_shared', channel: 'share' });
    toast(
      outcome === 'shared'
        ? 'Shared.'
        : outcome === 'copied'
          ? 'Invite copied — paste it wherever you like.'
          : 'That could not be shared.',
      outcome === 'failed' ? 'bad' : 'good'
    );
  }

  return (
    <Screen>
      <Header
        onBack={() => router.back()}
        backIcon="close"
        backLabel="Close"
        eyebrow="Invite"
        title="Ask the people who were there"
      />

      <Card>
        <View style={styles.qrBlock}>
          {/* Always light. A QR is a contrast contract, not a themed surface. */}
          <View style={styles.qrPlate}>
            <QRCode
              value={url}
              size={188}
              color="#131820"
              backgroundColor="#FFFFFF"
              quietZone={8}
              // Medium recovery: enough to survive a phone screen photographed off
              // another phone screen, without inflating the module count.
              ecl="M"
            />
          </View>
          <Text variant="meta" tone="muted" center>
            Hold this up. They point a camera at it — no app, no account.
          </Text>
        </View>
      </Card>

      <Pressable
        onPress={copy}
        accessibilityRole="button"
        accessibilityLabel={`Copy the invite link, ${url}`}
        style={({ pressed }) => [
          styles.linkRow,
          { borderColor: c.hairline, backgroundColor: c.surfaceRaised },
          pressed && { opacity: 0.8 },
        ]}
      >
        <Text variant="meta" tone="muted" numberOfLines={1} style={styles.link}>
          {url}
        </Text>
        <Icon name="link" size={18} color={c.textMuted} />
      </Pressable>

      <Row gap={space.sm}>
        <Button label="Copy link" variant="outline" onPress={copy} style={styles.half} />
        <Button label="Share" onPress={share} style={styles.half} />
      </Row>

      <Card>
        <View style={styles.previewBlock}>
          <Text variant="eyebrow" tone="muted">
            What they will read
          </Text>
          <Text variant="body">{INVITE_PROMPT}</Text>

          {/* Opening your own invite link.
              Everything a contributor sees is deliberately different from what the
              owner sees — no other contributors, no owner identity, no story unless
              it has been approved and published. That asymmetry is the product's
              central privacy claim, and until now the only way to check it was a
              second phone. This opens the contributor's screen for the same token
              this page is showing, so the claim can be verified rather than trusted. */}
          <Button
            label="Preview what they see"
            variant="outline"
            onPress={() =>
              router.push({ pathname: '/contribute/[token]', params: { token: memory.inviteToken } })
            }
            accessibilityHint="Opens the contributor's view of this memory"
          />
          <Text variant="meta" tone="muted">
            The contributor&apos;s screen, for this exact link. They never see who else
            contributed, and the story only appears once you approve and publish it.
          </Text>
        </View>
      </Card>

      {!hasLinkHost ? <NoDomainWarning /> : null}

      <Text variant="meta" tone="muted">
        Anyone holding this link can see the photo and add a memory. They cannot see
        who else contributed, edit anything, or delete anything.
      </Text>
    </Screen>
  );
}

/**
 * Without a link domain the invite falls back to the app's own URL scheme, which
 * only resolves on a device that already has TellaTale installed. Saying so here is
 * the difference between a demo that fails on stage and one that does not.
 */
function NoDomainWarning() {
  const { c } = useTheme();
  return (
    <View style={[styles.warning, { borderColor: c.warn }]}>
      <Text variant="eyebrow" tone="warn">
        This link only opens on this device
      </Text>
      <Text variant="meta" tone="muted">
        No link domain is configured, so the invite uses the app&apos;s URL scheme.
        {Platform.OS === 'web'
          ? ' Set EXPO_PUBLIC_LINK_HOST before sharing this outside the browser.'
          : ' Set EXPO_PUBLIC_LINK_HOST so guests without the app installed can open it.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  qrBlock: { alignItems: 'center', gap: space.md },
  qrPlate: {
    backgroundColor: '#FFFFFF',
    padding: space.base,
    borderRadius: radius.image,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderWidth: 1,
    borderRadius: radius.button,
    paddingHorizontal: space.md,
    minHeight: 48,
  },
  link: { flex: 1 },
  half: { flex: 1 },
  previewBlock: { gap: space.sm },
  warning: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radius.button,
    padding: space.md,
    gap: space.xs,
  },
});
