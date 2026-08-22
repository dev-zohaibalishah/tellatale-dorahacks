/**
 * Registers this device for push once a session exists.
 *
 * Deliberately silent on failure. Push is a retention feature; nothing in the core
 * loop depends on it, and a permission dialog or a missing dev build must never be
 * the first thing a new user meets. The outcome is returned so a settings screen can
 * explain the state if someone goes looking.
 */

import { useEffect, useState } from 'react';

import { registerForPush, type PushOutcome } from './register';
import { useLocalBackend } from '../data';

export function usePushRegistration(uid: string | null): PushOutcome | null {
  const [outcome, setOutcome] = useState<PushOutcome | null>(null);

  useEffect(() => {
    if (!uid || useLocalBackend) return;
    let cancelled = false;

    void registerForPush(uid).then((result) => {
      if (cancelled) return;
      setOutcome(result);
      if (result.status === 'failed') {
        console.warn('push registration failed:', result.reason);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [uid]);

  return outcome;
}
