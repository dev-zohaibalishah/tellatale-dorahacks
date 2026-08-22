/**
 * The story card. This is the artefact the product exists to produce.
 *
 * The MVP spec fixes four sections and requires that every line of the card declare
 * where it came from. That is not decoration — it is the entire trust claim, so the
 * structure is hard-coded here rather than driven by whatever the model returned:
 *
 *   1. The original memory    — the owner's words, verbatim, first, never merged.
 *   2. What <the group> remembers — contributor accounts, each still attributed.
 *   3. What the image shows   — cautious visual observation, dashed-border chip.
 *   4. The story              — the narrative, clearly the assembled layer.
 *
 * Two sections render an explicit line when they are empty instead of disappearing.
 * A card that silently drops "what the image shows" reads as though the AI had
 * nothing to hedge; a card that says nothing was observed is telling the truth about
 * its own limits, which is the point of the section.
 *
 * `uncertainties` sits immediately before the narrative, not in a footnote. The
 * reader should meet what is unsettled before they read the version that reads
 * smoothly.
 */

import React, { forwardRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { CertaintyChip, SourceChip } from './labels';
import { Divider, Row } from './layout';
import { PhotoPlate } from './PhotoPlate';
import { Text } from './Text';
import { useTheme } from '../state/theme';
import { radius, space } from '../theme/tokens';
import {
  perspectivesLabel,
  type MemoryType,
  type StoryDoc,
} from '../../shared/story';

export interface StoryCardProps {
  story: StoryDoc;
  memoryType: MemoryType;
  imageUrl: string | null;
  dateHint?: string | null;
  locationHint?: string | null;
  contributorCount: number;
}

/**
 * Forwards a ref so the card can be rasterised for the download/share action. The
 * captured view is the one on screen — capturing an offscreen clone yields a blank
 * image on Android.
 */
export const StoryCard = forwardRef<View, StoryCardProps>(function StoryCard(
  { story, memoryType, imageUrl, dateHint, locationHint, contributorCount },
  ref
) {
  const { c, elevation } = useTheme();

  // Owner edits live in separate fields so the AI's output is never overwritten in
  // place. The card shows the owner's version whenever there is one.
  const title = story.ownerEditedTitle ?? story.title;
  const narrative = story.ownerEditedStory ?? story.story;
  const edited = Boolean(story.ownerEditedTitle || story.ownerEditedStory);

  const stamp = [dateHint, locationHint].filter(Boolean).join(' · ');

  return (
    <View
      ref={ref}
      collapsable={false}
      style={[
        styles.card,
        { backgroundColor: c.surface, borderColor: c.hairline },
        elevation,
      ]}
    >
      <PhotoPlate uri={imageUrl} aspect={4 / 3} rounded={false} />

      <View style={styles.body}>
        <View style={styles.titleBlock}>
          <Text variant="title">{title}</Text>
          {stamp ? (
            <Text variant="meta" tone="muted">
              {stamp}
            </Text>
          ) : null}
          <Text variant="meta" tone="muted">
            {story.summary}
          </Text>
        </View>

        <Divider />

        {/* 1 ------------------------------------------------------ the owner */}
        <Section label="The original memory">
          <SourceChip source={{ kind: 'owner' }} />
          <Text variant="body" style={[styles.quote, { borderLeftColor: c.hairline }]}>
            {story.ownerMemory}
          </Text>
          <Text variant="meta" tone="muted">
            Kept word for word. Only the owner can change this.
          </Text>
        </Section>

        <Divider />

        {/* 2 ------------------------------------------------ everyone else */}
        <Section label={perspectivesLabel(memoryType)}>
          {story.familyPerspectives.length === 0 ? (
            <Text variant="body" tone="muted">
              No one else has added their memory yet.
            </Text>
          ) : (
            story.familyPerspectives.map((p, i) => (
              <View key={`${p.contributorName}-${i}`} style={styles.perspective}>
                <Row style={styles.chips}>
                  <SourceChip source={{ kind: 'contributor', name: p.contributorName }} />
                  <CertaintyChip certainty={p.certainty} />
                </Row>
                <Text variant="body">{p.text}</Text>
              </View>
            ))
          )}
        </Section>

        <Divider />

        {/* 3 ------------------------------------------------------ the image */}
        <Section label="What the image shows">
          {story.imageObservations.length === 0 ? (
            <Text variant="body" tone="muted">
              No observations were made about this image.
            </Text>
          ) : (
            <>
              <SourceChip source={{ kind: 'imageObservation' }} />
              {story.imageObservations.map((o, i) => (
                <Text key={i} variant="body">
                  {o}
                </Text>
              ))}
            </>
          )}
        </Section>

        {/* 4 --------------------------------------------- what is not settled */}
        {story.uncertainties.length > 0 ? (
          <>
            <Divider />
            <Section label="What is not settled">
              {story.uncertainties.map((u, i) => (
                <Row key={i} style={styles.bullet}>
                  <View style={[styles.dot, { backgroundColor: c.accent }]} />
                  <Text variant="body" tone="muted" style={styles.bulletText}>
                    {u}
                  </Text>
                </Row>
              ))}
            </Section>
          </>
        ) : null}

        <Divider />

        {/* 5 ---------------------------------------------------- the narrative */}
        <Section label="The story">
          {narrative
            .split(/\n{2,}/)
            .filter((para) => para.trim().length > 0)
            .map((para, i) => (
              <Text key={i} variant="body">
                {para.trim()}
              </Text>
            ))}
        </Section>

        <Divider />

        <Row style={styles.footer}>
          <Row style={styles.chips}>
            {story.aiAssisted ? <SourceChip source={{ kind: 'aiAssisted' }} /> : null}
            {edited ? (
              <View style={[styles.editedChip, { borderColor: c.hairline }]}>
                <Text variant="eyebrow" tone="muted">
                  Owner edited
                </Text>
              </View>
            ) : null}
          </Row>
          <Text variant="eyebrow" tone="muted">
            {contributorCount === 1
              ? '1 contributor'
              : `${contributorCount} contributors`}
          </Text>
        </Row>
      </View>
    </View>
  );
});

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="eyebrow" tone="muted">
        {label}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
  body: { padding: space.base, gap: space.base },
  titleBlock: { gap: space.xs },
  section: { gap: space.sm },
  // A hanging indent marks the owner's words as quoted material without dropping
  // them into a different typeface, which would read as a downgrade.
  quote: { paddingLeft: space.md, borderLeftWidth: 2 },
  perspective: { gap: space.sm, paddingTop: space.xs },
  chips: { flexWrap: 'wrap', gap: space.sm },
  bullet: { alignItems: 'flex-start', gap: space.md },
  bulletText: { flex: 1 },
  dot: { width: 5, height: 5, borderRadius: radius.avatar, marginTop: 10 },
  footer: { justifyContent: 'space-between', flexWrap: 'wrap', gap: space.sm },
  editedChip: {
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.avatar,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
});
