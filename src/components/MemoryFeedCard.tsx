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
import { useTheme } from '../state/theme';
import { radius, space } from '../theme/tokens';

export interface FeedCardProps {
  title: string;
  imageUrl: string | null;
  /** True when resolving the image URL failed, so the card can say so. */
  imageFailed?: boolean;
  /** Already formatted — "Aug 1994", "1979", "Sometime in the 1980s". */
  when?: string | null;
  where?: string | null;
  authorName: string;
  authorAvatar?: string | null;
  contributors: { uri?: string | null; name?: string | null }[];
  /** How many people have added their side. Not a comment count — there are none. */
  contributorCount: number;
  onPress: () => void;
}

export function MemoryFeedCard({
  title,
  imageUrl,
  imageFailed,
  when,
  where,
  authorName,
  authorAvatar,
  contributors,
  contributorCount,
  onPress,
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
        <PhotoPlate
          uri={imageUrl}
          failed={imageFailed}
          aspect={4 / 3}
          rounded
          accessibilityLabel={`Photo for ${title}`}
        />

        {remembering > 1 ? (
          <View style={[styles.badge, { backgroundColor: c.surface }]}>
            <Text variant="meta">{remembering} people remember this</Text>
          </View>
        ) : null}

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

          {/* The design has a heart and a comment count here. Neither exists: the
              MVP spec rules out likes, feeds and comment threads, and nothing in the
              schema stores either. A heart that only plays a haptic and a zero that
              can never move are worse than the space they fill — so the slot carries
              the one social number this product actually has, which is also the only
              one it cares about. */}
          <View style={styles.count}>
            <Icon name="people" size={15} color={c.textMuted} />
            <Text variant="label" tone="muted">
              {contributorCount}
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
  body: { gap: space.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  grow: { flex: 1 },
  stampRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  place: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  footRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  count: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
