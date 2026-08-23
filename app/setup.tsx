/**
 * Setup — two questions, asked once, after the account exists.
 *
 * Both of them are answerable in a second and neither is a form field. The first asks
 * what someone would add first, and the honest reason is not personalisation: the
 * hardest moment in this product is the empty archive, and a person who has just
 * pictured a specific photograph is far more likely to go and find it than one handed
 * a blank grid. The answer then becomes the prompt on the compose sheet, so the app
 * asks them about the thing they already had in mind.
 *
 * The second asks who the circle is for, and it is shown back on the People screen.
 *
 * Both answers stay on the device. Neither is worth a column and a migration, and
 * both are read back somewhere — an onboarding question whose answer is never used
 * again costs the one moment of attention a new user reliably gives.
 */

import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '../src/components/Button';
import { ActionBar, StepDots } from '../src/components/chrome';
import { useToast } from '../src/components/feedback';
import { Icon } from '../src/components/icons';
import { Screen } from '../src/components/layout';
import { Text } from '../src/components/Text';
import * as haptics from '../src/lib/haptics';
import {
  CIRCLE_OPTIONS,
  FIRST_MEMORY_OPTIONS,
  saveSetup,
  type CircleGroup,
  type FirstMemoryChoice,
} from '../src/state/onboarding';
import { useTheme } from '../src/state/theme';
import { layout, radius, space } from '../src/theme/tokens';

export default function Setup() {
  const router = useRouter();
  const toast = useToast();
  const { c } = useTheme();

  const [step, setStep] = useState<0 | 1>(0);
  const [first, setFirst] = useState<FirstMemoryChoice | null>(null);
  const [circle, setCircle] = useState<CircleGroup[]>([]);
  const [saving, setSaving] = useState(false);

  const canContinue = step === 0 ? first !== null : circle.length > 0;

  function toggleGroup(group: CircleGroup) {
    haptics.selected();
    setCircle((current) =>
      current.includes(group) ? current.filter((g) => g !== group) : [...current, group]
    );
  }

  async function advance() {
    if (!canContinue || saving) return;

    if (step === 0) {
      haptics.selected();
      setStep(1);
      return;
    }

    setSaving(true);
    try {
      await saveSetup(first!, circle);
      haptics.succeeded();
      router.replace('/');
    } catch {
      // Device storage failing is not a reason to trap someone in onboarding. The
      // answers are a hint, and the app is entirely usable without them.
      toast('Your answers could not be saved, but you are all set.', 'bad');
      router.replace('/');
    } finally {
      setSaving(false);
    }
  }

  function back() {
    if (step === 1) {
      setStep(0);
      return;
    }
    // Step one is the first screen after signing up; there is no earlier step to
    // return to, so this leaves setup rather than unwinding into the auth stack.
    router.replace('/');
  }

  return (
    <Screen
      footer={
        <ActionBar>
          <Button
            label={step === 0 ? 'Continue' : 'Enter TellaTale'}
            variant="accent"
            full
            disabled={!canContinue}
            loading={saving}
            onPress={advance}
            accessibilityHint={
              canContinue
                ? undefined
                : step === 0
                  ? 'Choose one to continue'
                  : 'Choose at least one to continue'
            }
          />
        </ActionBar>
      }
    >
      <View style={styles.head}>
        <Pressable
          onPress={back}
          accessibilityRole="button"
          accessibilityLabel={step === 1 ? 'Back to the first question' : 'Skip setup'}
          hitSlop={8}
          style={[styles.backDot, { backgroundColor: c.surfaceRaised }]}
        >
          <Icon name="back" size={18} color={c.text} />
        </Pressable>
        <View style={styles.dots}>
          <StepDots total={2} index={step} />
        </View>
        {/* Balances the back button so the dots sit centred. */}
        <View style={styles.backDot} />
      </View>

      {step === 0 ? (
        <View style={styles.block}>
          <Text variant="eyebrow" tone="accent">
            Let&apos;s begin
          </Text>
          <Text variant="display">What would you add first?</Text>
          <Text variant="body" tone="muted">
            Don&apos;t overthink it — you can change your mind later.
          </Text>

          <View
            style={styles.options}
            accessibilityRole="radiogroup"
            // react-native-web does not map accessibilityState onto ARIA for these
            // roles, so each option sets aria-checked itself.
            accessibilityLabel="What would you add first?"
          >
            {FIRST_MEMORY_OPTIONS.map((option) => {
              const on = option.key === first;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => {
                    haptics.selected();
                    setFirst(option.key);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  aria-checked={on}
                  accessibilityLabel={`${option.title}. ${option.note}`}
                  style={({ pressed }) => [
                    styles.option,
                    {
                      borderColor: on ? c.accent : c.hairline,
                      backgroundColor: on ? c.surfaceRaised : c.surface,
                    },
                    pressed && { opacity: 0.9 },
                  ]}
                >
                  <View style={[styles.optionIcon, { backgroundColor: c.surfaceRaised }]}>
                    <Text variant="ui">{option.emoji}</Text>
                  </View>
                  <View style={styles.grow}>
                    <Text variant="uiStrong">{option.title}</Text>
                    <Text variant="label" tone="muted">
                      {option.note}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.radio,
                      { borderColor: on ? c.accent : c.hairline },
                      on && { backgroundColor: c.accent },
                    ]}
                  />
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : (
        <View style={styles.block}>
          <Text variant="eyebrow" tone="accent">
            Your circle
          </Text>
          <Text variant="display">Who are you collecting for?</Text>
          <Text variant="body" tone="muted">
            Pick everyone who belongs in the family circle.
          </Text>

          <View style={styles.chips}>
            {CIRCLE_OPTIONS.map((group) => {
              const on = circle.includes(group);
              return (
                <Pressable
                  key={group}
                  onPress={() => toggleGroup(group)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  aria-checked={on}
                  accessibilityLabel={group}
                  style={({ pressed }) => [
                    styles.chip,
                    {
                      borderColor: on ? c.accent : c.hairline,
                      backgroundColor: on ? c.surfaceRaised : 'transparent',
                    },
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text variant="ui" tone={on ? 'default' : 'muted'}>
                    {group}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={[styles.note, { backgroundColor: c.surfaceRaised }]}>
            <Text variant="label" tone="muted">
              We&apos;ll help you invite them once your first memory is up — the archive
              feels alive the moment a second person adds their side.
            </Text>
          </View>
        </View>
      )}
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
  backDot: {
    width: 36,
    height: 36,
    borderRadius: radius.avatar,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: { flex: 1, alignItems: 'center' },
  block: { gap: space.md, paddingTop: space.lg },
  options: { gap: space.md, paddingTop: space.md },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.base,
    borderRadius: radius.card,
    borderWidth: 1,
    minHeight: 76,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.avatar,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grow: { flex: 1, gap: 2 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingTop: space.sm },
  chip: {
    minHeight: layout.minTouchTarget,
    justifyContent: 'center',
    paddingHorizontal: space.base,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  note: { borderRadius: radius.card, padding: space.base, marginTop: space.sm },
});
