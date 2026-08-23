/**
 * The memory page — the owner's console for one photograph.
 *
 * Order is the argument. The owner's own words sit directly under the image, marked
 * and immovable, before anything anyone else said and long before anything the model
 * produced. A reader scrolling this page meets the account of the person who was
 * there first, every time.
 *
 * Everything on this page that changes what the story will say — including or
 * excluding a remark, deleting one — is the owner's, and none of it is destructive by
 * accident: exclusion is reversible and visible, deletion asks first.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '../../../src/components/Button';
import {
  ActionBar,
  Header,
  IconButton,
  Loading,
  SectionHead,
  Skeleton,
  StatusPill,
  ToggleRow,
} from '../../../src/components/chrome';
import { CollectionPicker } from '../../../src/components/CollectionPicker';
import { useConfirm, useToast } from '../../../src/components/feedback';
import { Icon } from '../../../src/components/icons';
import { SourceChip } from '../../../src/components/labels';
import { Card, Divider, EmptyState, Row, Screen } from '../../../src/components/layout';
import { PhotoPlate } from '../../../src/components/PhotoPlate';
import { RemarkCard } from '../../../src/components/RemarkCard';
import { Text } from '../../../src/components/Text';
import { repository } from '../../../src/data';
import { useImageUrl, useMemory, useRemarks, useStory } from '../../../src/hooks/repo';
import { track } from '../../../src/lib/analytics';
import { copyText } from '../../../src/lib/share';
import { useSession } from '../../../src/state/auth';
import { useTheme } from '../../../src/state/theme';
import { space } from '../../../src/theme/tokens';
import { memoryTypeLabel, perspectivesLabel } from '../../../shared/story';

export default function MemoryPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const { c } = useTheme();
  const { uid } = useSession();

  const { data: memory, loading, error, reload } = useMemory(id);
  const { data: remarks, loading: remarksLoading, reload: reloadRemarks } = useRemarks(id);
  const { data: story } = useStory(id);
  const { url: imageUrl, failed: imageFailed } = useImageUrl(memory?.imagePath);

  const [composing, setComposing] = useState(false);

  const included = useMemo(() => remarks.filter((r) => r.included), [remarks]);

  if (loading) {
    return (
      <Screen>
        <Header onBack={() => router.back()} />
        <Skeleton height={220} />
        <Skeleton height={120} />
      </Screen>
    );
  }

  if (error || !memory) {
    return (
      <Screen>
        <Header onBack={() => router.back()} eyebrow="Not found" title="This memory is gone" />
        <Text variant="body" tone="muted">
          {error ?? 'It may have been deleted by its owner.'}
        </Text>
        <Button label="Back to your memories" onPress={() => router.replace('/')} />
      </Screen>
    );
  }

  const stamp = [
    memoryTypeLabel[memory.memoryType],
    memory.dateHint,
    memory.locationHint,
  ]
    .filter(Boolean)
    .join(' · ');

  async function compose() {
    if (!id) return;
    setComposing(true);
    try {
      const composed = await repository().composeStory(id);
      track({
        name: story ? 'story_regenerated' : 'story_composed',
        provider: composed.provider,
        remarkCount: included.length,
      });
      router.push({ pathname: '/memory/[id]/story', params: { id } });
    } catch (e) {
      toast(e instanceof Error ? e.message : 'The story could not be composed.', 'bad');
    } finally {
      setComposing(false);
    }
  }

  async function removeMemory() {
    if (!id) return;
    const ok = await confirm({
      title: 'Delete this memory?',
      body: 'The photo, every remark people added, and the story all go with it. This cannot be undone.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await repository().deleteMemory(id);
    } catch (e) {
      // Without this the promise rejected into nothing: the confirm dialog closed,
      // the memory stayed, and the owner was told neither that it worked nor that
      // it had not.
      toast(e instanceof Error ? e.message : 'That could not be deleted.', 'bad');
      return;
    }
    toast('Memory deleted.');
    router.replace('/');
  }

  async function copyInvite() {
    if (!memory) return;
    const ok = await copyText(repository().inviteUrl(memory));
    if (ok) track({ name: 'invite_shared', channel: 'copy' });
    toast(ok ? 'Invite link copied.' : 'The link could not be copied.', ok ? 'good' : 'bad');
  }

  return (
    <Screen
      footer={
        <ActionBar>
          {story ? (
            <Row gap={space.sm}>
              <Button
                label="Regenerate"
                variant="outline"
                onPress={compose}
                loading={composing}
                style={styles.half}
              />
              <Button
                label="Open the story"
                onPress={() =>
                  router.push({ pathname: '/memory/[id]/story', params: { id } })
                }
                style={styles.grow}
              />
            </Row>
          ) : (
            <>
              <Button
                label="Create the story"
                onPress={compose}
                loading={composing}
                full
                accessibilityHint={
                  included.length === 0
                    ? 'You can do this now, but the story will only have your account in it'
                    : `Composes from your memory and ${included.length} included ${included.length === 1 ? 'remark' : 'remarks'}`
                }
              />
              {included.length === 0 ? (
                <Text variant="meta" tone="muted" center>
                  You can compose now, but it will only be your account. Invite someone
                  first and it becomes a shared one.
                </Text>
              ) : null}
            </>
          )}
        </ActionBar>
      }
    >
      <Header
        onBack={() => router.back()}
        right={
          <IconButton name="trash" tone="muted" label="Delete this memory" onPress={removeMemory} />
        }
      />

      <PhotoPlate uri={imageUrl} failed={imageFailed} aspect={4 / 3} />

      <View style={styles.titleBlock}>
        <Text variant="display">{memory.title}</Text>
        <Row style={styles.stampRow}>
          <Text variant="meta" tone="muted" style={styles.stamp}>
            {stamp}
          </Text>
          <StatusPill
            status={
              memory.storyApprovedAt && memory.visibility === 'public'
                ? 'published'
                : memory.storyApprovedAt
                  ? 'approved'
                  : story
                    ? 'ready'
                    : remarks.length > 0
                      ? 'collecting'
                      : 'draft'
            }
          />
        </Row>
      </View>

      {/* ------------------------------------------------- the owner's words */}
      <Card>
        <View style={styles.ownerBlock}>
          <Row style={styles.ownerHead}>
            <SourceChip source={{ kind: 'owner' }} />
            <Text variant="eyebrow" tone="muted">
              Original memory
            </Text>
          </Row>
          <Text variant="body" style={[styles.quote, { borderLeftColor: c.hairline }]}>
            {memory.originalRemark}
          </Text>
          <Divider />
          <Row gap={space.sm}>
            <Icon name="lock" size={14} color={c.textMuted} />
            <Text variant="meta" tone="muted" style={styles.grow}>
              Kept word for word. Only you can change this.
            </Text>
          </Row>
        </View>
      </Card>

      {/* ------------------------------------------------------- collections */}
      <Card>
        <CollectionPicker memoryId={memory.id} uid={uid} />
      </Card>

      {/* ------------------------------------------------------------ invite */}
      <Card>
        <View style={styles.inviteBlock}>
          <SectionHead
            label="Invite"
            note={
              remarks.length === 0
                ? 'No one has added their piece yet.'
                : `${remarks.length} ${remarks.length === 1 ? 'person has' : 'people have'} added theirs.`
            }
          />
          <Row gap={space.sm}>
            <Button
              label="Share link and QR"
              onPress={() =>
                router.push({ pathname: '/memory/[id]/invite', params: { id } })
              }
              style={styles.grow}
            />
            <IconButton name="link" label="Copy the invite link" bordered onPress={copyInvite} />
          </Row>
          <Text variant="meta" tone="muted">
            No account needed. They open the link, see the photo, and write what they
            remember.
          </Text>
        </View>
      </Card>

      {/* ----------------------------------------------------------- remarks */}
      <SectionHead
        label={perspectivesLabel(memory.memoryType)}
        note={
          remarks.length > 0
            ? `${included.length} of ${remarks.length} will go into the story.`
            : undefined
        }
      />

      {remarksLoading ? (
        // "Nobody has added anything" is the most demoralising sentence on this page
        // and it was being shown to every owner, every visit, for as long as the
        // remarks took to arrive — including to owners who had contributions waiting.
        <Skeleton height={96} />
      ) : remarks.length === 0 ? (
        <EmptyState
          line="Nothing yet. A memory becomes a story when someone else adds what they remember."
          action={
            <Button
              label="Invite someone"
              variant="accent"
              onPress={() =>
                router.push({ pathname: '/memory/[id]/invite', params: { id } })
              }
            />
          }
        />
      ) : (
        <View style={styles.remarks}>
          {remarks.map((remark) => (
            <RemarkCard
              key={remark.id}
              remark={remark}
              onToggleInclude={async (next) => {
                try {
                  await repository().setRemarkIncluded(memory.id, remark.id, next);
                  reloadRemarks();
                } catch (e) {
                  // This was fire-and-forget. A failed write left the switch showing
                  // the owner a decision the story would not honour — and they would
                  // only find out by reading a composed story missing someone.
                  toast(
                    e instanceof Error ? e.message : 'That change could not be saved.',
                    'bad'
                  );
                }
              }}
              onDelete={async () => {
                const ok = await confirm({
                  title: `Delete the memory from ${remark.contributorName}?`,
                  body: 'This removes their words entirely. To keep them but leave them out of the story, exclude them instead.',
                  confirmLabel: 'Delete',
                  destructive: true,
                });
                if (!ok) return;
                try {
                  await repository().deleteRemark(memory.id, remark.id);
                  reloadRemarks();
                  toast('Removed.');
                } catch (e) {
                  toast(e instanceof Error ? e.message : 'That could not be removed.', 'bad');
                }
              }}
            />
          ))}
        </View>
      )}

      {/* -------------------------------------------------------- visibility */}
      <Card>
        <ToggleRow
          icon={memory.visibility === 'public' ? 'globe' : 'lock'}
          title={memory.visibility === 'public' ? 'Anyone with the link' : 'Private'}
          body={
            memory.visibility === 'public'
              ? 'The approved story is visible to anyone holding the link.'
              : 'Only you can see the story. Contributors can still add to it.'
          }
          value={memory.visibility === 'public'}
          // Publishing an unapproved story would put the model's output in front of
          // people before the owner had ever looked at it. That is the one thing this
          // product must not do.
          disabled={!memory.storyApprovedAt}
          disabledReason="Approve the story first, then you can publish it."
          onChange={async (next) => {
            try {
              await repository().setVisibility(memory.id, next ? 'public' : 'private');
            } catch (e) {
              // Publishing is the highest-stakes switch in the app. Failing it
              // silently could leave an owner believing a story is private when the
              // write never landed — or the reverse.
              toast(
                e instanceof Error ? e.message : 'That could not be changed.',
                'bad'
              );
              reload();
              return;
            }
            // The memory doc is fetched rather than watched, so the switch would
            // otherwise keep saying "Private" after a successful write.
            reload();
            if (next) track({ name: 'story_published' });
          }}
        />
      </Card>

      {composing ? <Loading line="Composing from what everyone said…" /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  titleBlock: { gap: space.sm },
  stampRow: { justifyContent: 'space-between', flexWrap: 'wrap', gap: space.sm },
  stamp: { flexShrink: 1 },
  ownerBlock: { gap: space.md },
  ownerHead: { flexWrap: 'wrap', gap: space.sm },
  quote: { paddingLeft: space.md, borderLeftWidth: 2 },
  inviteBlock: { gap: space.md },
  remarks: { gap: space.sm },
  half: { flex: 1 },
  grow: { flex: 2 },
});
