/**
 * Source and certainty labels.
 *
 * These are the MVP spec's trust surface: every line of a story card has to say where
 * it came from, and every contributor claim has to carry how sure they were. Both are
 * metadata, so both are monospace — the reader can tell at a glance which text is a
 * person speaking and which is the archive annotating.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';

import { type IconName } from './icons';
import { Text } from './Text';
import { useTheme } from '../state/theme';
import { radius, space } from '../theme/tokens';
import {
  certaintyLabel,
  type Certainty,
  type MemoryType,
  type SourceLabel,
  sourceLabelText,
} from '../../shared/story';

export function SourceChip({ source }: { source: SourceLabel }) {
  const { c } = useTheme();
  const isAi = source.kind === 'aiAssisted';
  const isObservation = source.kind === 'imageObservation';
  return (
    <View
      style={[
        styles.chip,
        {
          borderColor: c.hairline,
          backgroundColor: isAi || isObservation ? 'transparent' : c.surfaceRaised,
          borderStyle: isAi || isObservation ? 'dashed' : 'solid',
        },
      ]}
    >
      <Text variant="eyebrow" tone="muted">
        {sourceLabelText(source)}
      </Text>
    </View>
  );
}

/**
 * Certainty is shown for every contributor account, including "certain" — hiding it
 * when someone is sure would make the hedge look like a warning rather than a fact
 * about the account.
 */
export function CertaintyChip({ certainty }: { certainty: Certainty }) {
  const { c } = useTheme();
  const emphasised = certainty !== 'certain';
  return (
    <View
      style={[
        styles.chip,
        {
          borderColor: emphasised ? c.accent : c.hairline,
          backgroundColor: 'transparent',
        },
      ]}
    >
      <Text variant="eyebrow" tone={emphasised ? 'accent' : 'muted'}>
        {certaintyLabel[certainty]}
      </Text>
    </View>
  );
}

/** e.g. `SANA · AUNT · 2 DAYS AGO` */
export function AttributionLine({
  name,
  relationship,
  at,
}: {
  name: string;
  relationship?: string | null;
  at?: number | null;
}) {
  const parts = [name, relationship, at ? relativeTime(at) : null].filter(Boolean);
  return (
    <Text variant="eyebrow" tone="muted">
      {parts.join(' · ')}
    </Text>
  );
}

export function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ms).toLocaleDateString();
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.avatar,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
});

/* ------------------------------------------------------- collection icons */

/**
 * The glyph a collection wears, by kind. Lives here rather than in a dashboard
 * module because it is a label rule, and the dashboard it was written for no longer
 * exists.
 */
const KIND_ICON: Record<MemoryType, IconName> = {
  family: 'user',
  friendship: 'star',
  travel: 'globe',
  celebration: 'star',
  community: 'globe',
  work: 'link',
};

export function collectionIcon(kind: MemoryType): IconName {
  return KIND_ICON[kind];
}
