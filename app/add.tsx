/**
 * Add a memory — the bottom sheet behind the FAB.
 *
 * The design collapses the old three-step wizard into one sheet, and the ordering is
 * the argument: the photo strip first, then one big box asking what the story is, and
 * only then the optional structure (when, where, who). Someone with something to say
 * can type it and post without ever touching a metadata row.
 *
 * The consent line stays. It is the one thing that cannot be optional — the MVP spec
 * requires the uploader to confirm they may share the image, and a memory can't be
 * posted without it.
 *
 * "Someone else is telling this" writes `creditedTo`. An adult usually holds the phone
 * while an elder talks, and without that field the archive would permanently record
 * the typist as the rememberer — the exact attribution error this product exists to
 * prevent.
 */

import { Image } from 'expo-image';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '../src/components/Button';
import { useConfirm, useToast } from '../src/components/feedback';
import { Icon, type IconName } from '../src/components/icons';
import { Text } from '../src/components/Text';
import { repository } from '../src/data';
import * as haptics from '../src/lib/haptics';
import { useSession } from '../src/state/auth';
import { useTheme } from '../src/state/theme';
import { fonts, type as scale } from '../src/theme/typography';
import { layout, radius, space } from '../src/theme/tokens';

const MAX_EDGE = 2048;

interface Picked {
  uri: string;
  width: number;
  height: number;
}

export default function AddMemory() {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const insets = useSafeAreaInsets();
  const { uid } = useSession();
  const { c } = useTheme();

  const [photos, setPhotos] = useState<Picked[]>([]);
  const [mode, setMode] = useState<'type' | 'speak'>('type');
  const [story, setStory] = useState('');
  const [when, setWhen] = useState('');
  const [where, setWhere] = useState('');
  const [credited, setCredited] = useState('');
  const [creditOn, setCreditOn] = useState(false);
  const [consent, setConsent] = useState(false);
  const [expanded, setExpanded] = useState<'when' | 'where' | 'who' | null>(null);
  const [saving, setSaving] = useState(false);

  const cover = photos[0] ?? null;
  // A title is not asked for — the design does not have one — so the first line of
  // the story becomes it, which is how people naturally start ("The summer we all
  // went to Murree...").
  const derivedTitle = story.trim().split(/[\n.!?]/)[0]?.trim().slice(0, 120) ?? '';
  const canPost = Boolean(cover) && story.trim().length > 0 && consent && !saving;

  async function pick(source: 'library' | 'camera') {
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });

    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];

    // Downscale before it ever touches the network.
    let out: Picked = { uri: asset.uri, width: asset.width, height: asset.height };
    const longEdge = Math.max(asset.width, asset.height);
    if (longEdge > MAX_EDGE) {
      const scaleBy = MAX_EDGE / longEdge;
      const rendered = await ImageManipulator.manipulate(asset.uri)
        .resize({
          width: Math.round(asset.width * scaleBy),
          height: Math.round(asset.height * scaleBy),
        })
        .renderAsync();
      const saved = await rendered.saveAsync({ compress: 0.85, format: SaveFormat.JPEG });
      out = { uri: saved.uri, width: saved.width, height: saved.height };
    }

    haptics.selected();
    // One photograph, replaced rather than appended.
    //
    // The strip used to accept any number, badge the first "Cover", and then post
    // only that one — the rest were dropped on submit with nothing said. A memory is
    // built around a single image all the way down: `memories.image_path` is one
    // column, the story composer reasons about one picture, and the guest screen shows
    // one. Accepting more was an affordance the whole product cannot honour.
    setPhotos([out]);
  }

  /**
   * Closing this sheet after typing used to throw the memory away without a word.
   * That is the one thing this screen must not do: the text box is where somebody
   * writes down what they remember about a photograph of a person who may be gone,
   * and a mistaken tap on the close dot is not consent to delete it.
   */
  async function close() {
    const hasWork = Boolean(cover) || story.trim().length > 0;
    if (hasWork && !saving) {
      const ok = await confirm({
        title: 'Discard this memory?',
        body: 'The photo and what you have written here have not been posted yet.',
        confirmLabel: 'Discard',
        destructive: true,
      });
      if (!ok) return;
    }
    router.back();
  }

  async function post() {
    if (!uid || !cover || !canPost) return;
    setSaving(true);
    try {
      const memory = await repository().createMemory(uid, {
        title: derivedTitle || 'Untitled memory',
        // The sheet does not ask for a type; 'family' is the default the design
        // implies and it can be changed on the memory page.
        memoryType: 'family',
        localImageUri: cover.uri,
        imageWidth: cover.width,
        imageHeight: cover.height,
        originalRemark: story.trim(),
        dateHint: when.trim() || null,
        locationHint: where.trim() || null,
        creditedTo: creditOn && credited.trim() ? credited.trim() : null,
        permissionConfirmed: true,
      });
      toast('Memory posted.', 'good');
      router.replace({ pathname: '/memory/[id]', params: { id: memory.id } });
    } catch (e) {
      toast(e instanceof Error ? e.message : 'That could not be posted.', 'bad');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: c.ink }]}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* ------------------------------------------------------------ head
            The top inset is applied here, not in the stylesheet.

            This is the one screen in the app that does not go through `Screen` or
            `TabScreen`, so nothing reserved room for the status bar — and
            Android has been edge-to-edge by default since SDK 53, with Android 15
            enforcing it outright. The close button and the title were being drawn
            underneath the clock and the notification icons. */}
        <View style={[styles.head, { paddingTop: insets.top + space.base }]}>
          <Pressable
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={8}
            style={[styles.closeDot, { backgroundColor: c.surfaceRaised }]}
          >
            <Icon name="close" size={18} color={c.text} />
          </Pressable>
          <Text variant="heading">Add a memory</Text>
          <View style={styles.closeDot} />
        </View>

        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* -------------------------------------------------- photo strip */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.strip}
          >
            {/* A "Cover" badge only means something when there is a second photo for
                it to be the cover of. With one, it was labelling the only thing on
                screen. */}
            {photos.map((p) => (
              <View key={p.uri} style={styles.thumbWrap}>
                <Image source={{ uri: p.uri }} style={styles.thumb} contentFit="cover" />
                <Pressable
                  onPress={() => setPhotos((all) => all.filter((x) => x.uri !== p.uri))}
                  accessibilityRole="button"
                  accessibilityLabel="Remove this photo"
                  hitSlop={8}
                  style={[styles.removeDot, { backgroundColor: c.inkButton }]}
                >
                  <Icon name="close" size={12} color={c.onInkButton} />
                </Pressable>
              </View>
            ))}

            <Pressable
              onPress={() => pick('library')}
              accessibilityRole="button"
              accessibilityLabel={cover ? 'Choose a different photo' : 'Add photo'}
              style={[styles.addPhoto, { borderColor: c.hairline }]}
            >
              <Icon name="image" size={20} color={c.textMuted} />
              <Text variant="meta" tone="muted">
                {cover ? 'Replace' : 'Add photo'}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => pick('camera')}
              accessibilityRole="button"
              accessibilityLabel={cover ? 'Take a different photo' : 'Take a photo'}
              style={[styles.addPhoto, { borderColor: c.hairline }]}
            >
              <Icon name="camera" size={20} color={c.textMuted} />
              <Text variant="meta" tone="muted">
                Camera
              </Text>
            </Pressable>
          </ScrollView>

          {/* ------------------------------------------------ type / speak */}
          <View style={[styles.segment, { backgroundColor: c.surfaceRaised }]}>
            <SegmentButton
              icon="keyboard"
              label="Type it"
              active={mode === 'type'}
              onPress={() => setMode('type')}
            />
            <SegmentButton
              icon="mic"
              label="Speak it"
              active={mode === 'speak'}
              onPress={() => setMode('speak')}
            />
          </View>

          {mode === 'speak' ? (
            <View style={[styles.speakNote, { borderColor: c.hairline }]}>
              <Icon name="mic" size={18} color={c.textMuted} />
              <Text variant="label" tone="muted" style={styles.grow}>
                Speaking a memory needs on-device dictation, which only exists in a
                development build — not in the browser. Until then, use your keyboard&apos;s
                own microphone key, which types straight into the box below.
              </Text>
            </View>
          ) : null}

          {/* -------------------------------------------------------- story */}
          <TextInput
            value={story}
            onChangeText={setStory}
            placeholder="What's the story? Who's in it, where were you, what do you remember..."
            placeholderTextColor={c.textMuted}
            multiline
            maxLength={2000}
            accessibilityLabel="What's the story?"
            style={[
              scale.bodyLarge,
              styles.storyInput,
              {
                color: c.text,
                borderColor: c.hairline,
                backgroundColor: c.surface,
                fontFamily: fonts.regular,
              },
            ]}
          />

          {/* ------------------------------------------------------ details */}
          <View style={[styles.details, { borderColor: c.hairline }]}>
            <DetailRow
              icon="calendar"
              label="When"
              value={when}
              placeholder="Add a date"
              open={expanded === 'when'}
              onToggle={() => setExpanded(expanded === 'when' ? null : 'when')}
              onChange={setWhen}
              hint="However you remember it — “1987”, “Summer 1994”, “sometime in the 80s”."
            />
            <View style={[styles.hair, { backgroundColor: c.hairline }]} />
            <DetailRow
              icon="pin"
              label="Where"
              value={where}
              placeholder="Add a place"
              open={expanded === 'where'}
              onToggle={() => setExpanded(expanded === 'where' ? null : 'where')}
              onChange={setWhere}
            />
            <View style={[styles.hair, { backgroundColor: c.hairline }]} />
            <DetailRow
              icon="tag"
              label="Who's in it"
              value=""
              placeholder="Tag people"
              open={false}
              disabled
              onToggle={() => {}}
              onChange={() => {}}
              hint="Face tagging is not built yet — for now, name people in the story itself."
            />
          </View>

          {/* ---------------------------------------------- credit someone */}
          <View style={[styles.credit, { backgroundColor: c.surfaceRaised }]}>
            <View style={styles.creditHead}>
              <View style={styles.grow}>
                <Text variant="ui">Someone else is telling this</Text>
                <Text variant="label" tone="muted">
                  {creditOn ? 'Credit the story to them' : 'Turn on if you are holding the phone'}
                </Text>
              </View>
              <Toggle
                on={creditOn}
                onToggle={() => {
                  haptics.selected();
                  setCreditOn((v) => !v);
                }}
                label="Someone else is telling this"
              />
            </View>

            {creditOn ? (
              <TextInput
                value={credited}
                onChangeText={setCredited}
                placeholder="Their name — Nani, Abbu, Khalid"
                placeholderTextColor={c.textMuted}
                maxLength={60}
                accessibilityLabel="Who is telling this"
                style={[
                  scale.ui,
                  styles.creditInput,
                  { color: c.text, borderColor: c.hairline, fontFamily: fonts.regular },
                ]}
              />
            ) : null}
          </View>

          {/* -------------------------------------------------------- consent */}
          <Pressable
            onPress={() => {
              haptics.selected();
              setConsent((v) => !v);
            }}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: consent }}
            aria-checked={consent}
            accessibilityLabel="I have permission to share this photo"
            style={styles.consent}
          >
            <View
              style={[
                styles.box,
                { borderColor: consent ? c.accent : c.hairline },
                consent && { backgroundColor: c.accent },
              ]}
            >
              {consent ? <Icon name="check" size={13} color={c.onAccent} /> : null}
            </View>
            <Text variant="label" tone="muted" style={styles.grow}>
              I have permission to share this photo. TellaTale will not try to identify
              anyone in it.
            </Text>
          </Pressable>
        </ScrollView>

        {/* ------------------------------------------------------------ post */}
        <View
          style={[
            styles.foot,
            { borderTopColor: c.hairline, paddingBottom: Math.max(insets.bottom, space.base) },
          ]}
        >
          <Button label="Post" full disabled={!canPost} loading={saving} onPress={post} />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

/* ------------------------------------------------------------------ pieces */

function SegmentButton({
  icon,
  label,
  active,
  onPress,
}: {
  icon: IconName;
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
      aria-selected={active}
      accessibilityLabel={label}
      style={[styles.segButton, active && { backgroundColor: c.surface }]}
    >
      <Icon name={icon} size={17} color={active ? c.text : c.textMuted} />
      <Text variant="ui" tone={active ? 'default' : 'muted'}>
        {label}
      </Text>
    </Pressable>
  );
}

function DetailRow({
  icon,
  label,
  value,
  placeholder,
  open,
  disabled,
  hint,
  onToggle,
  onChange,
}: {
  icon: IconName;
  label: string;
  value: string;
  placeholder: string;
  open: boolean;
  disabled?: boolean;
  hint?: string;
  onToggle: () => void;
  onChange: (v: string) => void;
}) {
  const { c } = useTheme();
  return (
    <View>
      <Pressable
        onPress={disabled ? undefined : onToggle}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value || placeholder}`}
        disabled={disabled}
        style={[styles.detailRow, disabled && { opacity: 0.55 }]}
      >
        <Icon name={icon} size={18} color={c.textMuted} />
        <Text variant="ui" style={styles.grow}>
          {label}
        </Text>
        <Text variant="ui" tone={value ? 'default' : 'muted'}>
          {value || placeholder}
        </Text>
      </Pressable>

      {open && !disabled ? (
        <View style={styles.detailOpen}>
          <TextInput
            value={value}
            onChangeText={onChange}
            placeholder={placeholder}
            placeholderTextColor={c.textMuted}
            autoFocus
            maxLength={120}
            accessibilityLabel={label}
            style={[
              scale.ui,
              styles.detailInput,
              { color: c.text, borderColor: c.hairline, fontFamily: fonts.regular },
            ]}
          />
          {hint ? (
            <Text variant="meta" tone="muted">
              {hint}
            </Text>
          ) : null}
        </View>
      ) : null}

      {disabled && hint ? (
        <Text variant="meta" tone="muted" style={styles.disabledHint}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

function Toggle({
  on,
  onToggle,
  label,
}: {
  on: boolean;
  onToggle: () => void;
  label: string;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      aria-checked={on}
      accessibilityLabel={label}
      style={[styles.track, { backgroundColor: on ? c.accent : c.hairline }]}
    >
      <View style={[styles.knob, { backgroundColor: '#FFFFFF' }, on && styles.knobOn]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.gutter,
    // paddingTop is set inline from the safe-area inset; see the head block.
    paddingBottom: space.md,
  },
  closeDot: {
    width: 34,
    height: 34,
    borderRadius: radius.avatar,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { paddingHorizontal: layout.gutter, paddingBottom: space.xxl, gap: space.base },

  strip: { gap: space.sm },
  thumbWrap: { width: 96, height: 96 },
  thumb: { width: 96, height: 96, borderRadius: radius.image },
  removeDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhoto: {
    width: 96,
    height: 96,
    borderRadius: radius.image,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },

  segment: { flexDirection: 'row', borderRadius: radius.pill, padding: 4, gap: 4 },
  segButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    minHeight: 42,
    borderRadius: radius.pill,
  },
  speakNote: {
    flexDirection: 'row',
    gap: space.md,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radius.button,
    padding: space.md,
  },

  storyInput: {
    minHeight: 150,
    borderWidth: 1,
    borderRadius: radius.button,
    padding: space.base,
    textAlignVertical: 'top',
  },

  details: { borderWidth: 1, borderRadius: radius.button, overflow: 'hidden' },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.base,
    minHeight: 54,
  },
  detailOpen: { paddingHorizontal: space.base, paddingBottom: space.md, gap: space.sm },
  detailInput: { borderWidth: 1, borderRadius: radius.button, padding: space.md, minHeight: 46 },
  disabledHint: { paddingHorizontal: space.base, paddingBottom: space.md },
  hair: { height: StyleSheet.hairlineWidth },

  credit: { borderRadius: radius.button, padding: space.base, gap: space.md },
  creditHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  creditInput: { borderWidth: 1, borderRadius: radius.button, padding: space.md, minHeight: 46 },

  consent: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingVertical: 4 },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  track: { width: 48, height: 28, borderRadius: 14, padding: 3, justifyContent: 'center' },
  knob: { width: 22, height: 22, borderRadius: 11 },
  knobOn: { alignSelf: 'flex-end' },

  foot: { borderTopWidth: StyleSheet.hairlineWidth, padding: layout.gutter },
  grow: { flex: 1 },
});
