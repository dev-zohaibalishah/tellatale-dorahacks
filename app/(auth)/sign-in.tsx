/**
 * Sign in.
 *
 * The pitch sits above the form deliberately. Someone arriving here has usually just
 * been handed a link by a relative and does not yet know what this is; a bare pair of
 * input boxes converts far worse than one line explaining what they are signing into.
 *
 * Errors stay ambiguous between "no such username" and "wrong password" — the server
 * returns one message for both, and distinguishing them would turn this screen into a
 * username oracle.
 */

import { Link, useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AuthError, AuthField } from '../../src/components/auth-ui';
import { Button } from '../../src/components/Button';
import { ActionBar } from '../../src/components/chrome';
import { Icon } from '../../src/components/icons';
import { Row, Screen } from '../../src/components/layout';
import { Text } from '../../src/components/Text';
import { track } from '../../src/lib/analytics';
import { useSession } from '../../src/state/auth';
import { useTheme } from '../../src/state/theme';
import { space } from '../../src/theme/tokens';

export default function SignIn() {
  const router = useRouter();
  const { signIn } = useSession();
  const { c } = useTheme();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submitted = useRef(false);

  const canSubmit = username.trim().length > 0 && password.length > 0;

  async function submit() {
    if (!canSubmit || busy) return;
    submitted.current = true;
    setBusy(true);
    setError(null);

    const result = await signIn(username, password);
    setBusy(false);

    if (!result.ok) {
      setError(result.error ?? 'That did not work.');
      return;
    }
    track({ name: 'participant', role: 'owner' });
    router.replace('/');
  }

  return (
    <Screen
      avoidKeyboard
      footer={
        <ActionBar>
          <Button
            label="Sign in"
            variant="contribute"
            full
            loading={busy}
            disabled={!canSubmit}
            onPress={submit}
          />
          <Row gap={space.xs} style={styles.switchRow}>
            <Text variant="meta" tone="muted">
              New here?
            </Text>
            <Link href="/(auth)/sign-up" replace>
              <Text variant="meta" tone="signal">
                Create an account
              </Text>
            </Link>
          </Row>
        </ActionBar>
      }
    >
      <View style={styles.brand}>
        <Text variant="metaLabel" tone="muted">
          TellaTale
        </Text>
        <Text variant="display">Welcome back</Text>
        <Text variant="body" tone="muted">
          Every photo holds more than one memory. Sign in to pick up where your
          people left off.
        </Text>
      </View>

      <View style={styles.form}>
        <AuthField
          label="Username"
          value={username}
          onChangeText={(v) => {
            setUsername(v);
            if (error) setError(null);
          }}
          placeholder="yourname"
          autoComplete="username"
          autoFocus
          returnKeyType="next"
          maxLength={24}
        />

        <AuthField
          label="Password"
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            if (error) setError(null);
          }}
          placeholder="Your password"
          autoComplete="password"
          secure
          returnKeyType="go"
          onSubmitEditing={submit}
        />

        {error ? <AuthError message={error} /> : null}
      </View>

      <Row gap={space.sm} style={[styles.privacy, { borderColor: c.hairline }]}>
        <Icon name="lock" size={14} color={c.textMuted} />
        <Text variant="meta" tone="muted" style={styles.privacyText}>
          Your memories are private by default. There is no public feed, no
          discovery, and nothing is shared until you say so.
        </Text>
      </Row>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { gap: space.sm, paddingTop: space.xxl },
  form: { gap: space.lg, paddingTop: space.lg },
  switchRow: { justifyContent: 'center' },
  privacy: {
    alignItems: 'flex-start',
    borderTopWidth: 1,
    paddingTop: space.base,
    marginTop: space.lg,
  },
  privacyText: { flex: 1 },
});
