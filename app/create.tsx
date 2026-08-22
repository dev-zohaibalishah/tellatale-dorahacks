/**
 * Creating a memory, in three steps.
 *
 * It is one form, but presented as photo → context → your words, for two reasons.
 * A single screen holding an image picker, six fields, a consent checkbox and a
 * submit button reads as paperwork, and this is the moment a person is being asked
 * for something they care about. And the split lets the last step be nothing but the
 * owner's own account, with the promise attached to it — that those words are kept
 * verbatim and belong to them — right where the promise is being made.
 *
 * The permission attestation (MVP spec, privacy rules) gates submission. It is not a
 * pre-ticked box and it is not buried in a terms link.
 */

import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '../src/components/Button';
import { ActionBar, Header, StepDots } from '../src/components/chrome';
import { useConfirm, useToast } from '../src/components/feedback';
import { CheckRow, ChoiceRow, Field } from '../src/components/form';
import { Icon } from '../src/components/icons';
import { Card, Row, Screen } from '../src/components/layout';
import { PhotoPlate } from '../src/components/PhotoPlate';
import { Text } from '../src/components/Text';
import { repository } from '../src/data';
import { track } from '../src/lib/analytics';
import { useSession } from '../src/state/auth';
import { useTheme } from '../src/state/theme';
import { layout, radius, space } from '../src/theme/tokens';
import { MemoryType, memoryTypeLabel } from '../shared/story';

interface Picked {
  uri: string;
  width: number | null;
  height: number | null;
}

const TYPES = MemoryType.options.map((value) => ({
  value,
  label: memoryTypeLabel[value],
}));

export default function Create() {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const { uid } = useSession();

  const [step, setStep] = useState(0);
  const [photo, setPhoto] = useState<Picked | null>(null);
  const [title, setTitle] = useState('');
  const [memoryType, setMemoryType] = useState<MemoryType>('family');
  const [dateHint, setDateHint] = useState('');
  const [locationHint, setLocationHint] = useState('');
  const [remark, setRemark] = useState('');
  const [permission, setPermission] = useState(false);
  const [saving, setSaving] = useState(false);

  const stepValid = [
    Boolean(photo),
    title.trim().length > 0,
    remark.trim().length > 0 && permission,
  ];

  async function leave() {
    const started = photo || title.trim() || remark.trim();
    if (!started || (await confirm({
      title: 'Discard this memory?',
      body: 'Nothing has been saved yet.',
      confirmLabel: 'Discard',
      destructive: true,
    }))) {
      router.back();
    }
  }

  async function pick(source: 'library' | 'camera') {
    try {
      const permissionResult =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        toast(
          source === 'camera'
            ? 'TellaTale needs camera access to take this photo.'
            : 'TellaTale needs photo access to choose an image.',
          'bad'
        );
        return;
      }

      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        // No cropping. Framing someone's photograph is an edit we have no standing
        // to make; the card letterboxes instead.
        allowsEditing: false,
        quality: 0.85,
        exif: false,
      };

      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);

      if (result.canceled) return;
      const asset = result.assets[0];
      setPhoto({
        uri: asset.uri,
        width: asset.width ?? null,
        height: asset.height ?? null,
      });
    } catch {
      toast('That photo could not be opened. Try another one.', 'bad');
    }
  }

  async function save() {
    if (!uid || !photo) return;
    setSaving(true);
    try {
      const memory = await repository().createMemory(uid, {
        title: title.trim(),
        memoryType,
        localImageUri: photo.uri,
        imageWidth: photo.width,
        imageHeight: photo.height,
        originalRemark: remark.trim(),
        dateHint: dateHint.trim() || null,
        locationHint: locationHint.trim() || null,
        permissionConfirmed: true,
      });
      track({ name: 'memory_created', memoryType });
      // Replace, not push: backing out of a freshly created memory should land on the
      // library, not on the empty form that made it.
      router.replace({ pathname: '/memory/[id]', params: { id: memory.id } });
    } catch (e) {
      toast(e instanceof Error ? e.message : 'That memory could not be saved.', 'bad');
      setSaving(false);
    }
  }

  return (
    <Screen
      avoidKeyboard
      footer={
        <ActionBar>
          <Row gap={space.sm}>
            {step > 0 ? (
              <Button
                label="Back"
                variant="outline"
                onPress={() => setStep((s) => s - 1)}
                style={styles.half}
              />
            ) : null}
            {step < 2 ? (
              <Button
                label="Continue"
                onPress={() => setStep((s) => s + 1)}
                disabled={!stepValid[step]}
                style={styles.grow}
              />
            ) : (
              <Button
                label="Save this memory"
                variant="accent"
                onPress={save}
                loading={saving}
                disabled={!stepValid[2]}
                accessibilityHint="Creates the memory page and lets you invite others"
                style={styles.grow}
              />
            )}
          </Row>
        </ActionBar>
      }
    >
      <Header
        onBack={leave}
        backIcon="close"
        backLabel="Discard and go back"
        right={<StepDots total={3} index={step} />}
      />

      {step === 0 ? (
        <StepPhoto photo={photo} onPick={pick} />
      ) : step === 1 ? (
        <StepContext
          photo={photo}
          title={title}
          setTitle={setTitle}
          memoryType={memoryType}
          setMemoryType={setMemoryType}
          dateHint={dateHint}
          setDateHint={setDateHint}
          locationHint={locationHint}
          setLocationHint={setLocationHint}
        />
      ) : (
        <StepWords
          remark={remark}
          setRemark={setRemark}
          permission={permission}
          setPermission={setPermission}
        />
      )}
    </Screen>
  );
}

/* -------------------------------------------------------------- step one */

function StepPhoto({
  photo,
  onPick,
}: {
  photo: Picked | null;
  onPick: (s: 'library' | 'camera') => void;
}) {
  return (
    <View style={styles.step}>
      <Text variant="title">Start with the photograph.</Text>
      <Text variant="body" tone="muted">
        One image. It is the thing everyone will be remembering around.
      </Text>

      <PhotoPlate uri={photo?.uri ?? null} aspect={4 / 3} />

      <Row gap={space.sm}>
        <PickTile
          icon="image"
          label={photo ? 'Choose another' : 'Choose a photo'}
          onPress={() => onPick('library')}
        />
        <PickTile icon="camera" label="Take one" onPress={() => onPick('camera')} />
      </Row>

      <Text variant="meta" tone="muted">
        Photographs of prints work too — a picture of a picture is still the anchor.
      </Text>
    </View>
  );
}

function PickTile({
  icon,
  label,
  onPress,
}: {
  icon: 'image' | 'camera';
  label: string;
  onPress: () => void;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.tile,
        { borderColor: c.hairline, backgroundColor: c.surface },
        pressed && { opacity: 0.8 },
      ]}
    >
      <Icon name={icon} size={22} color={c.text} />
      <Text variant="ui">{label}</Text>
    </Pressable>
  );
}

/* -------------------------------------------------------------- step two */

function StepContext({
  photo,
  title,
  setTitle,
  memoryType,
  setMemoryType,
  dateHint,
  setDateHint,
  locationHint,
  setLocationHint,
}: {
  photo: Picked | null;
  title: string;
  setTitle: (v: string) => void;
  memoryType: MemoryType;
  setMemoryType: (v: MemoryType) => void;
  dateHint: string;
  setDateHint: (v: string) => void;
  locationHint: string;
  setLocationHint: (v: string) => void;
}) {
  return (
    <View style={styles.step}>
      <PhotoPlate uri={photo?.uri ?? null} aspect={16 / 9} />

      <Text variant="title">What is this a memory of?</Text>

      <Field
        label="Title"
        value={title}
        onChangeText={setTitle}
        placeholder="Grandmother's house, the last summer"
        maxLength={120}
        autoFocus
      />

      <ChoiceRow
        label="Memory type"
        choices={TYPES}
        value={memoryType}
        onChange={setMemoryType}
        hint="This sets how the story refers to the group — family, friends, the team."
      />

      <Field
        label="When, if you know"
        value={dateHint}
        onChangeText={setDateHint}
        placeholder="Summer 1994"
        maxLength={80}
        hint="Leave it blank rather than guessing. Blank is a fact; a guess is not."
      />

      <Field
        label="Where, if you know"
        value={locationHint}
        onChangeText={setLocationHint}
        placeholder="Lahore"
        maxLength={120}
      />
    </View>
  );
}

/* ------------------------------------------------------------ step three */

function StepWords({
  remark,
  setRemark,
  permission,
  setPermission,
}: {
  remark: string;
  setRemark: (v: string) => void;
  permission: boolean;
  setPermission: (v: boolean) => void;
}) {
  const { c } = useTheme();
  return (
    <View style={styles.step}>
      <Text variant="title">What do you remember?</Text>
      <Text variant="body" tone="muted">
        Write it the way you would say it out loud. Nothing here gets rewritten.
      </Text>

      <Field
        label="Your memory"
        value={remark}
        onChangeText={setRemark}
        placeholder="I remember the smell of the courtyard after it rained…"
        multiline
        narrative
        maxLength={2000}
        autoFocus
      />

      <Card>
        <Row style={styles.promise}>
          <Icon name="lock" size={18} color={c.accent} />
          <View style={styles.promiseText}>
            <Text variant="eyebrow" tone="muted">
              Owner&apos;s original memory
            </Text>
            <Text variant="meta" tone="muted">
              These words are shown word for word, above everything else, and marked as
              yours. The AI is not allowed to rewrite them, and no one else can edit
              them.
            </Text>
          </View>
        </Row>
      </Card>

      <View style={[styles.consent, { borderColor: c.hairline }]}>
        <CheckRow
          label="I have permission to share this photo."
          checked={permission}
          onToggle={() => setPermission(!permission)}
        />
        <Text variant="meta" tone="muted">
          TellaTale will not try to identify anyone in the image, and will not describe
          people beyond what is plainly visible.
        </Text>
      </View>

      <Text variant="meta" tone="muted">
        Private by default. Only people you send the link to can see this.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  step: { gap: space.base, paddingBottom: space.base },
  half: { flex: 1 },
  grow: { flex: 2 },
  tile: {
    flex: 1,
    minHeight: 88,
    borderRadius: radius.card,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    padding: space.md,
  },
  promise: { alignItems: 'flex-start', gap: space.md },
  promiseText: { flex: 1, gap: space.xs },
  consent: {
    borderWidth: 1,
    borderRadius: radius.button,
    padding: space.md,
    gap: space.sm,
    minHeight: layout.minTouchTarget,
  },
});
