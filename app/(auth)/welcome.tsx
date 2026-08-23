/**
 * The splash — the first thing anyone sees.
 *
 * Three faces, fanned, the middle one larger and lifted. It is doing one job: saying
 * "people" before the word "photos" appears anywhere. This product is repeatedly
 * mistaken for a photo backup, and a grid of pictures on the first screen would
 * confirm the wrong guess in the half second before anybody reads a word.
 *
 * The dark button is the only one in the app. Crimson arrives on the tour, one screen
 * later — spending the accent here would leave nothing to escalate to.
 *
 * Shown once. Returning users go straight to sign-in, because a pitch in front of
 * someone who already bought is friction rather than marketing.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '../../src/components/Button';
import { ActionBar, StepDots } from '../../src/components/chrome';
import { Screen } from '../../src/components/layout';
import { Text } from '../../src/components/Text';
import { splashFaces } from '../../src/lib/onboarding-art';
import { useTheme } from '../../src/state/theme';
import { radius, space } from '../../src/theme/tokens';

export const WELCOME_SEEN_KEY = 'tellatale.welcome.seen';

/** Marked seen on the way out of onboarding, whichever exit is taken. */
export async function markWelcomeSeen() {
  await AsyncStorage.setItem(WELCOME_SEEN_KEY, '1');
}

export default function Welcome() {
  const router = useRouter();
  const { c } = useTheme();

  return (
    <Screen
      contentStyle={styles.content}
      footer={
        <ActionBar>
          <Button
            label="Get started"
            variant="ink"
            full
            onPress={() => router.push('/(auth)/tour')}
          />
          <Button
            label="I already have an account"
            variant="outline"
            full
            onPress={async () => {
              await markWelcomeSeen();
              router.replace('/(auth)/sign-in');
            }}
          />
          <Text variant="meta" tone="muted" center style={styles.privacy}>
            Private by default. We never share your family&apos;s memories without your
            say-so.
          </Text>
        </ActionBar>
      }
    >
      <View style={styles.faces} accessibilityRole="image" accessibilityLabel="Three family portraits">
        {splashFaces.map((source, i) => {
          const middle = i === 1;
          return (
            <View
              key={i}
              style={[
                styles.faceCard,
                {
                  width: middle ? 108 : 96,
                  height: middle ? 200 : 170,
                  marginTop: middle ? 0 : 26,
                  borderColor: c.hairline,
                  backgroundColor: c.surfaceRaised,
                  // The outer two tuck behind the centre card rather than sitting in a
                  // row — a row of three reads as a contact sheet, which is the
                  // impression this screen exists to avoid.
                  marginHorizontal: middle ? -10 : 0,
                  zIndex: middle ? 2 : 1,
                },
              ]}
            >
              <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover" />
            </View>
          );
        })}
      </View>

      <View style={styles.copy}>
        <Text variant="eyebrow" tone="muted" center>
          TellaTale
        </Text>
        <Text variant="display" center>
          The whole family,{'\n'}remembering together
        </Text>
        <Text variant="body" tone="muted" center>
          Collect the photos and the stories behind them — in one private place, before
          they&apos;re lost.
        </Text>
      </View>

      {/* Three dots for the three tour panels this leads into, so the length of what
          is being started is visible before it starts. */}
      <View style={styles.dots}>
        <StepDots total={3} index={0} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { justifyContent: 'center', gap: space.xl },
  faces: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingTop: space.xxl,
  },
  faceCard: {
    borderRadius: radius.image,
    borderWidth: 1,
    overflow: 'hidden',
  },
  copy: { gap: space.md, paddingHorizontal: space.sm },
  dots: { alignItems: 'center' },
  privacy: { paddingTop: space.xs },
});
