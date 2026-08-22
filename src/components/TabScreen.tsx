/**
 * The shell every tab screen sits in: scrolling content above, tab bar pinned below.
 *
 * Separate from `Screen` because tab screens differ in two ways — they own the bottom
 * inset themselves (the bar covers it), and they never show a back button, because a
 * tab is a destination rather than a step.
 */

import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TabBar, type TabKey } from './TabBar';
import { useTheme } from '../state/theme';
import { layout, space } from '../theme/tokens';

export function TabScreen({
  active,
  children,
  scroll = true,
  contentStyle,
}: {
  active: TabKey;
  children: React.ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();

  const padding = {
    paddingTop: insets.top + space.md,
    // Clear the bar plus the FAB's overhang, so the last row is never half-hidden.
    paddingBottom: layout.tabBar + space.xxl,
  };

  function go(key: TabKey) {
    if (key === active) return;
    router.replace(
      key === 'home' ? '/' : key === 'explore' ? '/explore' : key === 'people' ? '/people' : '/me'
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: c.ink }]}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.content, padding, contentStyle]}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, styles.root, padding, contentStyle]}>{children}</View>
      )}

      <TabBar active={active} onSelect={go} onAdd={() => router.push('/add')} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: layout.gutter, gap: space.lg },
});
