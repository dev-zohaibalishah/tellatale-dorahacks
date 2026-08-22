import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_600SemiBold,
  useFonts,
} from '@expo-google-fonts/playfair-display';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { FeedbackProvider } from '../src/components/feedback';
import { WELCOME_SEEN_KEY } from './(auth)/welcome';
import { AuthProvider, useSession } from '../src/state/auth';
import { ThemeProvider, useTheme } from '../src/state/theme';

/**
 * Fonts are bundled, not fetched. The HTML prototype linked fonts.googleapis.com,
 * which meant the serif/mono distinction — the product's central typographic move —
 * silently degraded to system fallbacks with no network. Here they ship in the binary.
 */
/**
 * Route guard.
 *
 * Two rules, and the second one matters more than it looks:
 *
 *   1. No session -> the auth group.
 *   2. `/contribute/[token]` is ALWAYS reachable, session or not. It is the whole
 *      product: a guest opens a link and writes, with no account. Bouncing them to a
 *      sign-in screen would break the one flow everything else exists to feed.
 */
function useAuthGate() {
  const { uid, ready } = useSession();
  const segments = useSegments();
  const router = useRouter();
  const [welcomeSeen, setWelcomeSeen] = useState<boolean | null>(null);

  useEffect(() => {
    void AsyncStorage.getItem(WELCOME_SEEN_KEY).then((v) => setWelcomeSeen(v === '1'));
  }, []);

  useEffect(() => {
    if (!ready || welcomeSeen === null) return;

    const group = segments[0];
    const inAuthGroup = group === '(auth)';
    const isGuestRoute = group === 'contribute';

    if (isGuestRoute) return;

    if (!uid && !inAuthGroup) {
      // First run gets the pitch; everyone else goes straight to the gate.
      router.replace(welcomeSeen ? '/(auth)/sign-in' : '/(auth)/welcome');
    } else if (uid && inAuthGroup) {
      router.replace('/');
    }
  }, [uid, ready, welcomeSeen, segments, router]);
}

function Shell() {
  const { c, name } = useTheme();
  const { ready } = useSession();
  useAuthGate();

  // Hold the splash until the stored session has been checked, so a returning user
  // never sees the sign-in screen flash before their own library appears.
  if (!ready) {
    return <View style={{ flex: 1, backgroundColor: c.ink }} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.ink }}>
      <StatusBar style={name === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: c.ink },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)/welcome" options={{ animation: 'fade' }} />
        <Stack.Screen name="(auth)/sign-in" options={{ animation: 'fade' }} />
        <Stack.Screen name="(auth)/sign-up" options={{ animation: 'fade' }} />
        <Stack.Screen name="explore" options={{ animation: 'none' }} />
        <Stack.Screen name="people" options={{ animation: 'none' }} />
        <Stack.Screen name="me" options={{ animation: 'none' }} />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="add" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="create" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="collection/new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="memory/[id]/index" />
        <Stack.Screen name="memory/[id]/invite" options={{ presentation: 'modal' }} />
        <Stack.Screen name="memory/[id]/story" />
        <Stack.Screen name="contribute/[token]" />
        <Stack.Screen name="+not-found" />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    PlayfairDisplay_400Regular,
    PlayfairDisplay_600SemiBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // Render nothing rather than a half-typeset frame; a font swap mid-read is worse
  // than a beat of blank. `error` still unblocks so a font CDN hiccup at build time
  // cannot brick the app.
  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          {/* Inside ThemeProvider — the toast and confirm surfaces are themed. */}
          <FeedbackProvider>
            <AuthProvider>
              <Shell />
            </AuthProvider>
          </FeedbackProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
