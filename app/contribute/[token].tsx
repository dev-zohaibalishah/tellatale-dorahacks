/**
 * The guest screen — reached from an invite link, with no account.
 *
 * This is the highest-leverage screen in the product. Every extra field, every sign-in
 * wall, every explanation costs contributions, and contributions are the only thing
 * that makes a memory more than a caption. So: the photo, the question, a name, and a
 * box to write in. Certainty and the date/place hints are optional and presented as
 * optional.
 *
 * The guest is deliberately shown less than the owner: no other contributors, no
 * remark list, no owner identity, and no story unless the owner has both approved and
 * published it. That withholding is enforced server-side too — this screen is not the
 * boundary, it is the presentation of it.
 */

import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '../../src/components/Button';
import { ActionBar, Header, Loading } from '../../src/components/chrome';
import { useToast } from '../../src/components/feedback';
import { ChoiceRow, Field } from '../../src/components/form';
import { Icon } from '../../src/components/icons';
import { Card, Divider, Row, Screen } from '../../src/components/layout';
import { PhotoPlate } from '../../src/components/PhotoPlate';
import { StoryCard } from '../../src/components/StoryCard';
import { Text } from '../../src/components/Text';
import { repository } from '../../src/data';
import { useGuestMemory } from '../../src/hooks/repo';
import { track } from '../../src/lib/analytics';
import { GUEST_QUESTION } from '../../src/lib/links';
import { useTheme } from '../../src/state/theme';
import { radius, space } from '../../src/theme/tokens';
import {
  Certainty,
  certaintyLabel,
  Reaction,
  reactionLabel,
} from '../../shared/story';

const CERTAINTY_CHOICES = Certainty.options.map((value) => ({
  value,
  label: certaintyLabel[value],
}));

export default function Contribute() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const toast = useToast();
  const { data: view, loading, error, reload } = useGuestMemory(token);

  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [text, setText] = useState('');
  const [certainty, setCertainty] = useState<Certainty>('certain');
  const [dateHint, setDateHint] = useState('');
  const [locationHint, setLocationHint] = useState('');
  const [more, setMore] = useState(false);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [reacted, setReacted] = useState<Reaction | null>(null);

  // The denominator for invite-to-contribution conversion. Fired once per opened
  // link, before anything is typed.
  useEffect(() => {
    if (!view) return;
    track({ name: 'invite_opened' });
    track({ name: 'participant', role: 'guest' });
  }, [view]);

  if (loading) {
    return (
      <Screen>
        <Loading line="Opening the memory…" />
      </Screen>
    );
  }

  if (error || !view) {
    return (
      <Screen>
        <Header eyebrow="Invite" title="This link does not work" />
        <Text variant="body" tone="muted">
          {error ?? 'It may have expired, or the memory may have been deleted.'}
        </Text>
        <Button label="Try again" variant="outline" onPress={reload} />
      </Screen>
    );
  }

  const valid = name.trim().length > 0 && text.trim().length > 0;

  async function submit() {
    if (!token || !valid) return;
    setSending(true);
    try {
      await repository().submitGuestRemark(token, {
        contributorName: name.trim(),
        relationship: relationship.trim() || null,
        text: text.trim(),
        certainty,
        dateHint: dateHint.trim() || null,
        locationHint: locationHint.trim() || null,
      });
      track({ name: 'remark_added', certainty });
      // Clear what was just sent, keep who sent it.
      //
      // Without this, "Add another memory" handed the contributor back a form
      // already full of the words they had just submitted — one more tap away from
      // posting the same remark twice, under the same name, to the same photo.
      // Their name and relationship stay, because those do not change between two
      // memories of the same afternoon.
      setText('');
      setDateHint('');
      setLocationHint('');
      setCertainty('certain');
      setMore(false);
      setDone(true);
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'That could not be sent.', 'bad');
    } finally {
      setSending(false);
    }
  }

  async function react(reaction: Reaction) {
    if (!token) return;
    try {
      await repository().addReaction(token, reaction);
      setReacted(reaction);
      track({ name: 'reaction', reaction });
      if (reaction === 'wantToAdd') {
        // The one reaction that is really a request. Give them the form back rather
        // than thanking them and stopping.
        setDone(false);
        setText('');
        toast('Go ahead — add another.', 'good');
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'That could not be saved.', 'bad');
    }
  }

  /* --------------------------------------------------------------- thank you */

  if (done) {
    return (
      <Screen>
        <Header eyebrow="Added" title="Thank you." />
        <Text variant="body" tone="muted">
          Your memory is with {view.title}. The person who started it decides what goes
          into the final story, and your words stay attributed to you.
        </Text>

        <PhotoPlate uri={view.imageUrl} aspect={16 / 9} />

        {view.publishedStory ? (
          <>
            <Divider />
            <Text variant="eyebrow" tone="muted">
              The story so far
            </Text>
            <StoryCard
              story={view.publishedStory}
              memoryType={view.memoryType}
              imageUrl={view.imageUrl}
              contributorCount={view.contributorCount}
            />
            <ReactionRow chosen={reacted} onReact={react} />
          </>
        ) : (
          <Card>
            <View style={styles.pending}>
              <Text variant="eyebrow" tone="muted">
                Not published yet
              </Text>
              <Text variant="meta" tone="muted">
                When the owner approves and shares the story, this link will show it.
              </Text>
            </View>
          </Card>
        )}

        <Button label="Add another memory" variant="outline" onPress={() => setDone(false)} />
      </Screen>
    );
  }

  /* -------------------------------------------------------------- the ask */

  return (
    <Screen
      avoidKeyboard
      footer={
        <ActionBar>
          <Button
            label="Add my memory"
            variant="accent"
            onPress={submit}
            loading={sending}
            disabled={!valid}
            full
          />
          <Text variant="meta" tone="muted" center>
            No account. No sign-up. Your name is shown with your words.
          </Text>
        </ActionBar>
      }
    >
      <Header eyebrow={view.title} />

      <PhotoPlate uri={view.imageUrl} aspect={4 / 3} />

      {view.publishedStory ? <StorySoFar /> : null}

      {/* The question is the headline. `view.prompt` carries the same invitation in
          the sender's words and has already done its job in the message that brought
          this person here — repeating it verbatim under the headline reads as a
          stutter, so the sub-line spends its space on what actually happens next. */}
      <Text variant="title">{GUEST_QUESTION}</Text>
      <Text variant="body" tone="muted">
        Anything at all — a detail, a name for something, what it sounded like. It is
        kept in your words, with your name on it.
      </Text>

      <Field
        label="Your memory"
        value={text}
        onChangeText={setText}
        placeholder="I remember…"
        multiline
        narrative
        maxLength={2000}
      />

      <Field
        label="Your name"
        value={name}
        onChangeText={setName}
        placeholder="Aisha"
        maxLength={60}
        hint="Shown next to what you wrote, so no one has to guess who said it."
      />

      <ChoiceRow
        label="How sure are you?"
        choices={CERTAINTY_CHOICES}
        value={certainty}
        onChange={setCertainty}
        hint="Being unsure is useful. The story will say so rather than smoothing it over."
      />

      <Disclosure open={more} onToggle={() => setMore(!more)} label="Add more, if you know it">
        <Field
          label="Your relationship to them"
          value={relationship}
          onChangeText={setRelationship}
          placeholder="Aunt"
          maxLength={60}
        />
        <Field
          label="When was this?"
          value={dateHint}
          onChangeText={setDateHint}
          placeholder="Around 1994"
          maxLength={80}
        />
        <Field
          label="Where was this?"
          value={locationHint}
          onChangeText={setLocationHint}
          placeholder="Lahore"
          maxLength={120}
        />
      </Disclosure>

      <Text variant="meta" tone="muted">
        Only what you write here is added. TellaTale does not try to identify anyone in
        the photograph.
      </Text>
    </Screen>
  );
}

/** Shown when a story already exists, so a late contributor knows it is not too late. */
function StorySoFar() {
  const { c } = useTheme();
  return (
    <View style={[styles.soFar, { borderColor: c.hairline }]}>
      <Icon name="check" size={16} color={c.accent} />
      <Text variant="meta" tone="muted" style={styles.soFarText}>
        A story has already been published for this photo. Adding your memory can change
        it — the owner can recompose it with your words included.
      </Text>
    </View>
  );
}

function Disclosure({
  open,
  onToggle,
  label,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  label: string;
  children: React.ReactNode;
}) {
  const { c } = useTheme();
  return (
    <View style={styles.disclosure}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [styles.disclosureHead, pressed && { opacity: 0.7 }]}
      >
        <Text variant="ui" tone="muted">
          {label}
        </Text>
        <View style={open ? styles.rotated : undefined}>
          <Icon name="chevron" size={16} color={c.textMuted} />
        </View>
      </Pressable>
      {open ? <View style={styles.disclosureBody}>{children}</View> : null}
    </View>
  );
}

/** MVP spec §7: exactly three reactions, one choice, no comment thread. */
function ReactionRow({
  chosen,
  onReact,
}: {
  chosen: Reaction | null;
  onReact: (r: Reaction) => void;
}) {
  const { c } = useTheme();
  return (
    <View style={styles.reactions}>
      <Text variant="eyebrow" tone="muted">
        How did that land?
      </Text>
      <Row style={styles.reactionRow}>
        {Reaction.options.map((r) => {
          const active = chosen === r;
          return (
            <Pressable
              key={r}
              onPress={() => onReact(r)}
              accessibilityRole="button"
              accessibilityLabel={reactionLabel[r]}
              accessibilityState={{ selected: active }}
              style={({ pressed }) => [
                styles.reaction,
                {
                  borderColor: active ? c.accent : c.hairline,
                  backgroundColor: active ? c.surfaceRaised : 'transparent',
                },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text variant="ui" tone={active ? 'default' : 'muted'}>
                {reactionLabel[r]}
              </Text>
            </Pressable>
          );
        })}
      </Row>
    </View>
  );
}

const styles = StyleSheet.create({
  pending: { gap: space.xs },
  soFar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radius.button,
    padding: space.md,
  },
  soFarText: { flex: 1 },
  disclosure: { gap: space.md },
  disclosureHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
  },
  rotated: { transform: [{ rotate: '90deg' }] },
  disclosureBody: { gap: space.base },
  reactions: { gap: space.md },
  reactionRow: { flexWrap: 'wrap', gap: space.sm },
  reaction: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: space.base,
    borderRadius: radius.avatar,
    borderWidth: 1,
  },
});
