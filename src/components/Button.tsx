/**
 * Buttons.
 *
 * `contribute` is the only variant allowed to use --datestamp, and it exists so the
 * colour rule is expressed as an API rather than a convention someone has to remember:
 * if an action is not a contribution, there is no variant that will make it orange.
 */

import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Text } from './Text';
import { useTheme } from '../state/theme';
import { layout, radius, space } from '../theme/tokens';

type Variant = 'contribute' | 'primary' | 'secondary' | 'ghost' | 'destructive';

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  full?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  full,
  style,
  accessibilityHint,
}: Props) {
  const { c } = useTheme();
  const inactive = disabled || loading;

  const surface: Record<Variant, ViewStyle> = {
    contribute: { backgroundColor: c.datestamp },
    primary: { backgroundColor: c.surfaceRaised, borderWidth: 1, borderColor: c.hairline },
    secondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: c.hairline },
    ghost: { backgroundColor: 'transparent' },
    destructive: { backgroundColor: 'transparent', borderWidth: 1, borderColor: c.warn },
  };

  const labelTone =
    variant === 'contribute'
      ? 'inverse'
      : variant === 'destructive'
        ? 'warn'
        : variant === 'ghost'
          ? 'muted'
          : 'default';

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: Boolean(inactive), busy: Boolean(loading) }}
      style={({ pressed }) => [
        styles.base,
        surface[variant],
        full && styles.full,
        inactive && styles.inactive,
        pressed && !inactive && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'contribute' ? c.ink : c.textMuted} />
      ) : (
        <View style={styles.row}>
          <Text variant="ui" tone={labelTone}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: layout.minTouchTarget,
    borderRadius: radius.button,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  full: { alignSelf: 'stretch' },
  inactive: { opacity: 0.45 },
  pressed: { opacity: 0.8 },
});
