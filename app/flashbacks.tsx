/**
 * Flashbacks — gentle look-backs built from your family's photos.
 *
 * Derived, never stored. A flashback is whatever year can be read out of a memory's
 * free-text date — "Summer 1994", "around 1979" — so a photograph whose date nobody
 * remembers simply does not produce one. Nothing here invents a date to make the
 * shelf look fuller, which on a screen about remembering would be the worst possible
 * shortcut.
 *
 * The design says "On this day". This says "N years ago", because these dates are
 * years and pretending to know the day is a precision the data does not have. A
 * family who wrote "Summer 1994" did not tell us it was the 3rd of August.
 */

import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Header, Skeleton } from '../src/components/chrome';
import { EmptyState, Screen } from '../src/components/layout';
import { PhotoPlate } from '../src/components/PhotoPlate';
import { Text } from '../src/components/Text';
import { useFlashbacks, type Flashback } from '../src/hooks/circle';
import { useImageUrl, useMemories } from '../src/hooks/repo';
import { Icon } from '../src/components/icons';
import { useSession } from '../src/state/auth';
import { useTheme } from '../src/state/theme';
import { radius, space } from '../src/theme/tokens';

export default function Flashbacks() {
  const router = useRouter();
  const { uid } = useSession();
  const { data: memories, loading } = useMemories(uid);
  const flashbacks = useFlashbacks(memories);

  const undated = memories.length - flashbacks.length;

  return (
    <Screen>
      <Header onBack={() => router.back()} title="Flashbacks" />

      <Text variant="body" tone="muted">
        Gentle look-backs built from your family&apos;s photos.
      </Text>

      {loading ? (
        <View style={styles.list}>
          <Skeleton height={200} />
          <Skeleton height={200} />
        </View>
      ) : flashbacks.length === 0 ? (
        <EmptyState
          line={
            memories.length === 0
              ? 'No photos yet. Add a memory with a year on it and it will come back to you.'
              : 'None of your memories have a year on them yet. Add a "when" to one and it starts showing up here.'
          }
        />
      ) : (
        <View style={styles.list}>
          {flashbacks.map((flashback) => (
            <FlashbackCard
              key={flashback.memory.id}
              flashback={flashback}
              onOpen={() =>
                router.push({
                  pathname: '/memory/[id]',
                  params: { id: flashback.memory.id },
                })
              }
            />
          ))}
        </View>
      )}

      {undated > 0 && flashbacks.length > 0 ? (
        <Text variant="meta" tone="muted">
          {undated} other {undated === 1 ? 'memory has' : 'memories have'} no year on
          {undated === 1 ? ' it' : ' them'} yet, so {undated === 1 ? 'it is' : 'they are'}{' '}
          not here. Adding a &quot;when&quot; is enough.
        </Text>
      ) : null}
    </Screen>
  );
}

function FlashbackCard({
  flashback,
  onOpen,
}: {
  flashback: Flashback;
  onOpen: () => void;
}) {
  const { c } = useTheme();
  const { url, failed } = useImageUrl(flashback.memory.imagePath);

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`${flashback.memory.title}, ${flashback.yearsAgo} years ago`}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
    >
      <PhotoPlate uri={url} failed={failed} aspect={16 / 10} rounded />

      {/* The caption sits on the photograph rather than under it: a look-back is one
          object — a picture with a year attached — and splitting them makes it a list
          row with a thumbnail. */}
      <View style={styles.overlay}>
        <View style={[styles.plate, { backgroundColor: c.surface }]}>
          <Text variant="eyebrow" tone="muted">
            {flashback.yearsAgo} {flashback.yearsAgo === 1 ? 'year' : 'years'} ago ·{' '}
            {flashback.year}
          </Text>
          <Text variant="heading" numberOfLines={2}>
            {flashback.memory.title}
          </Text>
          <View style={styles.lookBack}>
            <Text variant="ui" tone="accent">
              Look back
            </Text>
            <Icon name="chevronRight" size={16} color={c.accent} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.lg },
  card: { position: 'relative' },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: space.md,
  },
  plate: { borderRadius: radius.button, padding: space.md, gap: 2 },
  lookBack: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: 4 },
});
