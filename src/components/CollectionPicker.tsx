/**
 * Filing a memory into collections.
 *
 * Multi-select, because a photograph genuinely belongs to more than one thing — the
 * Murree trip AND Nani's house. Forcing a single choice is the mistake folders make
 * and the reason people stop filing things at all.
 *
 * Saves on toggle rather than behind a "Done" button. There is nothing to get wrong
 * and nothing to lose, so a confirmation step would only add a way to abandon the
 * change by accident.
 */

import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from './icons';
import { Text } from './Text';
import { Row } from './layout';
import { collectionIcon } from './labels';
import { useToast } from './feedback';
import { repository } from '../data';
import type { Collection } from '../data/repository';
import { useTheme } from '../state/theme';
import { radius, space } from '../theme/tokens';

export function CollectionPicker({
  memoryId,
  uid,
}: {
  memoryId: string;
  uid: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const { c } = useTheme();

  const [collections, setCollections] = useState<Collection[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    void Promise.all([
      repository().listCollections(uid),
      repository().collectionsForMemory(memoryId),
    ])
      .then(([all, mine]) => {
        if (cancelled) return;
        setCollections(all);
        setSelected(new Set(mine));
      })
      .catch(() => {
        /* the section simply does not render rather than erroring the whole screen */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [memoryId, uid]);

  async function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);

    // Optimistic: the tap is the answer, and a round trip before the checkbox moves
    // makes the control feel broken on a slow connection.
    setSelected(next);
    try {
      await repository().setMemoryCollections(memoryId, [...next]);
    } catch (e) {
      setSelected(selected);
      toast(e instanceof Error ? e.message : 'That could not be saved.', 'bad');
    }
  }

  if (loading) return null;

  return (
    <View style={styles.block}>
      <Row style={styles.head}>
        <Text variant="eyebrow" tone="muted">
          Collections
        </Text>
        <Pressable
          onPress={() => router.push('/collection/new')}
          accessibilityRole="button"
          accessibilityLabel="New collection"
          hitSlop={8}
        >
          <Text variant="meta" tone="accent">
            New
          </Text>
        </Pressable>
      </Row>

      {collections.length === 0 ? (
        <Text variant="meta" tone="muted">
          No collections yet. Create one to group this with the memories it belongs
          beside.
        </Text>
      ) : (
        <View style={styles.wrap}>
          {collections.map((col) => {
            const on = selected.has(col.id);
            return (
              <Pressable
                key={col.id}
                onPress={() => toggle(col.id)}
                accessibilityRole="checkbox"
                aria-checked={on}
                accessibilityState={{ checked: on }}
                accessibilityLabel={col.name}
                style={({ pressed }) => [
                  styles.chip,
                  {
                    borderColor: on ? c.accent : c.hairline,
                    backgroundColor: on ? c.surfaceRaised : 'transparent',
                  },
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Icon
                  name={on ? 'check' : collectionIcon(col.kind)}
                  size={13}
                  color={on ? c.accent : c.textMuted}
                />
                <Text variant="ui" tone={on ? 'default' : 'muted'}>
                  {col.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.md },
  head: { justifyContent: 'space-between' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    minHeight: 38,
    paddingHorizontal: space.md,
    borderRadius: radius.avatar,
    borderWidth: 1,
  },
});
