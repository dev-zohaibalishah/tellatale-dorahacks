/**
 * Home surfaces, straight from the Figma.
 *
 * The order on that screen is an argument, not a layout: greeting, then the circle's
 * name, then a question, then the compose bar, then what needs doing, then a waiting
 * question, and only then the feed. Someone opening the app is asked to contribute
 * three times before they are given anything to scroll.
 */

import { Image } from 'expo-image';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, type IconName } from './icons';
import { Text } from './Text';
import * as haptics from '../lib/haptics';
import { useTheme } from '../state/theme';
import { elevation, layout, radius, space } from '../theme/tokens';

/* --------------------------------------------------------------- avatars */

export function Avatar({
  uri,
  name,
  size = 36,
}: {
  uri?: string | null;
  name?: string | null;
  size?: number;
}) {
  const { c } = useTheme();
  const initial = (name ?? '').trim().charAt(0).toUpperCase();

  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: c.surfaceRaised },
      ]}
    >
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : initial ? (
        <Text variant="meta" tone="muted" style={{ fontSize: size * 0.4 }}>
          {initial}
        </Text>
      ) : (
        // A silhouette, not a "?".
        //
        // The feed draws one of these per contributor without loading their names —
        // the count is known, the identities are not. A row of question marks reads
        // as data the app has lost, rather than people it has not looked up.
        <Icon name="user" size={size * 0.5} color={c.textMuted} />
      )}
    </View>
  );
}

/** The overlapping avatar cluster on a memory card. */
export function AvatarStack({
  people,
  size = 26,
  max = 3,
}: {
  people: { uri?: string | null; name?: string | null }[];
  size?: number;
  max?: number;
}) {
  const { c } = useTheme();
  const shown = people.slice(0, max);

  return (
    <View style={styles.stack}>
      {shown.map((p, i) => (
        <View
          key={i}
          style={{
            marginLeft: i === 0 ? 0 : -size / 3,
            borderRadius: size,
            borderWidth: 2,
            borderColor: c.surface,
          }}
        >
          <Avatar uri={p.uri} name={p.name} size={size} />
        </View>
      ))}
    </View>
  );
}

/* ----------------------------------------------------------- compose bar */

/** "Add a memory…" — a button dressed as an input, because tapping it opens the sheet. */
export function ComposeBar({ onPress }: { onPress: () => void }) {
  const { c, name } = useTheme();
  return (
    <Pressable
      onPress={() => {
        haptics.contributed();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel="Add a memory"
      style={({ pressed }) => [
        styles.compose,
        { backgroundColor: c.surface, borderColor: c.hairline },
        elevation(name, 'card'),
        pressed && { opacity: 0.9 },
      ]}
    >
      <View style={[styles.composeDot, { backgroundColor: c.inkButton }]}>
        <Icon name="plus" size={18} color={c.onInkButton} />
      </View>
      <Text variant="ui" tone="muted" style={styles.grow}>
        Add a memory...
      </Text>
      <Icon name="chevronRight" size={18} color={c.textMuted} />
    </Pressable>
  );
}

/* ------------------------------------------------------------ things to do */

export function TodoChip({
  icon,
  label,
  count,
  dot,
  onPress,
}: {
  icon: IconName;
  label: string;
  count?: number;
  /** The unread marker — a small accent dot on the icon. */
  dot?: boolean;
  onPress: () => void;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={count === undefined ? label : `${label}, ${count}`}
      style={({ pressed }) => [
        styles.todo,
        { borderColor: c.hairline, backgroundColor: c.surface },
        pressed && { opacity: 0.85 },
      ]}
    >
      <View>
        <Icon name={icon} size={17} color={c.text} />
        {dot ? <View style={[styles.dot, { backgroundColor: c.accent }]} /> : null}
      </View>
      <Text variant="ui">{label}</Text>
      {count !== undefined ? (
        <Text variant="ui" tone="muted">
          {count}
        </Text>
      ) : null}
    </Pressable>
  );
}

/* -------------------------------------------------------- waiting question */

export function QuestionCard({
  question,
  asker,
  askerAvatar,
  answered,
  onAnswer,
}: {
  question: string;
  asker: string;
  askerAvatar?: string | null;
  answered: number;
  onAnswer: () => void;
}) {
  const { c } = useTheme();
  return (
    <View style={[styles.question, { backgroundColor: c.surfaceRaised }]}>
      <View style={styles.questionHead}>
        <View style={[styles.dotInline, { backgroundColor: c.accent }]} />
        <Text variant="eyebrow" tone="accent">
          A question is waiting
        </Text>
      </View>

      <Text variant="bodyLarge" style={styles.questionText}>
        “{question}”
      </Text>

      <View style={styles.questionFoot}>
        <Avatar uri={askerAvatar} name={asker} size={22} />
        <Text variant="meta" tone="muted" style={styles.grow}>
          {asker} asked · {answered} answered
        </Text>
        <Pressable
          onPress={onAnswer}
          accessibilityRole="button"
          accessibilityLabel={`Answer: ${question}`}
          style={styles.answer}
        >
          <Text variant="uiStrong">Answer</Text>
          <Icon name="chevronRight" size={16} color={c.text} />
        </Pressable>
      </View>
    </View>
  );
}

/* -------------------------------------------------------------- section head */

export function SectionRow({
  title,
  actionLabel = 'All',
  onAction,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionRow}>
      <Text variant="eyebrow" tone="muted">
        {title}
      </Text>
      {onAction ? (
        <Pressable onPress={onAction} accessibilityRole="button" accessibilityLabel={actionLabel}>
          <Text variant="ui" tone="accent">
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  stack: { flexDirection: 'row', alignItems: 'center' },

  compose: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderWidth: 1,
    borderRadius: radius.button,
    padding: space.sm,
    paddingRight: space.base,
    minHeight: 60,
  },
  composeDot: {
    width: 36,
    height: 36,
    borderRadius: radius.avatar,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grow: { flex: 1 },

  todo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space.base,
    minHeight: 44,
  },
  dot: {
    position: 'absolute',
    top: -2,
    right: -3,
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  dotInline: { width: 6, height: 6, borderRadius: 3 },

  question: {
    borderRadius: radius.card,
    padding: space.base,
    gap: space.md,
  },
  questionHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  questionText: { fontStyle: 'italic' },
  questionFoot: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  answer: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 32 },

  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: layout.minTouchTarget - 12,
  },
});
