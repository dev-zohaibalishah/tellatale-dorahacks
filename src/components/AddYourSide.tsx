/**
 * "Add your side" — the contributor's sheet.
 *
 * A sheet rather than a route, and that is the point of it. The reader has just
 * finished someone else's account of an afternoon and wants to say "no, it was the
 * year before" — sending them to a different screen loses the thing they were
 * answering. The story stays behind the sheet, and dismissing it puts them back
 * exactly where they were reading.
 *
 * Deliberately not the owner's compose sheet in disguise. A contributor is adding an
 * account to a photograph that already exists, so there is no photo to choose, no
 * title to invent and no consent to give — the owner already attested to the image.
 * What is left is the only thing worth asking for: what they remember, in their words.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from './Button';
import { useToast } from './feedback';
import { Icon, type IconName } from './icons';
import { PhotoPlate } from './PhotoPlate';
import { Text } from './Text';
import { repository } from '../data';
import {
  appendTranscript,
  dictationAvailable,
  useDictation,
} from '../hooks/useDictation';
import { track } from '../lib/analytics';
import * as haptics from '../lib/haptics';
import { useTheme } from '../state/theme';
import { fonts, type as scale } from '../theme/typography';
import { layout, radius, space } from '../theme/tokens';
import { Certainty, certaintyLabel } from '../../shared/story';

export function AddYourSide({
  visible,
  token,
  coverUrl,
  onClose,
  onAdded,
}: {
  visible: boolean;
  token: string | undefined;
  coverUrl: string | null;
  onClose: () => void;
  onAdded: () => void;
}) {
  const { c } = useTheme();
  const toast = useToast();
  const insets = useSafeAreaInsets();

  const [text, setText] = useState('');
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [certainty, setCertainty] = useState<Certainty>('certain');
  const [when, setWhen] = useState('');
  const [where, setWhere] = useState('');
  const [creditOn, setCreditOn] = useState(false);
  const [credited, setCredited] = useState('');
  const [expanded, setExpanded] = useState<'when' | 'where' | null>(null);
  const [mode, setMode] = useState<'type' | 'speak'>('type');
  const [sending, setSending] = useState(false);

  const dictation = useDictation((said) =>
    setText((prev) => appendTranscript(prev, said))
  );
  const canDictate = useMemo(() => dictationAvailable(), []);
  const listening = dictation.status === 'listening';

  // Reset between openings. Leaving a previous draft in place would hand the next
  // contributor on a shared phone somebody else's half-written memory.
  useEffect(() => {
    if (visible) return;
    setText('');
    setWhen('');
    setWhere('');
    setCertainty('certain');
    setExpanded(null);
    setMode('type');
  }, [visible]);

  const valid = name.trim().length > 0 && text.trim().length > 0 && !sending;

  async function post() {
    if (!token || !valid) return;
    setSending(true);
    try {
      await repository().submitGuestRemark(token, {
        contributorName: name.trim(),
        relationship: relationship.trim() || null,
        text: text.trim(),
        certainty,
        dateHint: when.trim() || null,
        locationHint: where.trim() || null,
      });
      track({ name: 'remark_added', certainty });
      haptics.succeeded();
      onAdded();
    } catch (e) {
      haptics.failed();
      toast(e instanceof Error ? e.message : 'That could not be sent.', 'bad');
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <View style={styles.scrim}>
        {/* Tapping the dimmed story behind closes the sheet, which is the gesture the
            shape promises. `accessible={false}` keeps it out of the reading order —
            it is a gesture target, not a control. */}
        <Pressable
          accessible={false}
          style={styles.scrimTap}
          onPress={onClose}
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetWrap}
        >
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: c.ink,
                borderColor: c.hairline,
                paddingBottom: Math.max(insets.bottom, space.base),
              },
            ]}
          >
            <View style={[styles.grabber, { backgroundColor: c.hairline }]} />

            <View style={styles.head}>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={8}
                style={[styles.closeDot, { backgroundColor: c.surfaceRaised }]}
              >
                <Icon name="close" size={18} color={c.text} />
              </Pressable>
              <Text variant="heading">Add your side</Text>
              <View style={styles.closeDot} />
            </View>

            <ScrollView
              contentContainerStyle={styles.body}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* The photograph, as context rather than as an input.
                  The design shows a picker here with a second image and an "Add photo"
                  tile. A remark carries no image in this schema — `remarks` has a body
                  and no path — so an Add photo tile would take a file and drop it on
                  submit. This is what is being remembered, shown so the writer can see
                  it while they write. */}
              <View style={styles.coverRow}>
                <View style={[styles.cover, { borderColor: c.hairline }]}>
                  <PhotoPlate uri={coverUrl} aspect={1} rounded={false} />
                </View>
                <Text variant="label" tone="muted" style={styles.grow}>
                  You&apos;re adding to this photo. Your words are kept as you wrote
                  them, with your name on them.
                </Text>
              </View>

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
                canDictate ? (
                  <View
                    style={[
                      styles.speakNote,
                      { borderColor: listening ? c.accent : c.hairline },
                    ]}
                  >
                    <Pressable
                      onPress={dictation.toggle}
                      accessibilityRole="button"
                      accessibilityLabel={listening ? 'Stop dictating' : 'Start dictating'}
                      style={[
                        styles.micButton,
                        { backgroundColor: listening ? c.accent : c.inkButton },
                      ]}
                    >
                      <Icon
                        name={listening ? 'close' : 'mic'}
                        size={20}
                        color={listening ? c.onAccent : c.onInkButton}
                      />
                    </Pressable>
                    <View style={styles.grow}>
                      <Text variant="ui">
                        {dictation.status === 'starting'
                          ? 'Starting…'
                          : listening
                            ? 'Listening — speak naturally'
                            : 'Tap the microphone and talk'}
                      </Text>
                      <Text variant="label" tone="muted" numberOfLines={2}>
                        {dictation.error ??
                          dictation.partial ??
                          'Nothing is recorded — only the words.'}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View style={[styles.speakNote, { borderColor: c.hairline }]}>
                    <Icon name="mic" size={18} color={c.textMuted} />
                    <Text variant="label" tone="muted" style={styles.grow}>
                      Dictation is not in this install yet — the speech module is native
                      and needs a development build. Type below, or use your
                      keyboard&apos;s own microphone key.
                    </Text>
                  </View>
                )
              ) : null}

              {/* --------------------------------------------------- the words */}
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="What's the story? Who's in it, where were you, what do you remember..."
                placeholderTextColor={c.textMuted}
                multiline
                maxLength={2000}
                accessibilityLabel="What do you remember?"
                style={[
                  scale.body,
                  styles.textArea,
                  {
                    color: c.text,
                    backgroundColor: c.surface,
                    borderColor: c.hairline,
                    fontFamily: fonts.regular,
                  },
                ]}
              />

              {/* ---------------------------------------------------- who wrote */}
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor={c.textMuted}
                maxLength={60}
                accessibilityLabel="Your name"
                style={[
                  scale.ui,
                  styles.field,
                  { color: c.text, backgroundColor: c.surface, borderColor: c.hairline },
                ]}
              />
              <TextInput
                value={relationship}
                onChangeText={setRelationship}
                placeholder="Your relationship to them (optional)"
                placeholderTextColor={c.textMuted}
                maxLength={60}
                accessibilityLabel="Your relationship to them"
                style={[
                  scale.ui,
                  styles.field,
                  { color: c.text, backgroundColor: c.surface, borderColor: c.hairline },
                ]}
              />

              {/* -------------------------------------------------- how certain */}
              <View style={styles.certaintyRow} accessibilityRole="radiogroup">
                {Certainty.options.map((option) => {
                  const on = option === certainty;
                  return (
                    <Pressable
                      key={option}
                      onPress={() => {
                        haptics.selected();
                        setCertainty(option);
                      }}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      aria-checked={on}
                      accessibilityLabel={certaintyLabel[option]}
                      style={[
                        styles.certaintyChip,
                        {
                          borderColor: on ? c.accent : c.hairline,
                          backgroundColor: on ? c.surfaceRaised : 'transparent',
                        },
                      ]}
                    >
                      <Text variant="ui" tone={on ? 'default' : 'muted'}>
                        {certaintyLabel[option]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text variant="meta" tone="muted">
                Being unsure is useful. The story says so rather than smoothing it over.
              </Text>

              {/* ------------------------------------------------ when / where */}
              <View style={[styles.rows, { borderColor: c.hairline }]}>
                <MetaRow
                  icon="calendar"
                  label="When"
                  value={when}
                  placeholder="Add a date"
                  open={expanded === 'when'}
                  onToggle={() => setExpanded(expanded === 'when' ? null : 'when')}
                  onChange={setWhen}
                />
                <View style={[styles.divider, { backgroundColor: c.hairline }]} />
                <MetaRow
                  icon="pin"
                  label="Where"
                  value={where}
                  placeholder="Add a place"
                  open={expanded === 'where'}
                  onToggle={() => setExpanded(expanded === 'where' ? null : 'where')}
                  onChange={setWhere}
                />
                <View style={[styles.divider, { backgroundColor: c.hairline }]} />
                {/* Face tagging is not in the schema. Saying so is better than a row
                    that opens a picker with nothing in it. */}
                <View style={styles.metaRow}>
                  <Icon name="tag" size={18} color={c.textMuted} />
                  <Text variant="ui" tone="muted" style={styles.grow}>
                    Who&apos;s in it
                  </Text>
                  <Text variant="ui" tone="muted">
                    Not built yet
                  </Text>
                </View>
              </View>

              {/* ------------------------------------------- someone else telling */}
              <View style={[styles.creditRow, { backgroundColor: c.surfaceRaised }]}>
                <View style={styles.grow}>
                  <Text variant="uiStrong">Someone else is telling this</Text>
                  <Text variant="label" tone="muted">
                    Turn on if you are holding the phone for them
                  </Text>
                </View>
                <Pressable
                  onPress={() => {
                    haptics.selected();
                    setCreditOn((v) => !v);
                  }}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: creditOn }}
                  aria-checked={creditOn}
                  accessibilityLabel="Someone else is telling this"
                  style={[
                    styles.track,
                    { backgroundColor: creditOn ? c.accent : c.hairline },
                  ]}
                >
                  <View style={[styles.knob, creditOn && styles.knobOn]} />
                </Pressable>
              </View>

              {creditOn ? (
                <TextInput
                  value={credited}
                  onChangeText={setCredited}
                  placeholder="Whose memory is this?"
                  placeholderTextColor={c.textMuted}
                  maxLength={60}
                  accessibilityLabel="Whose memory is this?"
                  style={[
                    scale.ui,
                    styles.field,
                    { color: c.text, backgroundColor: c.surface, borderColor: c.hairline },
                  ]}
                />
              ) : null}

              {/* The owner's sheet writes `creditedTo` onto the memory. A remark has no
                  such column, so the person being credited is named where it will
                  actually survive: in the attribution on the words themselves. */}
              {creditOn && credited.trim() ? (
                <Text variant="meta" tone="muted">
                  This will be added as “{credited.trim()}, as told to{' '}
                  {name.trim() || 'you'}”.
                </Text>
              ) : null}
            </ScrollView>

            <View style={styles.footer}>
              <Button
                label="Post"
                variant="accent"
                full
                loading={sending}
                disabled={!valid}
                onPress={post}
                accessibilityHint={
                  valid ? undefined : 'Add your name and what you remember first'
                }
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
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

function MetaRow({
  icon,
  label,
  value,
  placeholder,
  open,
  onToggle,
  onChange,
}: {
  icon: IconName;
  label: string;
  value: string;
  placeholder: string;
  open: boolean;
  onToggle: () => void;
  onChange: (v: string) => void;
}) {
  const { c } = useTheme();
  return (
    <View>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value || placeholder}`}
        accessibilityState={{ expanded: open }}
        style={styles.metaRow}
      >
        <Icon name={icon} size={18} color={c.text} />
        <Text variant="ui" style={styles.grow}>
          {label}
        </Text>
        <Text variant="ui" tone={value ? 'default' : 'muted'}>
          {value || placeholder}
        </Text>
      </Pressable>
      {open ? (
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
            styles.metaInput,
            { color: c.text, backgroundColor: c.surfaceRaised },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  scrimTap: { flex: 1 },
  sheetWrap: { maxHeight: '92%' },
  sheet: {
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    borderWidth: 1,
    paddingTop: space.sm,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: space.sm,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.gutter,
    paddingBottom: space.md,
  },
  closeDot: {
    width: 34,
    height: 34,
    borderRadius: radius.avatar,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { paddingHorizontal: layout.gutter, paddingBottom: space.lg, gap: space.base },
  coverRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  cover: {
    width: 88,
    height: 88,
    borderRadius: radius.image,
    borderWidth: 1,
    overflow: 'hidden',
  },
  grow: { flex: 1 },
  segment: { flexDirection: 'row', borderRadius: radius.pill, padding: 4 },
  segButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    minHeight: 40,
    borderRadius: radius.pill,
  },
  speakNote: {
    flexDirection: 'row',
    gap: space.md,
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radius.button,
    padding: space.md,
  },
  micButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textArea: {
    minHeight: 140,
    borderRadius: radius.button,
    borderWidth: 1,
    padding: space.base,
    textAlignVertical: 'top',
  },
  field: {
    minHeight: layout.minTouchTarget,
    borderRadius: radius.button,
    borderWidth: 1,
    paddingHorizontal: space.base,
  },
  certaintyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  certaintyChip: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: space.base,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  rows: { borderWidth: 1, borderRadius: radius.card, overflow: 'hidden' },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.base,
    minHeight: 52,
  },
  metaInput: {
    marginHorizontal: space.base,
    marginBottom: space.md,
    minHeight: 44,
    borderRadius: radius.button,
    paddingHorizontal: space.md,
  },
  divider: { height: StyleSheet.hairlineWidth },
  creditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderRadius: radius.card,
    padding: space.base,
  },
  track: { width: 46, height: 28, borderRadius: 14, justifyContent: 'center' },
  knob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    marginLeft: 3,
    backgroundColor: '#FFFFFF',
  },
  knobOn: { marginLeft: 21 },
  footer: { paddingHorizontal: layout.gutter, paddingTop: space.md },
});
