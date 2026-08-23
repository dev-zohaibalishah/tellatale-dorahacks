/**
 * One question, and everything the family sent back.
 *
 * The question sits at the top and stays there, because every answer below it is only
 * legible in its light — "Nani's kitchen, 1979" means one thing on its own and
 * another when somebody asked for a photo of Nani's house.
 *
 * Answering posts a memory of your own and links it here. It does not add a remark to
 * somebody else's photograph: the two are different acts, and conflating them is how
 * an archive ends up with one person's photo carrying five people's unrelated
 * stories. Your answer stays yours, owned by you, in your library.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '../../src/components/Button';
import { Header, Skeleton } from '../../src/components/chrome';
import { Avatar } from '../../src/components/home-ui';
import { Icon } from '../../src/components/icons';
import { relativeTime } from '../../src/components/labels';
import { EmptyState, Screen } from '../../src/components/layout';
import { PhotoPlate } from '../../src/components/PhotoPlate';
import { Text } from '../../src/components/Text';
import { useAnswers, useCircle, useRequests } from '../../src/hooks/circle';
import { useImageUrl } from '../../src/hooks/repo';
import * as haptics from '../../src/lib/haptics';
import { useSession } from '../../src/state/auth';
import { useTheme } from '../../src/state/theme';
import { radius, space } from '../../src/theme/tokens';
import type { RequestAnswer } from '../../src/data/repository';

export default function RequestDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { uid } = useSession();
  const { c } = useTheme();

  const { data: circle } = useCircle(uid);
  const { data: requests } = useRequests(circle?.id);
  const { data: answers, loading, error } = useAnswers(id);

  const request = requests.find((r) => r.id === id) ?? null;

  return (
    <Screen
      footer={
        <Button
          label="Answer with a memory"
          variant="accent"
          full
          onPress={() => {
            haptics.contributed();
            // The add sheet carries the request through, so posting links the two.
            router.push({ pathname: '/add', params: { requestId: id } });
          }}
          accessibilityHint="Adds one of your photos as an answer to this question"
        />
      }
    >
      <Header onBack={() => router.back()} eyebrow="A question is waiting" />

      <View style={[styles.questionCard, { backgroundColor: c.surfaceRaised }]}>
        <Text variant="title">“{request?.question ?? 'This question'}”</Text>
        {request ? (
          <Text variant="label" tone="muted">
            {request.askedByMe ? 'You asked' : `${request.askedByName} asked`} ·{' '}
            {relativeTime(request.createdAt)}
          </Text>
        ) : null}
      </View>

      <Text variant="uiStrong">
        {answers.length} {answers.length === 1 ? 'answer' : 'answers'}
      </Text>

      {loading ? (
        <View style={styles.list}>
          <Skeleton height={132} />
          <Skeleton height={132} />
        </View>
      ) : error ? (
        <Text variant="body" tone="muted">
          {error}
        </Text>
      ) : answers.length === 0 ? (
        <EmptyState line="Nobody has answered yet. Yours would be the first — and the first answer is usually what makes everyone else remember they have one too." />
      ) : (
        <View style={styles.list}>
          {answers.map((answer) => (
            <AnswerCard
              key={answer.id}
              answer={answer}
              onOpen={() =>
                router.push({ pathname: '/memory/[id]', params: { id: answer.id } })
              }
            />
          ))}
        </View>
      )}

      <Text variant="meta" tone="muted">
        Everyone here answered the same question. Each memory stays owned by the person
        who posted it — the circle can read these, not your other memories.
      </Text>
    </Screen>
  );
}

function AnswerCard({
  answer,
  onOpen,
}: {
  answer: RequestAnswer;
  onOpen: () => void;
}) {
  const { c } = useTheme();
  const { url, failed } = useImageUrl(answer.imagePath);

  const stamp = [answer.dateHint, answer.locationHint].filter(Boolean).join(' · ');

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`${answer.title}, from ${answer.ownedByMe ? 'you' : answer.ownerName}`}
      style={({ pressed }) => [
        styles.answer,
        { borderColor: c.hairline },
        pressed && { opacity: 0.9 },
      ]}
    >
      <View style={styles.thumb}>
        {/* A member can read this image because the answer is shared with the circle;
            the signed URL is minted the same way as anywhere else. */}
        <PhotoPlate uri={url} failed={failed} aspect={1} rounded={false} />
      </View>

      <View style={styles.answerBody}>
        <View style={styles.answerHead}>
          <Avatar name={answer.ownerName} size={22} />
          <Text variant="label" tone="muted" style={styles.grow}>
            {answer.ownedByMe ? 'You' : answer.ownerName}
          </Text>
          <Text variant="meta" tone="muted">
            {relativeTime(answer.createdAt)}
          </Text>
        </View>

        <Text variant="uiStrong" numberOfLines={2}>
          {answer.title}
        </Text>

        <Text variant="body" tone="muted" numberOfLines={3}>
          {answer.originalRemark}
        </Text>

        {stamp ? (
          <Text variant="meta" tone="muted">
            {stamp}
          </Text>
        ) : null}

        {answer.contributorCount > 0 ? (
          <View style={styles.count}>
            <Icon name="people" size={13} color={c.textMuted} />
            <Text variant="meta" tone="muted">
              {answer.contributorCount}{' '}
              {answer.contributorCount === 1 ? 'person has' : 'people have'} added to
              this
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  questionCard: { borderRadius: radius.card, padding: space.base, gap: space.sm },
  list: { gap: space.md },
  answer: {
    flexDirection: 'row',
    gap: space.md,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: space.md,
  },
  thumb: { width: 84, height: 84, borderRadius: radius.image, overflow: 'hidden' },
  answerBody: { flex: 1, gap: 4 },
  answerHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  grow: { flex: 1 },
  count: { flexDirection: 'row', alignItems: 'center', gap: 5 },
});
