/**
 * A memory in the Recently Added feed.
 *
 * Photo, then title, then `date · place`, then who added it, then the counts. The
 * "N people remember this" badge sits on the image because it is the one number that
 * says whether the product is working — a memory with two voices is the whole thesis,
 * and it should be legible before the title is read.
 */

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar, AvatarStack } from './home-ui';
import { Icon } from './icons';
import { PhotoPlate } from './PhotoPlate';
import { Text } from './Text';
import * as haptics from '../lib/haptics';
import { useTheme } from '../state/theme';
import { radius, space } from '../theme/tokens';

export interface FeedCardProps {
  title: string;
  imageUrl: string | null;
  /** Already formatted — "Aug 1994", "1979", "Sometime in the 1980s". */
  when?: string | null;
  where?: string | null;
  authorName: string;
  authorAvatar?: string | null;
  contributors: { uri?: string | null; name?: string | null }[];
  likes: number;
  comments: number;
  liked?: boolean;
  onPress: () => void;
  onToggleLike?: () => void;
}

export function MemoryFeedCard({
  title,
  imageUrl,
  when,
  where,
  authorName,
  authorAvatar,
  contributors,
  likes,
  comments,
  liked,
  onPress,
  onToggleLike,
}: FeedCardProps) {
  const { c } = useTheme();
  const remembering = contributors.length;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint="Open this memory"
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.94 }]}
    >
      <View style={styles.plate}>
        <PhotoPlate uri={imageUrl} aspect={4 / 3} rounded accessibilityLabel={`Photo for ${title}`} />

        {remembering > 1 ? (
          <View style={[styles.badge, { backgroundColor: c.surface }]}>
            <Text variant="meta">{remembering} people remember this</Text>
          </View>
        ) : null}

        <Pressable
          onPress={() => {
            haptics.selected();
            onToggleLike?.();
          }}
          accessibilityRole="button"
          accessibilityLabel={liked ? 'Remove your heart' : 'Heart this memory'}
          hitSlop={10}
          style={styles.heart}
        >
          <Icon name="heart" size={22} color={liked ? c.accent : '#FFFFFF'} filled={liked} />
        </Pressable>
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text variant="heading" numberOfLines={2} style={styles.grow}>
            {title}
          </Text>
          {contributors.length > 0 ? <AvatarStack people={contributors} /> : null}
        </View>

        {when || where ? (
          <View style={styles.stampRow}>
            {when ? (
              <Text variant="label" tone="muted">
                {when}
              </Text>
            ) : null}
            {when && where ? (
              <Text variant="label" tone="muted">
                ·
              </Text>
            ) : null}
            {where ? (
              <View style={styles.place}>
                <Icon name="pin" size={13} color={c.textMuted} />
                <Text variant="label" tone="muted">
                  {where}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.footRow}>
          <Avatar uri={authorAvatar} name={authorName} size={22} />
          <Text variant="label" tone="muted" style={styles.grow}>
            {authorName}
          </Text>

          <View style={styles.count}>
            <Icon name="heart" size={15} color={c.textMuted} />
            <Text variant="label" tone="muted">
              {likes}
            </Text>
          </View>
          <View style={styles.count}>
            <Icon name="comment" size={15} color={c.textMuted} />
            <Text variant="label" tone="muted">
              {comments}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  plate: { position: 'relative' },
  badge: {
    position: 'absolute',
    top: space.md,
    left: space.md,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  heart: {
    position: 'absolute',
    top: space.md,
    right: space.md,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { gap: space.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  grow: { flex: 1 },
  stampRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  place: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  footRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  count: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
