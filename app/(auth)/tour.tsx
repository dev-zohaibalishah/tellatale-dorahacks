/**
 * The tour — three panels, then the door.
 *
 * Each panel carries a photograph with a real question laid over it: "What's your
 * first memory of Abbu?", "Who remembers our old car?". That overlay is the whole
 * pitch and the reason the panels are not just captions. It shows the product being
 * *used by a family* — someone asking, everyone answering — which is the thing that
 * separates this from a photo backup and the thing a feature list never conveys.
 *
 * Skip is present and prominent. Somebody handed this app by a relative who is
 * standing next to them does not need three panels, and hiding the exit to force the
 * pitch is how a preamble becomes an obstacle.
 */

import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '../../src/components/Button';
import { ActionBar, StepDots } from '../../src/components/chrome';
import { Screen } from '../../src/components/layout';
import { Text } from '../../src/components/Text';
import * as haptics from '../../src/lib/haptics';
import { tourArt } from '../../src/lib/onboarding-art';
import { useTheme } from '../../src/state/theme';
import { motion, radius, space } from '../../src/theme/tokens';
import { markWelcomeSeen } from './welcome';

const PANELS = [
  {
    quote: 'What’s your first memory of Abbu?',
    asker: 'Ammi asked the family',
    eyebrow: 'One place',
    title: 'Every memory, together',
    body: 'The whole family’s photos, in one private circle.',
  },
  {
    quote: 'Who remembers our old car?',
    asker: 'Khalid asked the family',
    eyebrow: 'The story',
    title: 'Save who’s in the photo',
    body: 'Tag people and record the story behind it.',
  },
  {
    quote: 'A photo from Nani’s house?',
    asker: 'Sara asked the family',
    eyebrow: 'Together',
    title: 'Ask, everyone answers',
    body: 'One question, a memory from each of you.',
  },
];

export default function Tour() {
  const router = useRouter();
  const { c } = useTheme();
  const [index, setIndex] = useState(0);

  const fade = useRef(new Animated.Value(1)).current;

  // Cross-fade rather than a swipeable pager: three panels is a preamble, and a swipe
  // affordance invites browsing back and forth instead of continuing.
  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, {
      toValue: 1,
      duration: motion.standard,
      useNativeDriver: true,
    }).start();
  }, [index, fade]);

  const panel = PANELS[index];
  const last = index === PANELS.length - 1;

  async function leave() {
    await markWelcomeSeen();
    router.replace('/(auth)/sign-up');
  }

  return (
    <Screen
      footer={
        <ActionBar>
          <Button
            label={last ? 'Get started' : 'Next'}
            variant="accent"
            full
            onPress={() => {
              if (last) {
                void leave();
              } else {
                haptics.selected();
                setIndex((i) => i + 1);
              }
            }}
          />
        </ActionBar>
      }
    >
      <View style={styles.head}>
        <Text variant="wordmark">TellaTale</Text>
        <Pressable
          onPress={leave}
          accessibilityRole="button"
          accessibilityLabel="Skip the introduction"
          hitSlop={10}
        >
          <Text variant="ui" tone="muted">
            Skip
          </Text>
        </Pressable>
      </View>

      <Animated.View style={{ opacity: fade }}>
        <View style={[styles.plate, { borderColor: c.hairline, backgroundColor: c.surfaceRaised }]}>
          <Image
            source={tourArt[index]}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={motion.standard}
            accessible
            accessibilityLabel={panel.title}
          />

          {/* The question sits on the photograph, not under it. A family asking each
              other something is the product; a caption about it is marketing. */}
          <View style={[styles.quoteCard, { backgroundColor: c.surface }]}>
            <Text variant="uiStrong">“{panel.quote}”</Text>
            <Text variant="meta" tone="muted">
              {panel.asker}
            </Text>
          </View>
        </View>

        <View style={styles.copy}>
          <Text variant="eyebrow" tone="accent">
            {panel.eyebrow}
          </Text>
          <Text variant="display">{panel.title}</Text>
          <Text variant="body" tone="muted">
            {panel.body}
          </Text>
        </View>
      </Animated.View>

      <View style={styles.dots}>
        <StepDots total={PANELS.length} index={index} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: space.sm,
  },
  plate: {
    aspectRatio: 4 / 3.4,
    borderRadius: radius.card,
    borderWidth: 1,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    marginTop: space.base,
  },
  quoteCard: {
    margin: space.md,
    padding: space.md,
    borderRadius: radius.button,
    gap: 2,
  },
  copy: { gap: space.sm, paddingTop: space.lg },
  dots: { alignItems: 'center', paddingTop: space.lg },
});
