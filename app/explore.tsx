/**
 * Explore — the archive by decade, and by who and where.
 *
 * Timeline groups memories into decades from `dateHint`. That field is free text by
 * design ("1987", "Summer 1994", "Sometime in the 1980s"), because forcing a date
 * picker on someone remembering their grandmother's kitchen is how you lose the
 * memory. So the grouping parses what it can and gathers the rest under "Undated"
 * rather than guessing a year.
 */

import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Skeleton } from '../src/components/chrome';
import { SectionRow } from '../src/components/home-ui';
import { EmptyState } from '../src/components/layout';
import { PhotoPlate } from '../src/components/PhotoPlate';
import { TabScreen } from '../src/components/TabScreen';
import { Text } from '../src/components/Text';
import { useImageUrl, useMemories } from '../src/hooks/repo';
import * as haptics from '../src/lib/haptics';
import { useSession } from '../src/state/auth';
import { useTheme } from '../src/state/theme';
import { radius, space } from '../src/theme/tokens';
import type { Memory } from '../shared/story';

type Tab = 'timeline' | 'people';

/** Pull a 4-digit year out of free text; null when there isn't one to find. */
function yearOf(hint: string | null): number | null {
  if (!hint) return null;
  const match = /\b(1[89]\d{2}|20\d{2})\b/.exec(hint);
  return match ? Number(match[1]) : null;
}

function decadeLabel(year: number): string {
  return `${Math.floor(year / 10) * 10}s`;
}

export default function Explore() {
  const { uid } = useSession();
  const { c } = useTheme();
  const { data: memories, loading } = useMemories(uid);
  const [tab, setTab] = useState<Tab>('timeline');

  const decades = useMemo(() => {
    const groups = new Map<string, Memory[]>();
    const undated: Memory[] = [];

    for (const m of memories) {
      const year = yearOf(m.dateHint);
      if (year === null) {
        undated.push(m);
        continue;
      }
      const key = decadeLabel(year);
      groups.set(key, [...(groups.get(key) ?? []), m]);
    }

    const ordered = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    if (undated.length) ordered.push(['Undated', undated]);
    return ordered;
  }, [memories]);

  const places = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of memories) {
      const p = m.locationHint?.trim();
      if (p) counts.set(p, (counts.get(p) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [memories]);

  return (
    <TabScreen active="explore">
      <Text variant="title">Explore</Text>

      <View style={styles.tabs}>
        <TabLink label="Timeline" active={tab === 'timeline'} onPress={() => setTab('timeline')} />
        <TabLink
          label="People & Places"
          active={tab === 'people'}
          onPress={() => setTab('people')}
        />
      </View>

      {loading ? (
        <View style={styles.stack}>
          <Skeleton height={130} />
          <Skeleton height={130} />
        </View>
      ) : memories.length === 0 ? (
        <EmptyState line="Nothing to explore yet. Once you add memories they gather here by decade, and by the people and places in them." />
      ) : tab === 'timeline' ? (
        <View style={styles.stack}>
          {decades.map(([label, items]) => (
            <View key={label} style={styles.decade}>
              {/* Decade headings are title-case at heading size in the design, so
                  they do not use SectionRow — that renders an uppercase eyebrow. */}
              <View style={styles.decadeHead}>
                <Text variant="heading">{label}</Text>
                <Text variant="label" tone="muted">
                  {items.length} {items.length === 1 ? 'memory' : 'memories'}
                </Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.rail}
              >
                {items.map((m) => (
                  <Thumb key={m.id} memory={m} />
                ))}
              </ScrollView>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.stack}>
          <SectionRow title="Places" actionLabel={`${places.length}`} />
          {places.length === 0 ? (
            <Text variant="body" tone="muted">
              No places yet. Add a “where” to a memory and it appears here.
            </Text>
          ) : (
            <View style={styles.placeWrap}>
              {places.map(([place, count]) => (
                <View
                  key={place}
                  style={[styles.placeChip, { backgroundColor: c.surfaceRaised }]}
                >
                  <Text variant="ui">{place}</Text>
                  <Text variant="label" tone="muted">
                    {count}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* People come from face tags, which the schema does not model yet. Showing
              an empty shelf is honest; inventing names would not be. */}
          <SectionRow title="People" />
          <Text variant="body" tone="muted">
            Tagging people in photos is not built yet. When it is, everyone who appears
            in your archive will be listed here.
          </Text>
        </View>
      )}
    </TabScreen>
  );
}

function TabLink({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={() => {
        if (!active) haptics.selected();
        onPress();
      }}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={[styles.tabLink, active && { borderBottomColor: c.text }]}
    >
      <Text variant="uiStrong" tone={active ? 'default' : 'muted'}>
        {label}
      </Text>
    </Pressable>
  );
}

function Thumb({ memory }: { memory: Memory }) {
  const router = useRouter();
  const { url, failed } = useImageUrl(memory.imagePath);

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/memory/[id]', params: { id: memory.id } })}
      accessibilityRole="button"
      accessibilityLabel={memory.title}
      style={({ pressed }) => [styles.thumb, pressed && { opacity: 0.85 }]}
    >
      <PhotoPlate uri={url} failed={failed} aspect={1} rounded accessibilityLabel={memory.title} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: space.lg },
  tabLink: { paddingBottom: space.sm, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  stack: { gap: space.xl },
  decade: { gap: space.sm },
  decadeHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rail: { gap: space.sm },
  thumb: { width: 128, borderRadius: radius.image, overflow: 'hidden' },
  placeWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  placeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.base,
    minHeight: 40,
    borderRadius: radius.pill,
  },
});
