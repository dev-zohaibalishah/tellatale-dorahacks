/**
 * Making a tapped notification go somewhere.
 *
 * The server has always sent a destination — `submit-remark` puts `{ route }` in the
 * FCM data payload precisely so "Aisha added their side" can open Aisha's words. The
 * app never read it. Every notification opened the app at home and left the owner to
 * find the memory themselves, which is the moment the whole push feature was for.
 *
 * The foreground handler matters for the same reason and is easier to miss: without
 * one, expo-notifications suppresses notifications that arrive while the app is open.
 * Two people adding to the same memory in the same sitting — the exact moment worth
 * celebrating — produced nothing on screen at all.
 */

import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

/**
 * Show notifications that arrive while the app is open.
 *
 * Module scope, not an effect: expo-notifications expects the handler to be set
 * before any notification can be delivered, and a handler installed on mount races
 * a push that arrives during startup.
 */
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      // No sound and no badge. This app notifies a family about a photograph; it has
      // no business making a phone chime, and the product promises at most ten a week.
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/** Only in-app paths are followed — a route from a payload is not a free redirect. */
function safeRoute(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  // Must be a relative in-app path. This rejects `https://…`, `//host`, and any
  // scheme — a notification payload is server-controlled today, but a route taken
  // straight from a message into a navigator is the kind of thing that quietly
  // becomes an open redirect the first time anything else can write one.
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  return value;
}

export function useNotificationRouting(): void {
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS === 'web') return;

    // A notification tapped while the app was closed is already waiting here; the
    // listener below only fires for taps that happen while it is running.
    let handledCold = false;
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (handledCold || !response) return;
      handledCold = true;
      const route = safeRoute(response.notification.request.content.data?.route);
      if (route) router.push(route as never);
    });

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const route = safeRoute(response.notification.request.content.data?.route);
      if (route) router.push(route as never);
    });

    return () => sub.remove();
  }, [router]);
}
