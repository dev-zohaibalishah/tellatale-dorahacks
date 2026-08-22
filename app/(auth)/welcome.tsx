/**
 * First run.
 *
 * Three panels, then a decision. Someone arriving here has usually been handed a link
 * by a relative and has no idea what this is, and the single hardest thing this
 * product has to explain is that it is *not* another photo backup. Each panel makes
 * one claim and gets out of the way.
 *
 * Shown once. Returning users go straight to sign-in — a value pitch in front of
 * someone who already bought is friction, not marketing.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { Button } from '../../src/components/Button';
import { ActionBar, StepDots } from '../../src/components/chrome';
import { Row, Screen } from '../../src/components/layout';
import { Text } from '../../src/components/Text';
import { useTheme } from '../../src/state/theme';
import { motion, radius, space } from '../../src/theme/tokens';

export const WELCOME_SEEN_KEY = 'tellatale.welcome.seen';

const PANELS = [
  {
    eyebrow: 'The problem',
    title: 'The photos survive.\nThe stories don’t.',
    body: 'A shoebox of prints had names on the back. A camera roll of forty thousand has nothing. When the person who knew who is in the picture is gone, the photo becomes a stranger.',
  },
  {
    eyebrow: 'What this does',
    title: 'Ask the people\nwho were there.',
    body: 'Share one photo with a link or a QR code. Everyone who remembers it adds their side — no account, no app, under a minute.',
  },
  {
    eyebrow: 'The part that matters',
    title: 'Nobody’s words\nget overwritten.',
    body: 'The story keeps every account attributed, and marks what is uncertain. Where memories disagree, it says so instead of picking a winner. You approve it before anyone sees it.',
  },
];

export default function Welcome() {
  const router = useRouter();
  const { c } = useTheme();
  const [index, setIndex] = useState(0);

  const fade = useRef(new Animated.Value(1)).current;
  const lift = useRef(new Animated.Value(0)).current;

  // Cross-fade rather than a carousel swipe: three panels is a preamble, not a
  // gallery, and a swipe affordance invites people to browse instead of continue.
  useEffect(() => {
    fade.setValue(0);
    lift.setValue(8);
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: motion.standard,
        useNativeDriver: true,
      }),
      Animated.timing(lift, {
        toValue: 0,
        duration: motion.standard,
        useNativeDriver: true,
      }),
    ]).start();
  }, [index, fade, lift]);

  const panel = PANELS[index];
  const last = index === PANELS.length - 1;

  async function finish() {
    await AsyncStorage.setItem(WELCOME_SEEN_KEY, '1');
    router.replace('/(auth)/sign-up');
  }

  return (
    <Screen
      footer={
        <ActionBar>
          <Button
            label={last ? 'Create an account' : 'Next'}
            variant="contribute"
            full
            onPress={() => (last ? finish() : setIndex((i) => i + 1))}
          />
          <Row gap={space.xs} style={styles.skipRow}>
            <Button
              label="I already have an account"
              variant="ghost"
              onPress={async () => {
                await AsyncStorage.setItem(WELCOME_SEEN_KEY, '1');
                router.replace('/(auth)/sign-in');
              }}
            />
          </Row>
        </ActionBar>
      }
    >
      <View style={styles.top}>
        <Text variant="metaLabel" tone="muted">
          TellaTale
        </Text>
      </View>

      {/* A quiet stand-in for the photograph the product is about. Deliberately not a
          stock family photo: the brief bars depicting real people. */}
      <View style={[styles.plate, { borderColor: c.hairline }]}>
        <View style={[styles.plateInner, { backgroundColor: c.surfaceRaised }]} />
        <View style={[styles.plateStamp, { backgroundColor: c.datestamp }]} />
      </View>

      <Animated.View
        style={[styles.panel, { opacity: fade, transform: [{ translateY: lift }] }]}
      >
        <Text variant="metaLabel" tone="muted">
          {panel.eyebrow}
        </Text>
        <Text variant="display">{panel.title}</Text>
        <Text variant="body" tone="muted">
          {panel.body}
        </Text>
      </Animated.View>

      <View style={styles.dots}>
        <StepDots total={PANELS.length} index={index} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { paddingTop: space.xl },
  plate: {
    height: 150,
    borderRadius: radius.image,
    borderWidth: 1,
    overflow: 'hidden',
    marginTop: space.lg,
    justifyContent: 'flex-end',
  },
  // RN 0.86 dropped `absoluteFillObject` from the StyleSheet types.
  plateInner: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  plateStamp: {
    width: 44,
    height: 3,
    margin: space.md,
    borderRadius: 2,
  },
  panel: { gap: space.md, paddingTop: space.xl, minHeight: 260 },
  dots: { alignItems: 'center', paddingTop: space.base },
  skipRow: { justifyContent: 'center' },
});
