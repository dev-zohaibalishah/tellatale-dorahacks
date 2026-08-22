import { Image } from 'expo-image';
import { Link } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { Row } from './layout';
import { useImageUrl } from '../hooks/useImageUrl';
import { useTheme } from '../state/theme';
import { radius, space } from '../theme/tokens';
import { memoryTypeLabel, type Memory } from '../../shared/story';

export function MemoryCard({ memory }: { memory: Memory }) {
  const { c, elevation } = useTheme();
  const url = useImageUrl(memory.imagePath);

  const meta = [
    memoryTypeLabel[memory.memoryType],
    memory.dateHint,
    memory.locationHint,
  ]
    .filter(Boolean)
    .join(' · ');

  const contributors =
    memory.contributorCount === 0
      ? 'Waiting for the first memory'
      : `${memory.contributorCount + 1} people remember this`;

  return (
    <Link href={`/memory/${memory.id}`} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${memory.title}. ${contributors}.`}
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: c.surface, borderColor: c.hairline },
          elevation,
          pressed && { opacity: 0.85 },
        ]}
      >
        <View style={[styles.plate, { backgroundColor: c.surfaceRaised }]}>
          {url ? (
            <Image
              source={{ uri: url }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={200}
              accessible
              accessibilityLabel={`Photo for ${memory.title}`}
            />
          ) : null}
        </View>

        <View style={styles.body}>
          {meta ? <Text variant="eyebrow" tone="muted">{meta}</Text> : null}
          <Text variant="title" numberOfLines={2}>
            {memory.title}
          </Text>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text variant="meta" tone="muted">
              {contributors}
            </Text>
            {memory.storyApprovedAt ? (
              <Text variant="eyebrow" tone="muted">
                {memory.visibility === 'public' ? 'Published' : 'Approved'}
              </Text>
            ) : null}
          </Row>
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
  plate: { aspectRatio: 4 / 3, width: '100%' },
  body: { padding: space.base, gap: space.sm },
});
