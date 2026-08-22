import type { ExpoConfig } from 'expo/config';

/**
 * Dynamic Expo config.
 *
 * This replaced app.json for one reason: app.json is static JSON, so
 * `"applinks:$EXPO_PUBLIC_LINK_HOST"` shipped that dollar sign *literally* into the
 * iOS entitlements and the Android intent filter. Nothing complains at build time —
 * the app just quietly never handles its own invite links, which is invisible on web
 * and only shows up on a device.
 *
 * The associated-domain and intent-filter entries are now omitted entirely when no
 * host is configured. An absent entry is honest; an entry pointing at a placeholder
 * domain is a deep-link handler registered for a domain nobody owns.
 */

const linkHost = process.env.EXPO_PUBLIC_LINK_HOST?.trim();

const BUNDLE_ID = 'xyz.tellatale.app';
const INK = '#10141C';

const config: ExpoConfig = {
  name: 'TellaTale',
  slug: 'tellatale',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'tellatale',
  userInterfaceStyle: 'automatic',
  // No `newArchEnabled` here: the New Architecture is the default in SDK 57 and the
  // flag was dropped from the config type. Setting it is now a typecheck error.
  backgroundColor: INK,

  ios: {
    supportsTablet: true,
    bundleIdentifier: BUNDLE_ID,
    // Only claim the domain when there is a domain to claim.
    ...(linkHost ? { associatedDomains: [`applinks:${linkHost}`] } : {}),
    infoPlist: {
      NSPhotoLibraryUsageDescription:
        'TellaTale needs access to your photos so you can choose the image a memory is built around.',
      NSCameraUsageDescription:
        'TellaTale uses the camera so you can photograph a print or an object you want to remember together.',
    },
  },

  android: {
    package: BUNDLE_ID,
    adaptiveIcon: {
      backgroundColor: INK,
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    // autoVerify requires a matching /.well-known/assetlinks.json on the host.
    // Without one the filter registers but Android will not make TellaTale the
    // default handler, so the link opens a browser instead.
    ...(linkHost
      ? {
          intentFilters: [
            {
              action: 'VIEW',
              autoVerify: true,
              data: [{ scheme: 'https', host: linkHost }],
              category: ['BROWSABLE', 'DEFAULT'],
            },
          ],
        }
      : {}),
    // Vibration is what expo-haptics falls back to on devices without a haptic
    // engine, and Android requires the permission declared even for that.
    permissions: ['android.permission.VIBRATE'],

    // expo-image-picker declares RECORD_AUDIO because it can pick video. TellaTale
    // picks images only — `mediaTypes: ['images']` everywhere — so the manifest was
    // asking for the microphone in a photo app. Users read that as surveillance and
    // Play reviewers ask about it. Blocked rather than explained.
    blockedPermissions: [
      'android.permission.RECORD_AUDIO',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
    ],
  },

  web: {
    favicon: './assets/favicon.png',
    bundler: 'metro',
    output: 'single',
  },

  plugins: [
    'expo-router',
    'expo-image',
    'expo-sharing',
    'expo-font',
    'expo-web-browser',
    [
      'expo-splash-screen',
      {
        backgroundColor: INK,
        dark: { backgroundColor: INK },
        image: './assets/splash-icon.png',
        imageWidth: 160,
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission:
          'TellaTale needs access to your photos so you can choose the image a memory is built around.',
        cameraPermission:
          'TellaTale uses the camera so you can photograph a print or an object you want to remember together.',
      },
    ],
  ],

  experiments: {
    typedRoutes: true,
  },
};

export default config;
