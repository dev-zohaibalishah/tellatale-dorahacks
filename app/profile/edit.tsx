/**
 * Edit profile.
 *
 * Three decisions worth stating, because each one is a deliberate departure from the
 * obvious version of this screen:
 *
 *  1. The picture saves immediately; the text saves on Save. Photo pickers already
 *     feel like a commitment — you left the app, chose a file, came back — and asking
 *     someone to confirm that again is how avatars end up silently unsaved. Text is
 *     the opposite: it wants a draft you can abandon.
 *
 *  2. Leaving with unsaved text is intercepted. The rest of the app never does this,
 *     and it is right here and nowhere else: everywhere else a back swipe discards a
 *     field, here it discards a paragraph someone wrote about themselves.
 *
 *  3. The username is shown, prominently, and cannot be edited. Hiding it would be
 *     kinder for about four seconds and then confusing forever. The reason it is
 *     fixed is real and worth telling the truth about.
 */

import { Image } from 'expo-image';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '../../src/components/Button';
import { Header } from '../../src/components/chrome';
import { useConfirm, useToast } from '../../src/components/feedback';
import { Field } from '../../src/components/form';
import { Icon } from '../../src/components/icons';
import { Screen } from '../../src/components/layout';
import { Text } from '../../src/components/Text';
import * as haptics from '../../src/lib/haptics';
import { nameFor, useProfile } from '../../src/state/profile';
import { useTheme } from '../../src/state/theme';
import { layout, radius, space } from '../../src/theme/tokens';

/**
 * 512 square. Large enough for the 96pt editor avatar on a 3x screen, small enough
 * that the upload finishes on a phone network before anyone wonders whether it
 * worked — and comfortably under the bucket's 2 MB ceiling.
 */
const AVATAR_EDGE = 512;

const NAME_MAX = 60;
const BIO_MAX = 280;
const LOCATION_MAX = 60;

export default function EditProfile() {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const { c } = useTheme();
  const { profile, avatarUrl, loading, save, setAvatar, removeAvatar } = useProfile();

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyAvatar, setBusyAvatar] = useState(false);

  /**
   * Seed the fields once, when the profile first arrives — not on every change to it.
   * The provider updates `profile` after a save, and re-seeding on that would be
   * harmless; re-seeding on an unrelated refresh would wipe what someone was typing.
   */
  useEffect(() => {
    if (hydrated || !profile) return;
    setDisplayName(profile.displayName ?? '');
    setBio(profile.bio ?? '');
    setLocation(profile.location ?? '');
    setHydrated(true);
  }, [profile, hydrated]);

  const dirty = useMemo(() => {
    if (!profile || !hydrated) return false;
    return (
      displayName.trim() !== (profile.displayName ?? '') ||
      bio.trim() !== (profile.bio ?? '') ||
      location.trim() !== (profile.location ?? '')
    );
  }, [profile, hydrated, displayName, bio, location]);

  /* ------------------------------------------------------------- picture */

  async function pickAvatar(source: 'library' | 'camera') {
    if (busyAvatar) return;

    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      toast(
        source === 'camera'
          ? 'Camera access is off for TellaTale.'
          : 'Photo access is off for TellaTale.',
        'bad'
      );
      return;
    }

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            // The crop box is square because the avatar is a circle everywhere it is
            // drawn. Letting someone pick a wide photo and then centre-cropping it
            // behind their back is how people end up as an ear.
            allowsEditing: true,
            aspect: [1, 1],
            quality: 1,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 1,
          });

    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];

    setBusyAvatar(true);
    try {
      // Downscale before it touches the network, same rule as a memory photo.
      let uri = asset.uri;
      const longEdge = Math.max(asset.width ?? 0, asset.height ?? 0);
      if (longEdge > AVATAR_EDGE) {
        const scaleBy = AVATAR_EDGE / longEdge;
        const rendered = await ImageManipulator.manipulate(asset.uri)
          .resize({
            width: Math.round((asset.width ?? AVATAR_EDGE) * scaleBy),
            height: Math.round((asset.height ?? AVATAR_EDGE) * scaleBy),
          })
          .renderAsync();
        const out = await rendered.saveAsync({ compress: 0.85, format: SaveFormat.JPEG });
        uri = out.uri;
      }

      await setAvatar(uri);
      haptics.succeeded();
      toast('Picture updated.', 'good');
    } catch (e) {
      haptics.failed();
      toast(e instanceof Error ? e.message : 'That picture could not be saved.', 'bad');
    } finally {
      setBusyAvatar(false);
    }
  }

  async function clearAvatar() {
    const ok = await confirm({
      title: 'Remove your picture?',
      body: 'The file is deleted, not just hidden. You can add a new one any time.',
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (!ok) return;

    setBusyAvatar(true);
    try {
      await removeAvatar();
      toast('Picture removed.', 'good');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'That could not be removed.', 'bad');
    } finally {
      setBusyAvatar(false);
    }
  }

  /* ---------------------------------------------------------------- text */

  async function onSave() {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      // Empty means cleared, not skipped — null, so the column ends up genuinely
      // empty rather than holding a zero-length string that later reads as set.
      await save({
        displayName: displayName.trim() || null,
        bio: bio.trim() || null,
        location: location.trim() || null,
      });
      haptics.succeeded();
      toast('Profile saved.', 'good');
      router.back();
    } catch (e) {
      haptics.failed();
      toast(e instanceof Error ? e.message : 'That could not be saved.', 'bad');
    } finally {
      setSaving(false);
    }
  }

  async function leave() {
    if (dirty) {
      const ok = await confirm({
        title: 'Discard changes?',
        body: 'What you have typed here has not been saved yet.',
        confirmLabel: 'Discard',
        destructive: true,
      });
      if (!ok) return;
    }
    router.back();
  }

  /* -------------------------------------------------------------- render */

  const initial = nameFor(profile).trim().charAt(0).toUpperCase();

  return (
    <Screen
      avoidKeyboard
      footer={
        <Button
          label={saving ? 'Saving…' : 'Save changes'}
          onPress={onSave}
          variant="accent"
          full
          loading={saving}
          disabled={!dirty || saving}
          accessibilityHint={
            dirty ? 'Saves your profile' : 'Nothing has changed yet'
          }
        />
      }
    >
      <Header eyebrow="Your profile" title="Edit" onBack={leave} backIcon="close" />

      {/* ------------------------------------------------------- picture */}
      <View style={styles.avatarBlock}>
        <Pressable
          onPress={() => void pickAvatar('library')}
          disabled={busyAvatar}
          accessibilityRole="button"
          accessibilityLabel={avatarUrl ? 'Change your profile picture' : 'Add a profile picture'}
          style={({ pressed }) => [
            styles.avatar,
            { backgroundColor: c.surfaceRaised, borderColor: c.hairline },
            pressed && !busyAvatar && { opacity: 0.85 },
          ]}
        >
          {/* Clipping happens on this inner view, not the pressable. The pressable
              has to stay `overflow: visible` so the camera badge can sit on the rim;
              putting both jobs on one element gives you either a square photo or a
              clipped badge. */}
          <View style={styles.avatarClip}>
            {avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                // The path changes on every upload, so the URL is already unique —
                // being explicit costs nothing and documents why it never goes stale.
                cachePolicy="memory-disk"
              />
            ) : (
              <Text variant="display" tone="muted">
                {initial}
              </Text>
            )}
          </View>

          {/* The camera badge is the affordance. Without it a circular photo reads as
              decoration and nobody discovers it is tappable. */}
          <View style={[styles.badge, { backgroundColor: c.accent, borderColor: c.surface }]}>
            <Icon name="camera" size={15} color={c.onAccent} />
          </View>
        </Pressable>

        <View style={styles.avatarActions}>
          <Button
            label={avatarUrl ? 'Change' : 'Add a picture'}
            onPress={() => void pickAvatar('library')}
            variant="outline"
            size="compact"
            disabled={busyAvatar}
          />
          <Button
            label="Take one"
            onPress={() => void pickAvatar('camera')}
            variant="ghost"
            size="compact"
            disabled={busyAvatar}
          />
          {avatarUrl ? (
            <Button
              label="Remove"
              onPress={() => void clearAvatar()}
              variant="ghost"
              size="compact"
              disabled={busyAvatar}
            />
          ) : null}
        </View>

        <Text variant="meta" tone="muted" center>
          {busyAvatar
            ? 'Saving your picture…'
            : 'Only you can see this unless you publish a story.'}
        </Text>
      </View>

      {/* -------------------------------------------------------- fields */}
      <View style={styles.fields}>
        <Field
          label="Display name"
          value={displayName}
          onChangeText={setDisplayName}
          placeholder={profile?.username ?? 'Your name'}
          maxLength={NAME_MAX}
          hint="What contributors see when you invite them. Leave it empty to use your username."
        />

        <Field
          label="About you"
          value={bio}
          onChangeText={setBio}
          placeholder="A line about the memories you keep"
          multiline
          maxLength={BIO_MAX}
          narrative
        />

        <Field
          label="Where you are"
          value={location}
          onChangeText={setLocation}
          placeholder="Lahore, Pakistan"
          maxLength={LOCATION_MAX}
          hint="Optional, and never attached to a memory."
        />
      </View>

      {/* ------------------------------------------------------ username */}
      <View style={[styles.locked, { backgroundColor: c.surfaceRaised }]}>
        <View style={[styles.lockIcon, { backgroundColor: c.surface }]}>
          <Icon name="lock" size={16} color={c.textMuted} />
        </View>
        <View style={styles.grow}>
          <Text variant="ui">@{profile?.username ?? '—'}</Text>
          <Text variant="meta" tone="muted">
            Your username is how you sign in, so it cannot be changed. Your display
            name above is the one people see.
          </Text>
        </View>
      </View>

      {loading && !profile ? (
        <Text variant="meta" tone="muted" center>
          Loading your profile…
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  avatarBlock: { alignItems: 'center', gap: space.md },
  avatar: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  avatarClip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 56,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: space.sm,
  },
  fields: { gap: space.lg },
  grow: { flex: 1 },
  locked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.base,
    borderRadius: radius.card,
    minHeight: layout.minTouchTarget,
  },
  lockIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.avatar,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
