/**
 * Pieces the auth screens share.
 *
 * Auth is where a stranger decides whether this product is worth their photograph, so
 * it gets the same care as the story card: real validation messaging, a visible
 * reveal toggle, and errors that name the actual problem instead of "something went
 * wrong".
 */

import React, { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Icon } from './icons';
import { Text } from './Text';
import { Row } from './layout';
import { useTheme } from '../state/theme';
import { fonts, type as scale } from '../theme/typography';
import { layout, radius, space } from '../theme/tokens';
import { passwordStrength } from '../lib/username';

/* --------------------------------------------------------------- text field */

interface AuthFieldProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  /** Shown under the field in warn tone. Null while untouched. */
  problem?: string | null;
  autoCapitalize?: 'none' | 'words';
  autoComplete?: 'username' | 'password' | 'new-password' | 'name';
  secure?: boolean;
  autoFocus?: boolean;
  onSubmitEditing?: () => void;
  returnKeyType?: 'next' | 'go' | 'done';
  hint?: string;
  maxLength?: number;
}

export function AuthField({
  label,
  value,
  onChangeText,
  placeholder,
  problem,
  autoCapitalize = 'none',
  autoComplete,
  secure,
  autoFocus,
  onSubmitEditing,
  returnKeyType,
  hint,
  maxLength,
}: AuthFieldProps) {
  const { c } = useTheme();
  const [revealed, setRevealed] = useState(false);
  const [focused, setFocused] = useState(false);

  const borderColor = problem ? c.warn : focused ? c.signal : c.hairline;

  return (
    <View style={styles.fieldBlock}>
      <Text variant="label" tone="muted">
        {label}
      </Text>

      <View style={[styles.inputWrap, { borderColor, backgroundColor: c.surfaceRaised }]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={c.textMuted}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          autoComplete={autoComplete}
          textContentType={
            autoComplete === 'new-password'
              ? 'newPassword'
              : autoComplete === 'password'
                ? 'password'
                : autoComplete === 'username'
                  ? 'username'
                  : 'none'
          }
          secureTextEntry={secure && !revealed}
          autoFocus={autoFocus}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onSubmitEditing={onSubmitEditing}
          returnKeyType={returnKeyType}
          maxLength={maxLength}
          accessibilityLabel={label}
          style={[styles.input, scale.ui, { color: c.text, fontFamily: fonts.ui }]}
        />

        {secure ? (
          <Pressable
            onPress={() => setRevealed((r) => !r)}
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
            hitSlop={12}
            style={styles.reveal}
          >
            <Icon name={revealed ? 'eyeOff' : 'eye'} size={18} color={c.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {problem ? (
        <Text variant="meta" tone="warn">
          {problem}
        </Text>
      ) : hint ? (
        <Text variant="meta" tone="muted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

/* ----------------------------------------------------------- strength meter */

/** Advisory. It never blocks submission — see lib/username.ts. */
export function PasswordStrength({ password }: { password: string }) {
  const { c } = useTheme();
  if (!password) return null;

  const { score, label } = passwordStrength(password);
  const tone = score >= 3 ? c.signal : score === 2 ? c.textMuted : c.warn;

  return (
    <Row gap={space.sm} style={styles.strengthRow}>
      <View style={styles.bars}>
        {[1, 2, 3].map((i) => (
          <View
            key={i}
            style={[
              styles.bar,
              { backgroundColor: i <= score ? tone : c.hairline },
            ]}
          />
        ))}
      </View>
      <Text variant="meta" style={{ color: tone }}>
        {label}
      </Text>
    </Row>
  );
}

/* --------------------------------------------------------------- error card */

export function AuthError({ message }: { message: string }) {
  const { c } = useTheme();
  return (
    <View
      style={[styles.error, { borderColor: c.warn }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Icon name="alert" size={16} color={c.warn} />
      <Text variant="meta" tone="muted" style={styles.errorText}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fieldBlock: { gap: space.sm },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.button,
    minHeight: layout.minTouchTarget,
    paddingLeft: space.md,
    paddingRight: space.sm,
  },
  input: { flex: 1, paddingVertical: space.md },
  reveal: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  strengthRow: { alignItems: 'center' },
  bars: { flexDirection: 'row', gap: 4, flex: 1 },
  bar: { flex: 1, height: 3, borderRadius: 2 },
  error: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radius.button,
    padding: space.md,
  },
  errorText: { flex: 1 },
});
