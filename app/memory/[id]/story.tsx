/**
 * The story — and the owner's control over it.
 *
 * The card and the controls are kept visually separate on purpose. Everything inside
 * the card is what other people will see; everything below the divider is the owner
 * deciding whether they ever will. Approval is a deliberate act with its own button,
 * never a side effect of editing or of navigating away, because "the application, not
 * the AI, must enforce approval" is the spec's rule and an implicit approval is not
 * enforcement.
 *
 * Owner edits are written to `ownerEditedTitle` / `ownerEditedStory` and never over
 * the model's fields. That keeps regeneration non-destructive and lets the card mark
 * itself as owner-edited honestly.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '../../../src/components/Button';
import {
  ActionBar,
  Header,
  Loading,
  SectionHead,
  Skeleton,
} from '../../../src/components/chrome';
import { useConfirm, useToast } from '../../../src/components/feedback';
import { Field } from '../../../src/components/form';
import { Icon } from '../../../src/components/icons';
import { Card, Divider, EmptyState, Row, Screen } from '../../../src/components/layout';
import { StoryCard } from '../../../src/components/StoryCard';
import { Text } from '../../../src/components/Text';
import { repository } from '../../../src/data';
import { useImageUrl, useMemory, useRemarks, useStory } from '../../../src/hooks/repo';
import { track } from '../../../src/lib/analytics';
import { buildStoryUrl } from '../../../src/lib/links';
import { copyText, shareCardImage, shareLink } from '../../../src/lib/share';
import { useTheme } from '../../../src/state/theme';
import { radius, space } from '../../../src/theme/tokens';
import { relativeTime } from '../../../src/components/labels';

export default function Story() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const { c } = useTheme();

  const { data: memory, loading: memoryLoading } = useMemory(id);
  const { data: story, loading: storyLoading } = useStory(id);
  const { data: remarks } = useRemarks(id);
  const { url: imageUrl, failed: imageFailed } = useImageUrl(memory?.imagePath);

  const cardRef = useRef<View>(null);
  const [busy, setBusy] = useState<null | 'compose' | 'approve' | 'share'>(null);
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftStory, setDraftStory] = useState('');
  const [rated, setRated] = useState(false);

  // Seed the editor from whatever the card is currently showing, so opening the
  // editor never silently discards a previous edit.
  useEffect(() => {
    if (!story) return;
    setDraftTitle(story.ownerEditedTitle ?? story.title);
    setDraftStory(story.ownerEditedStory ?? story.story);
  }, [story]);

  if (memoryLoading || storyLoading) {
    return (
      <Screen>
        <Header onBack={() => router.back()} />
        <Skeleton height={280} />
        <Skeleton height={140} />
      </Screen>
    );
  }

  if (!memory) {
    return (
      <Screen>
        <Header onBack={() => router.back()} eyebrow="Not found" title="This memory is gone" />
        <Button label="Back to your memories" onPress={() => router.replace('/')} />
      </Screen>
    );
  }

  const approved = Boolean(story?.approvedAt);
  const published = approved && memory.visibility === 'public';
  // The invite token, not the memory id: the recipient has no account, so the
  // token is the only thing that can open anything for them.
  const shareUrl = buildStoryUrl(memory.inviteToken);
  const shareMessage = `${story?.ownerEditedTitle ?? story?.title ?? memory.title}`;

  async function compose() {
    if (!id) return;
    setBusy('compose');
    try {
      const composed = await repository().composeStory(id);
      track({
        name: story ? 'story_regenerated' : 'story_composed',
        provider: composed.provider,
        remarkCount: remarks.filter((r) => r.included).length,
      });
    } catch (e) {
      toast(e instanceof Error ? e.message : 'The story could not be composed.', 'bad');
    } finally {
      setBusy(null);
    }
  }

  async function regenerate() {
    const hadEdits = Boolean(story?.ownerEditedTitle || story?.ownerEditedStory);
    if (hadEdits) {
      const ok = await confirm({
        title: 'Regenerate the story?',
        body: 'Your edits to the title and the narrative will be replaced by a fresh composition.',
        confirmLabel: 'Regenerate',
      });
      if (!ok) return;
    }
    await compose();
  }

  async function saveEdits() {
    if (!id || !story) return;
    const nextTitle = draftTitle.trim();
    const nextStory = draftStory.trim();
    if (!nextTitle || !nextStory) {
      toast('A story needs a title and some words.', 'bad');
      return;
    }
    await repository().saveOwnerEdits(id, {
      // Store null when the owner has ended up back at the composed text, so the
      // card does not claim an edit that no longer differs from it.
      title: nextTitle === story.title ? null : nextTitle,
      story: nextStory === story.story ? null : nextStory,
    });
    setEditing(false);
    toast('Saved.', 'good');
  }

  async function approve() {
    if (!id || !story) return;
    setBusy('approve');
    try {
      await repository().approveStory(id);
      track({ name: 'story_approved', remarkCount: story.sourceRemarkIds.length });
      toast('Approved. You can publish it now.', 'good');
    } finally {
      setBusy(null);
    }
  }

  async function unapprove() {
    if (!id) return;
    const ok = await confirm({
      title: 'Withdraw approval?',
      body: 'The story goes back to private and stops being visible to anyone holding the link.',
      confirmLabel: 'Withdraw',
    });
    if (!ok) return;
    await repository().unapproveStory(id);
    toast('Withdrawn. It is private again.');
  }

  async function shareCard() {
    setBusy('share');
    try {
      const outcome = await shareCardImage(cardRef, shareUrl, shareMessage);
      toast(
        outcome === 'failed' ? 'That could not be shared.' : 'Shared.',
        outcome === 'failed' ? 'bad' : 'good'
      );
    } finally {
      setBusy(null);
    }
  }

  /* ------------------------------------------------------- nothing composed */

  if (!story) {
    return (
      <Screen>
        <Header onBack={() => router.back()} eyebrow={memory.title} title="No story yet" />
        <EmptyState
          line={
            remarks.length === 0
              ? 'Nobody has added their memory yet. You can still compose — it will just be your account, on its own.'
              : `${remarks.filter((r) => r.included).length} accounts are ready to be brought together.`
          }
          action={
            <Button
              label="Create the story"
              onPress={compose}
              loading={busy === 'compose'}
            />
          }
        />
      </Screen>
    );
  }

  /* ---------------------------------------------------------------- the card */

  return (
    <Screen
      avoidKeyboard
      footer={
        <ActionBar>
          {!approved ? (
            <>
              <Button
                label="Approve this story"
                onPress={approve}
                loading={busy === 'approve'}
                full
                accessibilityHint="Nothing is visible to anyone until you approve it"
              />
              <Text variant="meta" tone="muted" center>
                Nothing is shared until you approve it.
              </Text>
            </>
          ) : (
            <Row gap={space.sm}>
              <Button
                label="Share the card"
                onPress={shareCard}
                loading={busy === 'share'}
                style={styles.grow}
              />
              <Button
                label="Link"
                variant="outline"
                onPress={async () => {
                  const outcome = await shareLink(shareUrl, shareMessage);
                  toast(
                    outcome === 'failed' ? 'That could not be shared.' : 'Link ready.',
                    outcome === 'failed' ? 'bad' : 'good'
                  );
                }}
                style={styles.half}
              />
            </Row>
          )}
        </ActionBar>
      }
    >
      <Header
        onBack={() => router.back()}
        eyebrow={approved ? (published ? 'Published' : 'Approved · private') : 'Draft — only you can see this'}
        right={
          <Text variant="meta" tone="muted">
            {relativeTime(story.generatedAt)}
          </Text>
        }
      />

      <StoryCard
        ref={cardRef}
        story={story}
        memoryType={memory.memoryType}
        imageUrl={imageUrl}
        imageFailed={imageFailed}
        dateHint={memory.dateHint}
        locationHint={memory.locationHint}
        contributorCount={story.familyPerspectives.length + 1}
      />

      <Divider />

      {/* ------------------------------------------------------ owner control */}
      <SectionHead
        label="Your call"
        note="Everything above is a draft until you say otherwise."
      />

      {editing ? (
        <Card>
          <View style={styles.editor}>
            <Field label="Title" value={draftTitle} onChangeText={setDraftTitle} maxLength={120} />
            <Field
              label="The story"
              value={draftStory}
              onChangeText={setDraftStory}
              multiline
              narrative
              maxLength={4000}
              hint="Your original memory is not editable here — it is kept exactly as you wrote it."
            />
            <Row gap={space.sm}>
              <Button
                label="Cancel"
                variant="outline"
                onPress={() => {
                  setDraftTitle(story.ownerEditedTitle ?? story.title);
                  setDraftStory(story.ownerEditedStory ?? story.story);
                  setEditing(false);
                }}
                style={styles.half}
              />
              <Button label="Save" onPress={saveEdits} style={styles.grow} />
            </Row>
          </View>
        </Card>
      ) : (
        <View style={styles.controls}>
          <ControlRow
            icon="edit"
            title="Edit the title and the story"
            body="Your original memory stays untouched."
            onPress={() => setEditing(true)}
          />
          <ControlRow
            icon="refresh"
            title="Regenerate"
            body={`Recompose from ${remarks.filter((r) => r.included).length} included ${
              remarks.filter((r) => r.included).length === 1 ? 'account' : 'accounts'
            }.`}
            onPress={regenerate}
            busy={busy === 'compose'}
          />
          <ControlRow
            icon="link"
            title="Choose who is included"
            body="Go back and include or exclude individual memories."
            onPress={() => router.push({ pathname: '/memory/[id]', params: { id } })}
          />
          {approved ? (
            <ControlRow
              icon="lock"
              title="Withdraw approval"
              body="Takes it back to private."
              onPress={unapprove}
              tone="warn"
            />
          ) : null}
        </View>
      )}

      {/* Asked once, and only after there is something to have an opinion about. */}
      {approved && !rated ? (
        <RatingRow
          onRate={(rating) => {
            track({ name: 'story_rated', rating });
            setRated(true);
            toast('Thank you.', 'good');
          }}
        />
      ) : null}

      {approved ? (
        <Card>
          <Row style={styles.visibilityRow}>
            <Icon name={published ? 'globe' : 'lock'} size={18} color={published ? c.accent : c.textMuted} />
            <Text variant="meta" tone="muted" style={styles.grow}>
              {published
                ? 'Anyone with the link can read this story.'
                : 'Approved but still private. Turn on link sharing from the memory page.'}
            </Text>
          </Row>
        </Card>
      ) : null}

      <Pressable
        onPress={async () => {
          const ok = await copyText(shareUrl);
          toast(ok ? 'Link copied.' : 'The link could not be copied.', ok ? 'good' : 'bad');
        }}
        accessibilityRole="button"
        accessibilityLabel="Copy the story link"
        style={styles.copyRow}
      >
        <Text variant="meta" tone="muted" numberOfLines={1}>
          {shareUrl}
        </Text>
      </Pressable>

      {busy === 'compose' ? <Loading line="Composing from what everyone said…" /> : null}
    </Screen>
  );
}

function ControlRow({
  icon,
  title,
  body,
  onPress,
  busy,
  tone,
}: {
  icon: 'edit' | 'refresh' | 'link' | 'lock';
  title: string;
  body: string;
  onPress: () => void;
  busy?: boolean;
  tone?: 'warn';
}) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={body}
      style={({ pressed }) => [
        styles.control,
        { borderColor: c.hairline, backgroundColor: c.surface },
        (pressed || busy) && { opacity: 0.7 },
      ]}
    >
      <Icon name={icon} size={20} color={tone === 'warn' ? c.warn : c.text} />
      <View style={styles.controlText}>
        <Text variant="ui" tone={tone === 'warn' ? 'warn' : 'default'}>
          {title}
        </Text>
        <Text variant="meta" tone="muted">
          {body}
        </Text>
      </View>
      <Icon name="chevron" size={16} color={c.textMuted} />
    </Pressable>
  );
}

/** One question, five taps, no free text. Feeds the spec's post-creation rating. */
function RatingRow({ onRate }: { onRate: (n: number) => void }) {
  const { c } = useTheme();
  const [hover, setHover] = useState(0);
  return (
    <Card>
      <View style={styles.rating}>
        <Text variant="ui">How did this turn out?</Text>
        <Row gap={space.xs}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Pressable
              key={n}
              onPress={() => onRate(n)}
              onPressIn={() => setHover(n)}
              onPressOut={() => setHover(0)}
              accessibilityRole="button"
              accessibilityLabel={`Rate ${n} out of 5`}
              hitSlop={6}
              style={styles.star}
            >
              <Icon name="star" size={26} color={c.accent} filled={n <= hover} />
            </Pressable>
          ))}
        </Row>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  editor: { gap: space.base },
  controls: { gap: space.sm },
  control: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderWidth: 1,
    borderRadius: radius.button,
    padding: space.md,
    minHeight: 64,
  },
  controlText: { flex: 1, gap: 2 },
  visibilityRow: { alignItems: 'flex-start', gap: space.md },
  rating: { gap: space.md, alignItems: 'center' },
  star: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  copyRow: { minHeight: 44, justifyContent: 'center' },
  half: { flex: 1 },
  grow: { flex: 2 },
});
