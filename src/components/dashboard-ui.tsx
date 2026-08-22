/**
 * Dashboard furniture: tabs, stat strip, search, collection chips.
 *
 * The stat strip leads with **contributors**, not memories. A count of photographs is
 * a storage metric and this product is not a storage product — the number that says
 * whether it is working is how many other people have spoken. That is also the PRD's
 * own North Star, so the interface should not quietly disagree with it.
 */

import React from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Icon, type IconName } from './icons';
import { Text } from './Text';
import { Row } from './layout';
import { useTheme } from '../state/theme';
import { fonts, type as scale } from '../theme/typography';
import { layout, radius, space } from '../theme/tokens';
import { memoryTypeLabel, type MemoryType } from '../../shared/story';

/* ------------------------------------------------------------------- tabs */

export interface TabDef<T extends string> {
  key: T;
  label: string;
  count?: number;
}

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: TabDef<T>[];
  active: T;
  onChange: (key: T) => void;
}) {
  const { c } = useTheme();
  return (
    <View style={[styles.tabBar, { borderColor: c.hairline }]}>
      {tabs.map((tab) => {
        const selected = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={
              tab.count === undefined ? tab.label : `${tab.label}, ${tab.count}`
            }
            style={[
              styles.tab,
              selected && { backgroundColor: c.surfaceRaised, borderColor: c.hairline },
            ]}
          >
            <Text variant="ui" tone={selected ? 'default' : 'muted'} numberOfLines={1}>
              {tab.label}
            </Text>
            {tab.count !== undefined && tab.count > 0 ? (
              <View style={[styles.tabCount, { backgroundColor: c.hairline }]}>
                <Text variant="meta" tone="muted">
                  {tab.count}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------------- stat strip */

export interface Stat {
  label: string;
  value: number | string;
  /** The one figure that matters most gets the reserved warm colour. */
  emphasis?: boolean;
}

export function StatStrip({ stats }: { stats: Stat[] }) {
  const { c } = useTheme();
  return (
    <View style={[styles.stats, { borderColor: c.hairline }]}>
      {stats.map((stat, i) => (
        <View
          key={stat.label}
          style={[
            styles.stat,
            i > 0 && { borderLeftWidth: 1, borderLeftColor: c.hairline },
          ]}
        >
          <Text
            variant="title"
            style={stat.emphasis ? { color: c.accent } : undefined}
          >
            {stat.value}
          </Text>
          <Text variant="eyebrow" tone="muted" numberOfLines={2}>
            {stat.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

/* ----------------------------------------------------------------- search */

export function SearchBar({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
}) {
  const { c } = useTheme();
  return (
    <View style={[styles.search, { borderColor: c.hairline, backgroundColor: c.surfaceRaised }]}>
      <Icon name="search" size={16} color={c.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.textMuted}
        autoCorrect={false}
        accessibilityLabel={placeholder}
        style={[scale.ui, styles.searchInput, { color: c.text, fontFamily: fonts.regular }]}
      />
      {value.length > 0 ? (
        <Pressable
          onPress={() => onChangeText('')}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          hitSlop={10}
        >
          <Icon name="close" size={16} color={c.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------- collection chips */

const KIND_ICON: Record<MemoryType, IconName> = {
  family: 'user',
  friendship: 'star',
  travel: 'globe',
  celebration: 'star',
  community: 'globe',
  work: 'link',
};

export function collectionIcon(kind: MemoryType): IconName {
  return KIND_ICON[kind];
}

/** Horizontal filter rail. `null` is the "everything" pill. */
export function FilterRail<T extends string>({
  options,
  active,
  onChange,
  allLabel = 'All',
}: {
  options: { key: T; label: string; kind?: MemoryType }[];
  active: T | null;
  onChange: (key: T | null) => void;
  allLabel?: string;
}) {
  const { c } = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.rail}
    >
      <Pill label={allLabel} selected={active === null} onPress={() => onChange(null)} />
      {options.map((opt) => (
        <Pill
          key={opt.key}
          label={opt.label}
          icon={opt.kind ? KIND_ICON[opt.kind] : undefined}
          selected={active === opt.key}
          onPress={() => onChange(active === opt.key ? null : opt.key)}
        />
      ))}
      {options.length === 0 ? (
        <Text variant="meta" tone="muted" style={{ paddingVertical: space.sm }}>
          No collections yet
        </Text>
      ) : null}
      <View style={{ width: space.base }} />
      <View style={{ borderColor: c.hairline }} />
    </ScrollView>
  );
}

function Pill({
  label,
  icon,
  selected,
  onPress,
}: {
  label: string;
  icon?: IconName;
  selected: boolean;
  onPress: () => void;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.pill,
        {
          borderColor: selected ? c.accent : c.hairline,
          backgroundColor: selected ? c.surfaceRaised : 'transparent',
        },
        pressed && { opacity: 0.8 },
      ]}
    >
      {icon ? <Icon name={icon} size={13} color={selected ? c.accent : c.textMuted} /> : null}
      <Text variant="ui" tone={selected ? 'default' : 'muted'} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export { memoryTypeLabel };

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: radius.button,
    padding: 3,
    gap: 3,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    minHeight: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: space.sm,
  },
  tabCount: {
    minWidth: 20,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 999,
    alignItems: 'center',
  },
  stats: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: space.xs,
    paddingVertical: space.base,
    paddingHorizontal: space.sm,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderWidth: 1,
    borderRadius: radius.button,
    paddingHorizontal: space.md,
    minHeight: layout.minTouchTarget,
  },
  searchInput: { flex: 1, paddingVertical: space.md },
  rail: { gap: space.sm, paddingVertical: 2 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    minHeight: 36,
    paddingHorizontal: space.md,
    borderRadius: radius.avatar,
    borderWidth: 1,
  },
});
