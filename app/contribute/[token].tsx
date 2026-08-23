/**
 * Opening a memory from a link — the highest-leverage screen in the product.
 *
 * Two shapes, and which one a person gets is the owner's decision, not a setting:
 *
 *   Not published — the photo and the question, nothing else. Someone holding a link
 *   must not be able to read what the family has said in private, and that boundary is
 *   enforced on the server: `guest-memory` returns no accounts until the owner has both
 *   approved and published.
 *
 *   Published — the woven story, then every account it was woven from, each still in
 *   its author's words. The story already names these people and quotes their
 *   disagreements out loud ("Sara remembers it as 1994; Abbu places it a year
 *   earlier"), so showing the originals underneath reveals nothing it has not already
 *   said — and it is the difference between reading a summary about your family and
 *   reading your family.
 *
 * Either way the invitation is the same and always reachable: I remember this too.
 * Nothing here asks anyone to make an account.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AddYourSide } from '../../src/components/AddYourSide';
import { Button } from '../../src/components/Button';
import { Loading } from '../../src/components/chrome';
import { useToast } from '../../src/components/feedback';
import { Avatar } from '../../src/components/home-ui';
import { Icon, type IconName } from '../../src/components/icons';
import { CertaintyChip } from '../../src/components/labels';
import { EmptyState, Screen } from '../../src/components/layout';
import { PhotoPlate } from '../../src/components/PhotoPlate';
import { Text } from '../../src/components/Text';
import { repository } from '../../src/data';
import { useGuestMemory } from '../../src/hooks/repo';
import { track } from '../../src/lib/analytics';
import * as haptics from '../../src/lib/haptics';
import { GUEST_QUESTION } from '../../src/lib/links';
import { shareLink } from '../../src/lib/share';
import { useTheme } from '../../src/state/theme';
import { layout, radius, space } from '../../src/theme/tokens';

export default function Contribute() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const { data: view, loading, error, reload } = useGuestMemory(token);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [hearted, setHearted] = useState(false);
  const [thanked, setThanked] = useState(false);

  useEffect(() => {
    if (!view) return;
    track({ name: 'invite_opened' });
    track({ name: 'participant', role: 'guest' });
  }, [view]);

  if (loading) {
    return (
      <Screen>
        <Loading line="Opening the memory…" />
      </Screen>
    );
  }

  if (error || !view) {
    return (
      <Screen>
        <View style={styles.notFound}>
          <Text variant="eyebrow" tone="muted">
            Invite
          </Text>
          <Text variant="display">This link does not work</Text>
          <Text variant="body" tone="muted">
            {error ?? 'It may have expired, or the memory may have been deleted.'}
          </Text>
          <Button label="Try again" variant="outline" onPress={reload} />
        </View>
      </Screen>
    );
  }

  const story = view.publishedStory;
  const woven = story?.ownerEditedStory ?? story?.story ?? null;

  /**
   * How many accounts the story was actually woven from — which is not the same as
   * how many are listed below it.
   *
   * The moment someone adds theirs, the list grows and the narrative does not: it was
   * composed before they wrote. Counting the list would credit the story with an
   * account it has never read, and the first person to notice would be the
   * contributor themselves, looking for their own words in a paragraph that cannot
   * contain them. So the story reports its own sources, and anything newer is named
   * as newer.
   */
  const wovenFrom = story?.sourceRemarkIds.length ?? 0;
  const addedSince = Math.max(0, view.accounts.length - wovenFrom);

  /**
   * The heart is a reaction, not a like.
   *
   * `broughtBack` — "That brought back a memory" — is one of the three reactions the
   * MVP spec allows, it is already in the schema, and the endpoint already refuses it
   * on an unpublished story. A heart backed by nothing would be a decoration that
   * teaches people their tap did something.
   */
  async function heart() {
    if (hearted || !token || !story) return;
    setHearted(true);
    haptics.contributed();
    try {
      await repository().addReaction(token, 'broughtBack');
      track({ name: 'reaction', reaction: 'broughtBack' });
    } catch (e) {
      setHearted(false);
      toast(e instanceof Error ? e.message : 'That could not be saved.', 'bad');
    }
  }

  async function share() {
    const url = globalThis.location?.href ?? '';
    const outcome = await shareLink(url, `${view!.title} — add what you remember`);
    if (outcome === 'failed') toast('That could not be shared.', 'bad');
    else toast(outcome === 'copied' ? 'Link copied.' : 'Shared.', 'good');
  }

  return (
    <View style={[styles.root, { backgroundColor: c.ink }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ----------------------------------------------------- photograph */}
        <View style={styles.hero}>
          <PhotoPlate uri={view.imageUrl} aspect={1} rounded={false} />

          <View style={[styles.heroBar, { top: insets.top + space.sm }]}>
            <RoundButton icon="back" label="Go back" onPress={() => router.back()} />
            <View style={styles.grow} />
            <RoundButton icon="share" label="Share this link" onPress={share} />
            {story ? (
              <RoundButton
                icon="heart"
                label={
                  hearted
                    ? 'You said this brought back a memory'
                    : 'This brought back a memory'
                }
                onPress={heart}
                active={hearted}
              />
            ) : null}
          </View>

          {/* The design puts a "Tap photo to see who's who" pill here, driven by face
              tags. Nothing in the schema stores a tag, so there are no markers to draw
              and no honest way to invent them — the same reason the add sheet's
              "Who's in it" row says so out loud. The pill returns with the feature. */}
        </View>

        <View style={styles.body}>
          <Text variant="display">{view.title}</Text>

          {view.dateHint || view.locationHint ? (
            <View style={styles.stampRow}>
              {view.dateHint ? (
                <View style={styles.stamp}>
                  <Icon name="calendar" size={14} color={c.textMuted} />
                  <Text variant="label" tone="muted">
                    {view.dateHint}
                  </Text>
                </View>
              ) : null}
              {view.dateHint && view.locationHint ? (
                <Text variant="label" tone="muted">
                  ·
                </Text>
              ) : null}
              {view.locationHint ? (
                <View style={styles.stamp}>
                  <Icon name="pin" size={14} color={c.textMuted} />
                  <Text variant="label" tone="muted">
                    {view.locationHint}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          <View style={[styles.rule, { backgroundColor: c.hairline }]} />

          {woven ? (
            <>
              <View style={styles.sectionHead}>
                <Icon name="sparkle" size={15} color={c.accent} />
                <Text variant="eyebrow" tone="accent">
                  The family&apos;s version
                </Text>
              </View>

              <Text variant="body" style={styles.woven}>
                {woven}
              </Text>

              <Text variant="meta" tone="muted">
                {wovenFrom > 0
                  ? `Woven from ${wovenFrom} ${wovenFrom === 1 ? 'account' : 'accounts'}`
                  : 'Woven from the accounts below'}
                {' · originals kept below'}
              </Text>

              {addedSince > 0 && wovenFrom > 0 ? (
                <Text variant="meta" tone="muted">
                  {addedSince} {addedSince === 1 ? 'account was' : 'accounts were'} added
                  after this was written. The person who started it can weave it again to
                  include {addedSince === 1 ? 'it' : 'them'}.
                </Text>
              ) : null}

              <View style={[styles.rule, { backgroundColor: c.hairline }]} />

              <Text variant="uiStrong">
                {view.contributorCount}{' '}
                {view.contributorCount === 1 ? 'person remembers' : 'people remember'}{' '}
                this
              </Text>

              <View style={styles.accounts}>
                {view.accounts.map((account) => (
                  <View key={account.id} style={styles.account}>
                    <Avatar name={account.contributorName} size={38} />
                    <View style={styles.grow}>
                      <View style={styles.accountHead}>
                        <Text variant="uiStrong">{account.contributorName}</Text>
                        {account.relationship ? (
                          <Text variant="label" tone="muted">
                            {account.relationship}
                          </Text>
                        ) : null}
                        <CertaintyChip certainty={account.certainty} />
                      </View>

                      <Text variant="body" tone="muted">
                        {account.text}
                      </Text>

                      {/* The design offers "Lightly polished · view original". Here the
                          words under a name have never been touched: `remarks.body` is
                          immutable and a database trigger refuses edits to it, even
                          from the owner. There is no polished version to toggle away
                          from, and pretending otherwise would understate the promise. */}
                      <View style={styles.verbatim}>
                        <Icon name="lock" size={12} color={c.textMuted} />
                        <Text variant="meta" tone="muted">
                          Kept word for word
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <View style={styles.pending}>
              <Text variant="title">{GUEST_QUESTION}</Text>
              <Text variant="body" tone="muted">
                Anything at all — a detail, a name for something, what it sounded like.
                It is kept in your words, with your name on it.
              </Text>

              {view.contributorCount > 0 ? (
                <View style={[styles.note, { backgroundColor: c.surfaceRaised }]}>
                  <Text variant="label" tone="muted">
                    {view.contributorCount}{' '}
                    {view.contributorCount === 1 ? 'person has' : 'people have'} added
                    theirs already. You will be able to read the story here once the
                    person who started it approves and shares it.
                  </Text>
                </View>
              ) : (
                <EmptyState line="Nobody has added anything yet. Yours would be the first." />
              )}
            </View>
          )}

          {thanked ? (
            <View style={[styles.thanks, { borderColor: c.accent }]}>
              <Icon name="check" size={16} color={c.accent} />
              <Text variant="label" tone="muted" style={styles.grow}>
                Added, and attributed to you. The person who started this decides what
                goes into the final story.
              </Text>
            </View>
          ) : null}

          <Text variant="meta" tone="muted">
            Only what you write is added. TellaTale does not try to identify anyone in
            the photograph.
          </Text>
        </View>
      </ScrollView>

      {/* ------------------------------------------------------------- CTA */}
      <View
        style={[
          styles.cta,
          {
            backgroundColor: c.ink,
            borderTopColor: c.hairline,
            paddingBottom: Math.max(insets.bottom, space.base),
          },
        ]}
      >
        <Button
          label="I remember this too"
          variant="accent"
          full
          onPress={() => {
            haptics.contributed();
            setSheetOpen(true);
          }}
          accessibilityHint="Opens a sheet to add what you remember"
        />
      </View>

      <AddYourSide
        visible={sheetOpen}
        token={token}
        coverUrl={view.imageUrl}
        onClose={() => setSheetOpen(false)}
        onAdded={() => {
          setSheetOpen(false);
          setThanked(true);
          reload();
        }}
      />
    </View>
  );
}

function RoundButton({
  icon,
  label,
  onPress,
  active,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  active?: boolean;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      aria-pressed={active}
      hitSlop={8}
      style={({ pressed }) => [
        styles.round,
        // Always the light surface, never the theme's. These sit on a photograph, and
        // a dark chip on a dark photo is an invisible back button.
        { backgroundColor: '#FFFFFF' },
        pressed && { opacity: 0.85 },
      ]}
    >
      <Icon name={icon} size={18} color={active ? c.accent : '#16161A'} filled={active} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingBottom: space.xxl },
  notFound: { gap: space.md, paddingTop: space.xxl },
  hero: { position: 'relative' },
  heroBar: {
    position: 'absolute',
    left: layout.gutter,
    right: layout.gutter,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  round: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grow: { flex: 1 },
  body: { paddingHorizontal: layout.gutter, paddingTop: space.lg, gap: space.md },
  stampRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  stamp: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  rule: { height: StyleSheet.hairlineWidth, marginVertical: space.xs },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  woven: { lineHeight: 26 },
  accounts: { gap: space.lg, paddingTop: space.xs },
  account: { flexDirection: 'row', gap: space.md },
  accountHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    flexWrap: 'wrap',
  },
  verbatim: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingTop: 2 },
  pending: { gap: space.md },
  note: { borderRadius: radius.card, padding: space.base },
  thanks: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radius.button,
    padding: space.md,
  },
  cta: {
    paddingHorizontal: layout.gutter,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
