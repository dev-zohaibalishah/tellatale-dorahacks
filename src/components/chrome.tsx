/**
 * Screen chrome: headers, icon buttons, status pills, skeletons.
 *
 * Headers are hand-rolled rather than taken from the router's native Stack header,
 * because the product's header is typographic — a mono eyebrow above a serif title —
 * and the native header cannot render that pairing on both platforms without a
 * per-OS fork.
 */

import React from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Icon, type IconName } from './icons';
import { Text } from './Text';
import { useTheme } from '../state/theme';
import { layout, radius, space } from '../theme/tokens';

/* -------------------------------------------------------------- icon button */

export function IconButton({
  name,
  onPress,
  label,
  tone,
  size = 20,
  bordered,
}: {
  name: IconName;
  onPress: () => void;
  /** Required — an icon with no accessible name is unusable with a screen reader. */
  label: string;
  tone?: 'default' | 'muted' | 'warn';
  size?: number;
  bordered?: boolean;
}) {
  const { c } = useTheme();
  const color = tone === 'warn' ? c.warn : tone === 'muted' ? c.textMuted : c.text;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [
        styles.iconButton,
        bordered && {
          borderWidth: 1,
          borderColor: c.hairline,
          borderRadius: radius.button,
        },
        pressed && { opacity: 0.6 },
      ]}
    >
      <Icon name={name} size={size} color={color} />
    </Pressable>
  );
}

/* ------------------------------------------------------------------ header */

export function Header({
  eyebrow,
  title,
  onBack,
  backLabel = 'Go back',
  backIcon = 'back',
  right,
}: {
  eyebrow?: string;
  title?: string;
  onBack?: () => void;
  backLabel?: string;
  backIcon?: IconName;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerBar}>
        <View style={styles.headerSlot}>
          {onBack ? (
            <IconButton name={backIcon} onPress={onBack} label={backLabel} />
          ) : null}
        </View>
        <View style={[styles.headerSlot, styles.headerRight]}>{right}</View>
      </View>
      {eyebrow ? (
        <Text variant="eyebrow" tone="muted">
          {eyebrow}
        </Text>
      ) : null}
      {title ? <Text variant="display">{title}</Text> : null}
    </View>
  );
}

/* -------------------------------------------------------------- status pill */

export type Status = 'draft' | 'collecting' | 'ready' | 'approved' | 'published';

const statusCopy: Record<Status, string> = {
  draft: 'Draft',
  collecting: 'Collecting',
  ready: 'Story ready',
  approved: 'Approved',
  published: 'Published',
};

export function StatusPill({ status }: { status: Status }) {
  const { c } = useTheme();
  // Only the published state earns a colour. Everything else describes the archive,
  // not an action, so it stays in the muted register.
  const published = status === 'published';
  return (
    <View style={[styles.pill, { borderColor: published ? c.accent : c.hairline }]}>
      <Text variant="eyebrow" tone={published ? 'accent' : 'muted'}>
        {statusCopy[status]}
      </Text>
    </View>
  );
}

/* ----------------------------------------------------------------- toggles */

export function ToggleRow({
  icon,
  title,
  body,
  value,
  onChange,
  disabled,
  disabledReason,
}: {
  icon: IconName;
  title: string;
  body: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={() => !disabled && onChange(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={title}
      accessibilityHint={disabled ? disabledReason : body}
      accessibilityState={{ checked: value, disabled: Boolean(disabled) }}
      style={({ pressed }) => [
        styles.toggleRow,
        (pressed || disabled) && { opacity: 0.7 },
      ]}
    >
      <Icon name={icon} size={20} color={value ? c.accent : c.textMuted} />
      <View style={styles.toggleText}>
        <Text variant="ui">{title}</Text>
        <Text variant="meta" tone="muted">
          {disabled && disabledReason ? disabledReason : body}
        </Text>
      </View>
      <View
        style={[
          styles.track,
          {
            backgroundColor: value ? c.accent : c.surfaceRaised,
            borderColor: value ? c.accent : c.hairline,
          },
        ]}
      >
        <View
          style={[
            styles.knob,
            {
              backgroundColor: value ? c.ink : c.textMuted,
              marginLeft: value ? 20 : 2,
            },
          ]}
        />
      </View>
    </Pressable>
  );
}

/* ------------------------------------------------------------------- steps */

export function StepDots({ total, index }: { total: number; index: number }) {
  const { c } = useTheme();
  return (
    <View
      style={styles.dots}
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${index + 1} of ${total}`}
    >
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            {
              backgroundColor: i <= index ? c.accent : c.hairline,
              // The current step is a bar, not a dot — position reads at a glance
              // without counting.
              width: i === index ? 22 : 6,
            },
          ]}
        />
      ))}
    </View>
  );
}

/* ---------------------------------------------------------------- skeleton */

/** A calm pulse. Never a spinner for content whose shape is already known. */
export function Skeleton({
  height,
  style,
}: {
  /** Omit when the caller already constrains the box (e.g. an absolute fill). */
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const anim = React.useRef(new Animated.Value(0.4)).current;

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.9, duration: 700, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          height,
          borderRadius: radius.image,
          backgroundColor: c.surfaceRaised,
          opacity: anim,
        },
        style,
      ]}
    />
  );
}

export function Loading({ line }: { line: string }) {
  const { c } = useTheme();
  return (
    <View style={styles.loading} accessibilityLiveRegion="polite">
      <ActivityIndicator color={c.textMuted} />
      <Text variant="meta" tone="muted">
        {line}
      </Text>
    </View>
  );
}

/* ------------------------------------------------------------ section head */

export function SectionHead({
  label,
  note,
  right,
}: {
  label: string;
  note?: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.sectionHead}>
      <View style={styles.sectionText}>
        <Text variant="eyebrow" tone="muted">
          {label}
        </Text>
        {note ? (
          <Text variant="meta" tone="muted">
            {note}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

/** Sticky action bar. Sits above the safe-area inset, never on top of content. */
export function ActionBar({ children }: { children: React.ReactNode }) {
  const { c } = useTheme();
  return (
    <View
      style={[styles.actionBar, { backgroundColor: c.ink, borderTopColor: c.hairline }]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    minWidth: layout.minTouchTarget,
    minHeight: layout.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: { gap: space.xs, paddingBottom: space.sm },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginLeft: -space.md,
    marginRight: -space.md,
  },
  headerSlot: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  headerRight: { justifyContent: 'flex-end' },
  pill: {
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.avatar,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: layout.minTouchTarget,
    paddingVertical: space.sm,
  },
  toggleText: { flex: 1, gap: 2 },
  track: {
    width: 44,
    height: 26,
    borderRadius: radius.avatar,
    borderWidth: 1,
    justifyContent: 'center',
  },
  knob: { width: 20, height: 20, borderRadius: radius.avatar },
  dots: { flexDirection: 'row', gap: space.xs, alignItems: 'center' },
  dot: { height: 6, borderRadius: radius.avatar },
  loading: { alignItems: 'center', gap: space.md, paddingVertical: space.xxl },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: space.md,
  },
  sectionText: { gap: 2, flex: 1 },
  actionBar: {
    borderTopWidth: 1,
    paddingHorizontal: layout.gutter,
    paddingTop: space.md,
    paddingBottom: space.md,
    gap: space.sm,
  },
});
