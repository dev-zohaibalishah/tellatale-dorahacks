/**
 * Buttons.
 *
 * The Figma uses four shapes, and each one appears in exactly one situation:
 *
 *   accent   — the crimson pill. The single forward action on a screen: Next, Post,
 *              Get started, Invite. Never two on one screen.
 *   ink      — the near-black pill, used once, on the splash. It exists because the
 *              splash has no crimson anywhere and the accent would arrive too early.
 *   outline  — the paired secondary: "I already have an account".
 *   ghost    — text-only: Skip, See all, All.
 *
 * A disabled accent button goes soft pink rather than translucent, which is why
 * `accentSoft` is a token and not an opacity.
 */

import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Text } from './Text';
import * as haptics from '../lib/haptics';
import { useTheme } from '../state/theme';
import { layout, radius, space } from '../theme/tokens';

type Variant = 'accent' | 'ink' | 'outline' | 'ghost' | 'destructive';
type Size = 'regular' | 'compact';

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  full?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}

export function Button({
  label,
  onPress,
  variant = 'accent',
  size = 'regular',
  disabled,
  loading,
  full,
  style,
  accessibilityHint,
}: Props) {
  const { c } = useTheme();
  const inactive = disabled || loading;

  const surface: Record<Variant, ViewStyle> = {
    accent: { backgroundColor: inactive ? c.accentSoft : c.accent },
    ink: { backgroundColor: c.inkButton },
    outline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: c.hairline },
    ghost: { backgroundColor: 'transparent' },
    destructive: { backgroundColor: 'transparent' },
  };

  const tone = {
    accent: 'onAccent',
    ink: 'onInk',
    outline: 'default',
    ghost: 'muted',
    destructive: 'warn',
  }[variant] as 'onAccent' | 'onInk' | 'default' | 'muted' | 'warn';

  return (
    <Pressable
      onPress={() => {
        // The forward action is the one worth feeling. Destructive gets a warning tick
        // before the dialog appears, so the hand knows ahead of the eye.
        if (variant === 'accent') haptics.contributed();
        else if (variant === 'destructive') haptics.warned();
        onPress();
      }}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: Boolean(inactive), busy: Boolean(loading) }}
      style={({ pressed }) => [
        styles.base,
        size === 'compact' ? styles.compact : styles.regular,
        surface[variant],
        full && styles.full,
        // A disabled accent button already reads as disabled through colour; dimming
        // it as well makes the label unreadable.
        inactive && variant !== 'accent' && styles.inactive,
        pressed && !inactive && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'accent' ? c.onAccent : c.textMuted} />
      ) : (
        <Text variant="uiStrong" tone={tone}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: space.sm,
  },
  regular: { minHeight: 54, paddingHorizontal: space.lg },
  compact: { minHeight: layout.minTouchTarget, paddingHorizontal: space.base },
  full: { alignSelf: 'stretch' },
  inactive: { opacity: 0.45 },
  pressed: { opacity: 0.85 },
});
