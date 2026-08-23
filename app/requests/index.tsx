/**
 * Answer requests — the questions the family has put to each other.
 *
 * This is the mechanism the product is named for. A memory posted into an empty
 * archive is a caption; a memory posted because your mother asked "does anyone have a
 * photo from Nani's house?" is an answer, and an answer arrives with the reason it
 * exists attached. Every other screen tries to get one person to contribute. This one
 * gets a family to.
 *
 * Asking is available to anyone in the circle, not only its owner. The person most
 * likely to want a photograph is rarely the person who set the app up.
 */

import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '../../src/components/Button';
import { Header, Skeleton } from '../../src/components/chrome';
import { useToast } from '../../src/components/feedback';
import { AvatarStack } from '../../src/components/home-ui';
import { relativeTime } from '../../src/components/labels';
import { EmptyState, Screen } from '../../src/components/layout';
import { Text } from '../../src/components/Text';
import { repository } from '../../src/data';
import { useCircle, useRequests } from '../../src/hooks/circle';
import * as haptics from '../../src/lib/haptics';
import { useSession } from '../../src/state/auth';
import { useTheme } from '../../src/state/theme';
import { radius, space } from '../../src/theme/tokens';
import type { MemoryRequest } from '../../src/data/repository';

export default function Requests() {
  const router = useRouter();
  const toast = useToast();
  const { uid } = useSession();
  const { data: circle, loading: circleLoading } = useCircle(uid);
  const { data: requests, loading, error, reload } = useRequests(circle?.id);

  const [asking, setAsking] = useState(false);

  async function ask() {
    if (!circle || asking) return;
    setAsking(true);
    try {
      // The composer for a question is deliberately the memory sheet's sibling and
      // not this screen — see /requests/ask.
      router.push('/requests/ask');
    } finally {
      setAsking(false);
    }
  }

  return (
    <Screen
      footer={
        circle ? (
          <Button
            label="Ask the family something"
            variant="accent"
            full
            onPress={() => {
              haptics.contributed();
              void ask();
            }}
          />
        ) : undefined
      }
    >
      <Header onBack={() => router.back()} title="Answer requests" />

      <Text variant="body" tone="muted">
        When someone asks, the whole family can reply with a memory.
      </Text>

      {circleLoading || loading ? (
        <View style={styles.list}>
          <Skeleton height={104} />
          <Skeleton height={104} />
        </View>
      ) : !circle ? (
        <EmptyState
          line="Questions are asked inside a family circle, and you are not in one yet. Make one and invite the people who were there."
          action={
            <Button
              label="Set up your circle"
              onPress={() => router.push('/invite')}
            />
          }
        />
      ) : error ? (
        <Text variant="body" tone="muted">
          {error}
        </Text>
      ) : requests.length === 0 ? (
        <EmptyState line="Nothing asked yet. A question is the fastest way to wake an archive up — somebody always has the photo." />
      ) : (
        <View style={styles.list}>
          {requests.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              onOpen={() =>
                router.push({ pathname: '/requests/[id]', params: { id: request.id } })
              }
              onClose={async () => {
                try {
                  await repository().closeRequest(request.id);
                  toast('Question closed.', 'good');
                  reload();
                } catch (e) {
                  toast(e instanceof Error ? e.message : 'That could not be closed.', 'bad');
                }
              }}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

function RequestCard({
  request,
  onOpen,
  onClose,
}: {
  request: MemoryRequest;
  onOpen: () => void;
  onClose: () => void;
}) {
  const { c } = useTheme();

  // The design shows overlapping faces for who answered. Answer authors are known,
  // but their avatars are not loaded on a list screen — a stack of placeholders is
  // the honest shape: it says how many, not who.
  const answered = Array.from({ length: Math.min(request.answerCount, 3) }).map(() => ({
    name: null,
    uri: null,
  }));

  return (
    <View style={[styles.card, { backgroundColor: c.surfaceRaised }]}>
      <Text variant="bodyLarge" style={styles.question}>
        “{request.question}”
      </Text>

      <View style={styles.cardFoot}>
        {request.answerCount > 0 ? <AvatarStack people={answered} size={24} /> : null}
        <Text variant="label" tone="muted" style={styles.grow}>
          {request.askedByMe ? 'You asked' : `${request.askedByName} asked`}
          {' · '}
          {request.answerCount} answered
          {request.closedAt ? ' · closed' : ''}
        </Text>

        <Button
          label={request.closedAt ? 'See answers' : 'Answer'}
          variant={request.closedAt ? 'outline' : 'accent'}
          size="compact"
          onPress={onOpen}
        />
      </View>

      <View style={styles.metaRow}>
        <Text variant="meta" tone="muted" style={styles.grow}>
          {relativeTime(request.createdAt)}
        </Text>
        {request.askedByMe && !request.closedAt ? (
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close this question"
            hitSlop={8}
          >
            <Text variant="meta" tone="muted">
              Close it
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.md },
  card: { borderRadius: radius.card, padding: space.base, gap: space.md },
  question: { lineHeight: 24 },
  cardFoot: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  grow: { flex: 1 },
});
