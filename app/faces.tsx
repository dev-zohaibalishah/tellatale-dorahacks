/**
 * Tag faces — naming the people in your photographs.
 *
 * The design says "4 faces still waiting for a name". This screen cannot say that,
 * and the difference matters enough to be worth the paragraph: counting faces
 * requires detecting faces, and nothing in this app looks at an image. Claiming a
 * number would mean inventing one, on the screen whose entire purpose is to stop
 * who's-who from being lost.
 *
 * So it counts what it actually knows — photographs with nobody named on them yet —
 * and asks for the names rather than the boxes. The names are the part that survives:
 * a rectangle around a face is worth nothing in thirty years if no one wrote down
 * whose face it was, and a name is worth everything even without the rectangle.
 */

import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Button } from '../src/components/Button';
import { Header, Skeleton } from '../src/components/chrome';
import { useToast } from '../src/components/feedback';
import { Icon } from '../src/components/icons';
import { EmptyState, Screen } from '../src/components/layout';
import { PhotoPlate } from '../src/components/PhotoPlate';
import { Text } from '../src/components/Text';
import { repository } from '../src/data';
import { useImageUrl, useMemories } from '../src/hooks/repo';
import * as haptics from '../src/lib/haptics';
import { useSession } from '../src/state/auth';
import { useTheme } from '../src/state/theme';
import { layout, radius, space } from '../src/theme/tokens';
import type { FaceName } from '../src/data/repository';
import type { Memory } from '../shared/story';

export default function Faces() {
  const router = useRouter();
  const { uid } = useSession();
  const { c } = useTheme();
  const { data: memories, loading } = useMemories(uid);

  // Which memories already have somebody named. Loaded once for the whole list
  // rather than per card, so the header can count before anything renders.
  const [named, setNamed] = useState<Record<string, FaceName[]>>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (memories.length === 0) {
      setReady(true);
      return;
    }
    let cancelled = false;
    void Promise.all(
      memories.map(async (m) => [m.id, await repository().listFaceNames(m.id)] as const)
    )
      .then((pairs) => {
        if (cancelled) return;
        setNamed(Object.fromEntries(pairs));
        setReady(true);
      })
      .catch(() => !cancelled && setReady(true));
    return () => {
      cancelled = true;
    };
  }, [memories]);

  const unnamed = memories.filter((m) => (named[m.id] ?? []).length === 0);

  return (
    <Screen>
      <Header onBack={() => router.back()} title="Tag faces" />

      {/* No note at all when there are no photographs. "Everyone is named" above an
          empty archive is true and useless, and sat directly on top of "No photos
          yet" — two sentences contradicting each other in the same breath. */}
      {memories.length > 0 || !ready || loading ? (
        <View style={[styles.note, { backgroundColor: c.surfaceRaised }]}>
          <Text variant="label" tone="muted">
            {!ready || loading
              ? 'Counting what still needs a name…'
              : unnamed.length === 0
                ? 'Everyone is named. Every photo here has at least one person written down.'
                : `${unnamed.length} ${unnamed.length === 1 ? 'photo has' : 'photos have'} nobody named yet. Naming them keeps who's-who from being lost.`}
          </Text>
        </View>
      ) : null}

      {loading || !ready ? (
        <View style={styles.list}>
          <Skeleton height={72} />
          <Skeleton height={72} />
        </View>
      ) : memories.length === 0 ? (
        <EmptyState line="No photos yet. Add a memory and you can name the people in it." />
      ) : (
        <View style={styles.list}>
          {memories.map((memory) => (
            <FaceRow
              key={memory.id}
              memory={memory}
              names={named[memory.id] ?? []}
              onChange={(next) => setNamed((all) => ({ ...all, [memory.id]: next }))}
            />
          ))}
        </View>
      )}

      <Text variant="meta" tone="muted">
        TellaTale does not scan photographs or recognise faces. These names are written
        by you, kept with the photo, and visible only to you.
      </Text>
    </Screen>
  );
}

function FaceRow({
  memory,
  names,
  onChange,
}: {
  memory: Memory;
  names: FaceName[];
  onChange: (next: FaceName[]) => void;
}) {
  const { c } = useTheme();
  const toast = useToast();
  const { url, failed } = useImageUrl(memory.imagePath);

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const stamp = [memory.locationHint, memory.dateHint].filter(Boolean).join(', ');

  async function add() {
    const name = draft.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      const face = await repository().addFaceName(memory.id, name, null);
      onChange([...names, face]);
      setDraft('');
      haptics.succeeded();
    } catch (e) {
      haptics.failed();
      toast(e instanceof Error ? e.message : 'That name could not be saved.', 'bad');
    } finally {
      setBusy(false);
    }
  }

  async function remove(face: FaceName) {
    try {
      await repository().removeFaceName(face.id);
      onChange(names.filter((f) => f.id !== face.id));
    } catch (e) {
      toast(e instanceof Error ? e.message : 'That could not be removed.', 'bad');
    }
  }

  return (
    <View style={[styles.card, { borderColor: c.hairline }]}>
      <Pressable
        onPress={() => {
          haptics.selected();
          setOpen((v) => !v);
        }}
        accessibilityRole="button"
        accessibilityLabel={`${memory.title}. ${names.length === 0 ? 'Nobody named yet' : `${names.length} named`}`}
        accessibilityState={{ expanded: open }}
        style={styles.row}
      >
        <View style={styles.thumb}>
          <PhotoPlate uri={url} failed={failed} aspect={1} rounded={false} />
        </View>

        <View style={styles.grow}>
          <Text variant="uiStrong" numberOfLines={1}>
            {names.length === 0 ? 'Who’s this?' : memory.title}
          </Text>
          <Text variant="label" tone="muted" numberOfLines={1}>
            {stamp || memory.title}
          </Text>
          {names.length > 0 ? (
            <Text variant="meta" tone="muted" numberOfLines={1}>
              {names.map((f) => f.name).join(', ')}
            </Text>
          ) : null}
        </View>

        {/* Styled to read as a button, and deliberately not one. The whole row is
            already the control, and a real <Button> inside a Pressable nests a button
            inside a button — invalid HTML on web, and a screen reader announcing two
            controls where a person can only press one thing. */}
        <View
          style={[
            styles.action,
            names.length === 0
              ? { backgroundColor: c.inkButton }
              : { borderColor: c.hairline, borderWidth: 1 },
          ]}
        >
          <Text
            variant="uiStrong"
            style={names.length === 0 ? { color: c.onInkButton } : undefined}
          >
            {names.length === 0 ? 'Name' : 'Edit'}
          </Text>
        </View>
      </Pressable>

      {open ? (
        <View style={styles.editor}>
          {names.length > 0 ? (
            <View style={styles.chips}>
              {names.map((face) => (
                <View
                  key={face.id}
                  style={[styles.chip, { borderColor: c.hairline, backgroundColor: c.surfaceRaised }]}
                >
                  <Text variant="ui">{face.name}</Text>
                  <Pressable
                    onPress={() => void remove(face)}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${face.name}`}
                    hitSlop={8}
                  >
                    <Icon name="close" size={13} color={c.textMuted} />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.addRow}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Nani, Abbu, Khalid…"
              placeholderTextColor={c.textMuted}
              maxLength={60}
              onSubmitEditing={add}
              returnKeyType="done"
              accessibilityLabel={`Add a name to ${memory.title}`}
              style={[
                styles.input,
                { color: c.text, backgroundColor: c.surface, borderColor: c.hairline },
              ]}
            />
            <Button
              label="Add"
              variant="accent"
              size="compact"
              loading={busy}
              disabled={draft.trim().length === 0 || busy}
              onPress={add}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  note: { borderRadius: radius.card, padding: space.base },
  list: { gap: space.md },
  card: { borderWidth: 1, borderRadius: radius.card, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  thumb: { width: 56, height: 56, borderRadius: radius.button, overflow: 'hidden' },
  action: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: space.base,
    borderRadius: radius.pill,
  },
  grow: { flex: 1, gap: 2 },
  editor: { paddingHorizontal: space.md, paddingBottom: space.md, gap: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    minHeight: 36,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  input: {
    flex: 1,
    minHeight: layout.minTouchTarget,
    borderRadius: radius.button,
    borderWidth: 1,
    paddingHorizontal: space.base,
  },
});
