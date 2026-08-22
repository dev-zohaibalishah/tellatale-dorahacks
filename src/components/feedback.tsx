/**
 * Toasts and confirmations, built rather than borrowed.
 *
 * `Alert.alert` is a no-op on react-native-web, and the web build is the one a guest
 * opens from an invite link and the one a judge opens on a laptop — so the platform
 * where destructive confirmations would silently do nothing is exactly the platform
 * that matters most here. Both live in a `Modal`, which react-native-web implements.
 *
 * Confirm is promise-shaped so a caller reads as a sentence:
 *
 *   if (await confirm({ title: 'Delete this memory?', destructive: true })) …
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Animated, Modal, Pressable, StyleSheet, View } from 'react-native';

import { Button } from './Button';
import { Text } from './Text';
import { useTheme } from '../state/theme';
import { layout, radius, space } from '../theme/tokens';

/* ------------------------------------------------------------------- toast */

type ToastTone = 'neutral' | 'good' | 'bad';
interface ToastState {
  message: string;
  tone: ToastTone;
  key: number;
}

const ToastCtx = createContext<((m: string, tone?: ToastTone) => void) | null>(null);

export function useToast() {
  const v = useContext(ToastCtx);
  if (!v) throw new Error('useToast must be used inside <FeedbackProvider>');
  return v;
}

function Toast({ state }: { state: ToastState | null }) {
  const { c } = useTheme();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!state) return;
    anim.setValue(0);
    Animated.spring(anim, {
      toValue: 1,
      useNativeDriver: true,
      damping: 18,
      stiffness: 220,
    }).start();
  }, [state, anim]);

  if (!state) return null;

  const border =
    state.tone === 'bad' ? c.warn : state.tone === 'good' ? c.signal : c.hairline;

  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      style={[
        styles.toast,
        {
          // In style, not as a prop — the `pointerEvents` prop is deprecated and
          // warns on every render on web.
          pointerEvents: 'none',
          backgroundColor: c.surfaceRaised,
          borderColor: border,
          opacity: anim,
          transform: [
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
          ],
        },
      ]}
    >
      <Text variant="ui" center>
        {state.message}
      </Text>
    </Animated.View>
  );
}

/* ----------------------------------------------------------------- confirm */

export interface ConfirmOptions {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

const ConfirmCtx = createContext<((o: ConfirmOptions) => Promise<boolean>) | null>(null);

export function useConfirm() {
  const v = useContext(ConfirmCtx);
  if (!v) throw new Error('useConfirm must be used inside <FeedbackProvider>');
  return v;
}

/* ---------------------------------------------------------------- provider */

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const { c, elevation } = useTheme();
  const [toast, setToast] = useState<ToastState | null>(null);
  const [pending, setPending] = useState<{
    options: ConfirmOptions;
    resolve: (v: boolean) => void;
  } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((message: string, tone: ToastTone = 'neutral') => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ message, tone, key: Date.now() });
    timer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  useEffect(() => () => (timer.current ? clearTimeout(timer.current) : undefined), []);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => setPending({ options, resolve })),
    []
  );

  const settle = useCallback(
    (value: boolean) => {
      pending?.resolve(value);
      setPending(null);
    },
    [pending]
  );

  const o = pending?.options;

  return (
    <ToastCtx.Provider value={show}>
      <ConfirmCtx.Provider value={confirm}>
        <View style={styles.fill}>
          {children}
          <Toast state={toast} />
          <Modal
            visible={Boolean(pending)}
            transparent
            animationType="fade"
            onRequestClose={() => settle(false)}
          >
            <Pressable
              style={styles.scrim}
              accessibilityLabel="Dismiss"
              onPress={() => settle(false)}
            >
              {/* Stop the scrim's press from closing when the sheet itself is tapped. */}
              <Pressable
                onPress={() => undefined}
                style={[
                  styles.dialog,
                  { backgroundColor: c.surface, borderColor: c.hairline },
                  elevation,
                ]}
              >
                <Text variant="title">{o?.title}</Text>
                {o?.body ? (
                  <Text variant="body" tone="muted">
                    {o.body}
                  </Text>
                ) : null}
                <View style={styles.actions}>
                  <Button
                    label={o?.cancelLabel ?? 'Cancel'}
                    variant="secondary"
                    onPress={() => settle(false)}
                    style={styles.action}
                  />
                  <Button
                    label={o?.confirmLabel ?? 'Confirm'}
                    variant={o?.destructive ? 'destructive' : 'primary'}
                    onPress={() => settle(true)}
                    style={styles.action}
                  />
                </View>
              </Pressable>
            </Pressable>
          </Modal>
        </View>
      </ConfirmCtx.Provider>
    </ToastCtx.Provider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  toast: {
    position: 'absolute',
    left: space.base,
    right: space.base,
    bottom: space.xl,
    alignSelf: 'center',
    maxWidth: 420,
    borderRadius: radius.button,
    borderWidth: 1,
    paddingVertical: space.md,
    paddingHorizontal: space.base,
  },
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(4,7,12,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: layout.gutter,
  },
  dialog: {
    width: '100%',
    maxWidth: 420,
    borderRadius: radius.card,
    borderWidth: 1,
    padding: space.lg,
    gap: space.md,
  },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  action: { flex: 1 },
});
