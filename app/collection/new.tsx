/**
 * New collection.
 *
 * A name and a type, and nothing else. The type is not decoration — it selects the
 * icon and the vocabulary the rest of the app uses for the group, which is how the
 * product stays honest about not being family-only.
 */

import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AuthError, AuthField } from '../../src/components/auth-ui';
import { Button } from '../../src/components/Button';
import { ActionBar, Header } from '../../src/components/chrome';
import { collectionIcon } from '../../src/components/labels';
import { useToast } from '../../src/components/feedback';
import { ChoiceRow } from '../../src/components/form';
import { Icon } from '../../src/components/icons';
import { Card, Row, Screen } from '../../src/components/layout';
import { Text } from '../../src/components/Text';
import { repository } from '../../src/data';
import { useSession } from '../../src/state/auth';
import { useTheme } from '../../src/state/theme';
import { radius, space } from '../../src/theme/tokens';
import { MemoryType, memoryTypeLabel } from '../../shared/story';

const KIND_CHOICES = MemoryType.options.map((value) => ({
  value,
  label: memoryTypeLabel[value],
}));

export default function NewCollection() {
  const router = useRouter();
  const toast = useToast();
  const { uid } = useSession();
  const { c } = useTheme();

  const [name, setName] = useState('');
  const [kind, setKind] = useState<MemoryType>('family');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canSave = name.trim().length > 0 && !busy;

  async function save() {
    if (!uid || !canSave) return;
    setBusy(true);
    setError(null);
    try {
      await repository().createCollection(uid, name, kind);
      toast('Collection created.', 'good');
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That could not be created.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      avoidKeyboard
      footer={
        <ActionBar>
          <Button
            label="Create collection"
            variant="accent"
            full
            loading={busy}
            disabled={!canSave}
            onPress={save}
          />
        </ActionBar>
      }
    >
      <Header
        onBack={() => router.back()}
        eyebrow="Collections"
        title="Group what belongs together"
      />

      {/* Live preview: what the card will look like on the dashboard. */}
      <Card>
        <Row gap={space.md}>
          <View style={[styles.icon, { borderColor: c.hairline }]}>
            <Icon name={collectionIcon(kind)} size={18} color={c.accent} />
          </View>
          <View style={styles.grow}>
            <Text variant="heading">{name.trim() || 'Untitled collection'}</Text>
            <Text variant="meta" tone="muted">
              {memoryTypeLabel[kind]} · Empty
            </Text>
          </View>
        </Row>
      </Card>

      <View style={styles.form}>
        <AuthField
          label="Name"
          value={name}
          onChangeText={(v) => {
            setName(v);
            if (error) setError(null);
          }}
          placeholder="Murree 1987"
          autoCapitalize="words"
          autoFocus
          maxLength={60}
          hint="A trip, a house, a person — whatever these memories share."
        />

        <ChoiceRow
          label="Type"
          choices={KIND_CHOICES}
          value={kind}
          onChange={setKind}
          hint="Sets the icon and the words the app uses for this group."
        />

        {error ? <AuthError message={error} /> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.lg, paddingTop: space.lg },
  grow: { flex: 1, gap: 2 },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.button,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
