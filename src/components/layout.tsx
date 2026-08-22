import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { Text } from './Text';
import { useTheme } from '../state/theme';
import { layout, radius, space } from '../theme/tokens';

export function Screen({
  children,
  scroll = true,
  edges = ['top', 'bottom'],
  contentStyle,
  footer,
  avoidKeyboard,
}: {
  children?: React.ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  contentStyle?: StyleProp<ViewStyle>;
  /** Pinned below the scroll area. Action bars belong here, not in the flow. */
  footer?: React.ReactNode;
  /** Set on any screen with a text input, so the keyboard cannot cover the field. */
  avoidKeyboard?: boolean;
}) {
  const { c } = useTheme();
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.content, contentStyle]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, styles.flex, contentStyle]}>{children}</View>
  );

  const inner = (
    <>
      {body}
      {footer ? <View style={styles.footerSlot}>{footer}</View> : null}
    </>
  );

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: c.ink }]} edges={edges}>
      {avoidKeyboard ? (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {inner}
        </KeyboardAvoidingView>
      ) : (
        inner
      )}
    </SafeAreaView>
  );
}

export function Card({
  children,
  style,
  padded = true,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}) {
  const { c, elevation } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: c.surface,
          borderRadius: radius.card,
          borderWidth: 1,
          borderColor: c.hairline,
        },
        padded && { padding: space.base },
        elevation,
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return <View style={[{ height: 1, backgroundColor: c.hairline }, style]} />;
}

/** PRD §10.3: "Illustration slot + one sentence + one action. Never a shrug." */
export function EmptyState({
  line,
  action,
}: {
  line: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <Text variant="body" tone="muted" center>
        {line}
      </Text>
      {action ? <View style={{ marginTop: space.lg }}>{action}</View> : null}
    </View>
  );
}

/** Mono eyebrow — the archive's voice, never the person's. */
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <Text variant="eyebrow" tone="muted">
      {children}
    </Text>
  );
}

export function Stack({
  gap = space.base,
  children,
  style,
}: {
  gap?: number;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[{ gap }, style]}>{children}</View>;
}

export function Row({
  gap = space.sm,
  children,
  style,
}: {
  gap?: number;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>
      {children}
    </View>
  );
}

/**
 * Reading measure. The app is phone-first, but a guest opens an invite link on
 * whatever they happen to be holding — often a laptop — and a story set in 16px
 * serif running the full width of a 1400px window is unreadable. Content is capped
 * and centred while the ink field still runs edge to edge, so a wide window reads as
 * a page rather than as a phone in a letterbox.
 */
const MEASURE = 640;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingHorizontal: layout.gutter,
    paddingBottom: space.xxl,
    gap: space.base,
    width: '100%',
    maxWidth: MEASURE,
    alignSelf: 'center',
  },
  footerSlot: { width: '100%', maxWidth: MEASURE, alignSelf: 'center' },
  empty: {
    paddingVertical: space.xxl,
    paddingHorizontal: space.lg,
    alignItems: 'center',
  },
});
