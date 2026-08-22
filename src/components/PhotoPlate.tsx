/**
 * The photo, presented.
 *
 * One image is the whole anchor of a memory, so its container does more than crop:
 *
 *  • It never collapses. A missing, slow, or broken image still occupies the exact
 *    space the photo will occupy, so the page does not reflow under someone who has
 *    already started reading.
 *  • It never guesses at content. The failure state says the image could not be
 *    loaded — it does not substitute a decorative gradient and let the reader assume
 *    they are looking at the memory.
 *  • `contain` is available for the story card, where cropping someone's photograph
 *    to fit a frame is a small act of editing we do not have permission to make.
 */

import { Image, type ImageContentFit } from 'expo-image';
import React, { useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon } from './icons';
import { Skeleton } from './chrome';
import { Text } from './Text';
import { useTheme } from '../state/theme';
import { radius, space } from '../theme/tokens';

export function PhotoPlate({
  uri,
  aspect = 4 / 3,
  contentFit = 'cover',
  rounded = true,
  style,
  accessibilityLabel = 'The photograph this memory is built around',
}: {
  uri: string | null;
  aspect?: number;
  contentFit?: ImageContentFit;
  rounded?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const { c } = useTheme();
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>(
    uri ? 'loading' : 'failed'
  );

  const frame: ViewStyle = {
    aspectRatio: aspect,
    width: '100%',
    overflow: 'hidden',
    backgroundColor: c.surfaceRaised,
    borderRadius: rounded ? radius.image : 0,
    borderWidth: 1,
    borderColor: c.hairline,
  };

  return (
    <View style={[frame, style]}>
      {uri ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit={contentFit}
          transition={220}
          accessible
          accessibilityLabel={accessibilityLabel}
          onLoad={() => setState('ready')}
          onError={() => setState('failed')}
        />
      ) : null}

      {state === 'loading' ? <Skeleton style={StyleSheet.absoluteFill} /> : null}

      {state === 'failed' ? (
        <View style={styles.fallback}>
          <Icon name="image" size={28} color={c.textMuted} />
          <Text variant="meta" tone="muted" center>
            {uri ? 'This image could not be loaded.' : 'No photo yet'}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    // RN 0.86 dropped `absoluteFillObject` from the StyleSheet types.
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    padding: space.base,
  },
});
