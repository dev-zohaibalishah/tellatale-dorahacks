import React from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Text } from './Text';
import { Row } from './layout';
import { useTheme } from '../state/theme';
import { fonts, type as scale } from '../theme/typography';
import { layout, radius, space } from '../theme/tokens';

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  maxLength,
  autoFocus,
  /** Story and remark text is narrative — it gets the serif, like everything a person wrote. */
  narrative,
  hint,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  maxLength?: number;
  autoFocus?: boolean;
  narrative?: boolean;
  hint?: string;
}) {
  const { c } = useTheme();
  return (
    <View style={{ gap: space.sm }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="label" tone="muted">
          {label}
        </Text>
        {maxLength ? (
          <Text variant="meta" tone="muted">
            {value.length}/{maxLength}
          </Text>
        ) : null}
      </Row>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.textMuted}
        multiline={multiline}
        maxLength={maxLength}
        autoFocus={autoFocus}
        accessibilityLabel={label}
        style={[
          narrative ? scale.body : scale.ui,
          {
            color: c.text,
            backgroundColor: c.surfaceRaised,
            borderRadius: radius.button,
            borderWidth: 1,
            borderColor: c.hairline,
            padding: space.md,
            minHeight: multiline ? 120 : layout.minTouchTarget,
            textAlignVertical: multiline ? 'top' : 'center',
            fontFamily: narrative ? fonts.serif : fonts.ui,
          },
        ]}
      />
      {hint ? (
        <Text variant="meta" tone="muted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

export interface Choice<T extends string> {
  value: T;
  label: string;
}

export function ChoiceRow<T extends string>({
  label,
  choices,
  value,
  onChange,
  hint,
}: {
  label: string;
  choices: Choice<T>[];
  value: T;
  onChange: (v: T) => void;
  hint?: string;
}) {
  const { c } = useTheme();
  return (
    <View style={{ gap: space.sm }}>
      <Text variant="label" tone="muted">
        {label}
      </Text>
      <View style={styles.wrap}>
        {choices.map((ch) => {
          const active = ch.value === value;
          return (
            <Pressable
              key={ch.value}
              onPress={() => onChange(ch.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={ch.label}
              style={[
                styles.chip,
                {
                  borderColor: active ? c.signal : c.hairline,
                  backgroundColor: active ? c.surfaceRaised : 'transparent',
                },
              ]}
            >
              <Text variant="ui" tone={active ? 'default' : 'muted'}>
                {ch.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {hint ? (
        <Text variant="meta" tone="muted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

export function CheckRow({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      // react-native-web does not map accessibilityState.checked onto aria-checked,
      // so a screen reader was told this was a checkbox and never told whether it was
      // ticked. Setting it explicitly is the only thing that makes the consent gate
      // usable without sight.
      aria-checked={checked}
      accessibilityLabel={label}
      style={styles.check}
    >
      <View
        style={[
          styles.box,
          { borderColor: checked ? c.signal : c.hairline },
          checked && { backgroundColor: c.signal },
        ]}
      />
      <Text variant="ui" tone="muted" style={{ flex: 1 }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    minHeight: layout.minTouchTarget,
    justifyContent: 'center',
    paddingHorizontal: space.base,
    borderRadius: radius.avatar,
    borderWidth: 1,
  },
  check: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: layout.minTouchTarget,
  },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1 },
});
