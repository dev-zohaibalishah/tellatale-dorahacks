/**
 * Asking the family something.
 *
 * One field, and it is a question in somebody's own words. The design shows these in
 * quotation marks on every screen they appear on, which is the whole design decision:
 * a question is not a form label, it is a person speaking, and it reads differently
 * when it keeps its question mark and its "anyone".
 *
 * The examples are not placeholders in the CSS sense — they are there because "ask
 * your family something" is a blank page, and the fastest way past a blank page is
 * seeing the shape of a good answer.
 */

import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Button } from '../../src/components/Button';
import { ActionBar, Header } from '../../src/components/chrome';
import { useToast } from '../../src/components/feedback';
import { Screen } from '../../src/components/layout';
import { Text } from '../../src/components/Text';
import { repository } from '../../src/data';
import { useCircle } from '../../src/hooks/circle';
import * as haptics from '../../src/lib/haptics';
import { useSession } from '../../src/state/auth';
import { useTheme } from '../../src/state/theme';
import { fonts, type as scale } from '../../src/theme/typography';
import { radius, space } from '../../src/theme/tokens';

const EXAMPLES = [
  'Does anyone have a photo from Nani’s house in Murree?',
  'Who remembers the name of our old car?',
  'What’s your first memory of Nani?',
];

export default function AskRequest() {
  const router = useRouter();
  const toast = useToast();
  const { uid } = useSession();
  const { c } = useTheme();
  const { data: circle } = useCircle(uid);

  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);

  const valid = question.trim().length >= 3 && Boolean(circle) && !busy;

  async function ask() {
    if (!circle || !valid) return;
    setBusy(true);
    try {
      const created = await repository().createRequest(circle.id, question);
      haptics.succeeded();
      toast('Asked. The family will see it.', 'good');
      router.replace({ pathname: '/requests/[id]', params: { id: created.id } });
    } catch (e) {
      haptics.failed();
      toast(e instanceof Error ? e.message : 'That could not be asked.', 'bad');
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
            label="Ask the family"
            variant="accent"
            full
            loading={busy}
            disabled={!valid}
            onPress={ask}
            accessibilityHint={valid ? undefined : 'Write a question first'}
          />
        </ActionBar>
      }
    >
      <Header
        onBack={() => router.back()}
        backIcon="close"
        backLabel="Close"
        eyebrow="Your circle"
        title="Ask the family something"
      />

      <Text variant="body" tone="muted">
        Everyone in {circle?.name ?? 'your circle'} sees it, and anyone can answer with
        a photo and what they remember.
      </Text>

      <TextInput
        value={question}
        onChangeText={setQuestion}
        placeholder="Does anyone have a photo from…"
        placeholderTextColor={c.textMuted}
        multiline
        maxLength={200}
        autoFocus
        accessibilityLabel="Your question"
        style={[
          scale.bodyLarge,
          styles.input,
          {
            color: c.text,
            backgroundColor: c.surface,
            borderColor: c.hairline,
            fontFamily: fonts.regular,
          },
        ]}
      />
      <Text variant="meta" tone="muted">
        {question.length}/200
      </Text>

      <Text variant="eyebrow" tone="muted">
        Or borrow one of these
      </Text>
      <View style={styles.examples}>
        {EXAMPLES.map((example) => (
          <Pressable
            key={example}
            onPress={() => {
              haptics.selected();
              setQuestion(example);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Use: ${example}`}
            style={({ pressed }) => [
              styles.example,
              { borderColor: c.hairline, backgroundColor: c.surfaceRaised },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text variant="ui" tone="muted">
              “{example}”
            </Text>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: 120,
    borderRadius: radius.button,
    borderWidth: 1,
    padding: space.base,
    textAlignVertical: 'top',
  },
  examples: { gap: space.sm },
  example: { borderWidth: 1, borderRadius: radius.button, padding: space.md },
});
