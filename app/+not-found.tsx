/**
 * The 404.
 *
 * Worth building properly rather than leaving to the framework default, because the
 * most likely visitor is not a developer with a typo — it is someone who was sent an
 * invite link that got truncated by a messaging app, and whose next move decides
 * whether a memory gets one more contributor or none.
 */

import { useRouter } from 'expo-router';
import React from 'react';

import { Button } from '../src/components/Button';
import { Header } from '../src/components/chrome';
import { Screen } from '../src/components/layout';
import { Text } from '../src/components/Text';

export default function NotFound() {
  const router = useRouter();
  return (
    <Screen>
      <Header eyebrow="Nothing here" title="This link did not lead anywhere" />
      <Text variant="body" tone="muted">
        Invite links sometimes get cut short when they are pasted into a message. Ask
        whoever sent it to share it again — or to show you the QR code instead.
      </Text>
      <Button label="Go to your memories" onPress={() => router.replace('/')} />
    </Screen>
  );
}
