/**
 * The bottom bar: Home · Explore · [+] · Family · Me.
 *
 * The FAB is not a tab. It sits in the tab row, but it opens the "Add a memory" sheet
 * rather than navigating, and it is the only crimson thing in the bar — the design
 * puts the app's whole purpose under the thumb and leaves the four actual tabs quiet
 * in monochrome around it.
 *
 * It overhangs the bar's top edge, so the bar cannot clip its children.
 */

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from './icons';
import { Text } from './Text';
import * as haptics from '../lib/haptics';
import { useTheme } from '../state/theme';
import { elevation, layout, radius, space } from '../theme/tokens';

export type TabKey = 'home' | 'explore' | 'people' | 'me';

interface Tab {
  key: TabKey;
  label: string;
  icon: IconName;
}

const TABS: Tab[] = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'explore', label: 'Explore', icon: 'compass' },
  { key: 'people', label: 'People', icon: 'people' },
  { key: 'me', label: 'Me', icon: 'user' },
];

export function TabBar({
  active,
  onSelect,
  onAdd,
}: {
  active: TabKey;
  onSelect: (key: TabKey) => void;
  onAdd: () => void;
}) {
  const { c, name } = useTheme();
  const insets = useSafeAreaInsets();

  const left = TABS.slice(0, 2);
  const right = TABS.slice(2);

  const renderTab = (tab: Tab) => {
    const selected = tab.key === active;
    return (
      <Pressable
        key={tab.key}
        onPress={() => {
          if (!selected) haptics.selected();
          onSelect(tab.key);
        }}
        accessibilityRole="tab"
        accessibilityState={{ selected }}
        // react-native-web drops accessibilityState.selected for role=tab, so the
        // bottom navigation announced four tabs and never which one you were on.
        aria-selected={selected}
        accessibilityLabel={tab.label}
        style={styles.tab}
      >
        <Icon
          name={tab.icon}
          size={22}
          color={selected ? c.text : c.textMuted}
          filled={selected}
        />
        <Text variant="meta" tone={selected ? 'default' : 'muted'}>
          {tab.label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: c.surface,
          borderTopColor: c.hairline,
          paddingBottom: Math.max(insets.bottom, space.sm),
        },
        elevation(name, 'bar'),
      ]}
    >
      {left.map(renderTab)}

      {/* Occupies the slot so the four tabs stay evenly spaced; the FAB itself is
          absolutely positioned so it can overhang the bar. */}
      <View style={styles.fabSlot} />

      {right.map(renderTab)}

      <Pressable
        onPress={() => {
          haptics.contributed();
          onAdd();
        }}
        accessibilityRole="button"
        accessibilityLabel="Add a memory"
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: c.accent },
          elevation(name, 'raised'),
          pressed && { opacity: 0.9, transform: [{ scale: 0.96 }] },
        ]}
      >
        <Icon name="plus" size={26} color={c.onAccent} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: space.sm,
    minHeight: layout.tabBar,
    // The FAB overhangs the top edge.
    overflow: 'visible',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingTop: 2,
    minHeight: layout.minTouchTarget - 8,
  },
  fabSlot: { flex: 1 },
  fab: {
    position: 'absolute',
    alignSelf: 'center',
    left: '50%',
    marginLeft: -(layout.fab / 2),
    top: -(layout.fab / 2) + 6,
    width: layout.fab,
    height: layout.fab,
    borderRadius: radius.avatar,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
