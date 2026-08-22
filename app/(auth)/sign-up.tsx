/**
 * Create an account.
 *
 * Three fields, and one of them is optional. Every additional field on this screen is
 * a measurable drop in completed signups, and none of the things a longer form would
 * collect — email, full name, date of birth — is needed by anything the product does.
 *
 * Validation is inline and only after a field has been touched. Showing "at least 3
 * characters" against an empty box someone has not reached yet reads as failure
 * before they have done anything wrong.
 */

import { Link, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AuthError, AuthField, PasswordStrength } from '../../src/components/auth-ui';
import { Button } from '../../src/components/Button';
import { ActionBar } from '../../src/components/chrome';
import { Icon } from '../../src/components/icons';
import { Row, Screen } from '../../src/components/layout';
import { Text } from '../../src/components/Text';
import { track } from '../../src/lib/analytics';
import { useSession } from '../../src/state/auth';
import { useTheme } from '../../src/state/theme';
import { space } from '../../src/theme/tokens';
import { validatePassword, validateUsername } from '../../src/lib/username';

export default function SignUp() {
  const router = useRouter();
  const { signUp } = useSession();
  const { c } = useTheme();

  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState<{ username: boolean; password: boolean }>({
    username: false,
    password: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const usernameProblem = touched.username ? validateUsername(username) : null;
  const passwordProblem = touched.password ? validatePassword(password) : null;

  const canSubmit =
    !validateUsername(username) && !validatePassword(password) && !busy;

  async function submit() {
    // Reveal every problem at once rather than one per attempt.
    setTouched({ username: true, password: true });
    if (!canSubmit) return;

    setBusy(true);
    setError(null);

    const result = await signUp(username, password, displayName);
    setBusy(false);

    if (!result.ok) {
      setError(result.error ?? 'That account could not be created.');
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
            label="Create account"
            variant="contribute"
            full
            loading={busy}
            onPress={submit}
          />
          <Row gap={space.xs} style={styles.switchRow}>
            <Text variant="meta" tone="muted">
              Already have one?
            </Text>
            <Link href="/(auth)/sign-in" replace>
              <Text variant="meta" tone="signal">
                Sign in
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
        <Text variant="display">Start the archive</Text>
        <Text variant="body" tone="muted">
          One account for you. The people you invite never need one — they just open
          your link and write.
        </Text>
      </View>

      <View style={styles.form}>
        <AuthField
          label="Username"
          value={username}
          onChangeText={(v) => {
            setUsername(v);
            if (error) setError(null);
            if (!touched.username && v.length >= 3) {
              setTouched((t) => ({ ...t, username: true }));
            }
          }}
          placeholder="yourname"
          autoComplete="username"
          autoFocus
          problem={usernameProblem}
          hint="Letters, numbers and underscores. This is how you sign in."
          maxLength={24}
        />

        <AuthField
          label="Your name (optional)"
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="What people call you"
          autoCapitalize="words"
          autoComplete="name"
          hint="Shown on the memories you start."
          maxLength={60}
        />

        <View style={styles.passwordBlock}>
          <AuthField
            label="Password"
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              if (error) setError(null);
              if (!touched.password && v.length >= 8) {
                setTouched((t) => ({ ...t, password: true }));
              }
            }}
            placeholder="At least 8 characters"
            autoComplete="new-password"
            secure
            problem={passwordProblem}
            onSubmitEditing={submit}
            returnKeyType="go"
          />
          <PasswordStrength password={password} />
        </View>

        {error ? <AuthError message={error} /> : null}
      </View>

      <Row gap={space.sm} style={[styles.privacy, { borderColor: c.hairline }]}>
        <Icon name="lock" size={14} color={c.textMuted} />
        <Text variant="meta" tone="muted" style={styles.privacyText}>
          No email required. Private by default — there is no public feed and no
          discovery, and nothing leaves your account until you publish it.
        </Text>
      </Row>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { gap: space.sm, paddingTop: space.xxl },
  form: { gap: space.lg, paddingTop: space.lg },
  passwordBlock: { gap: space.sm },
  switchRow: { justifyContent: 'center' },
  privacy: {
    alignItems: 'flex-start',
    borderTopWidth: 1,
    paddingTop: space.base,
    marginTop: space.lg,
  },
  privacyText: { flex: 1 },
});
