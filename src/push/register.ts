/**
 * Push registration — the whole of Firebase's remaining job.
 *
 * The device asks for permission, gets an FCM token, and stores it in Supabase next
 * to the user it belongs to. Sending happens server-side in the submit-remark Edge
 * Function; nothing here talks to Firebase's APIs directly, and no Firebase key of
 * any kind ships in this bundle.
 *
 * Expo Go cannot receive remote push (SDK 53 removed it for Android, and iOS needs an
 * entitlement Expo Go does not carry). `registerForPush` therefore no-ops there
 * rather than throwing, and reports why, so the demo never dies on a permission
 * dialog that could not have worked.
 */

import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

import { supabase } from '../supabase/client';

export type PushOutcome =
  | { status: 'registered'; token: string }
  | { status: 'skipped'; reason: string }
  | { status: 'denied' }
  | { status: 'failed'; reason: string };

function inExpoGo(): boolean {
  return Constants.executionEnvironment === 'storeClient';
}

export async function registerForPush(userId: string): Promise<PushOutcome> {
  if (Platform.OS === 'web') {
    return { status: 'skipped', reason: 'Web push is not wired up.' };
  }
  if (!Device.isDevice) {
    return { status: 'skipped', reason: 'Push needs a physical device, not a simulator.' };
  }
  if (inExpoGo()) {
    return {
      status: 'skipped',
      reason: 'Expo Go cannot receive remote push. Use a development build.',
    };
  }
  if (!supabase) {
    return { status: 'skipped', reason: 'Supabase is not configured.' };
  }

  try {
    const existing = await Notifications.getPermissionsAsync();
    let granted = existing.granted;

    if (!granted && existing.canAskAgain) {
      const asked = await Notifications.requestPermissionsAsync();
      granted = asked.granted;
    }
    if (!granted) return { status: 'denied' };

    if (Platform.OS === 'android') {
      // Android 8+ drops notifications posted to a channel that does not exist.
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Memories',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    // The raw FCM/APNs token — not an Expo push token. The server talks to FCM
    // HTTP v1 directly, so it needs the device token, not Expo's indirection.
    const { data: token } = await Notifications.getDevicePushTokenAsync();
    if (typeof token !== 'string' || !token) {
      return { status: 'failed', reason: 'No device token was returned.' };
    }

    // Upsert on the token, not the user: one account can have several devices, and a
    // device handed to someone else must not keep pushing to the old account.
    const { error } = await supabase.from('push_tokens').upsert(
      {
        user_id: userId,
        fcm_token: token,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'fcm_token' }
    );

    if (error) return { status: 'failed', reason: error.message };
    return { status: 'registered', token };
  } catch (err) {
    return {
      status: 'failed',
      reason: err instanceof Error ? err.message : 'Push registration failed.',
    };
  }
}

/** Called on sign-out so a shared device stops receiving the previous account's pushes. */
export async function unregisterPush(): Promise<void> {
  if (!supabase || Platform.OS === 'web' || inExpoGo()) return;
  try {
    const { data: token } = await Notifications.getDevicePushTokenAsync();
    if (typeof token === 'string' && token) {
      await supabase.from('push_tokens').delete().eq('fcm_token', token);
    }
  } catch {
    // Best effort. Losing this is a stale row, not a broken sign-out.
  }
}
