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

/**
 * Three different backgrounds, and they were all one colour by accident.
 *
 * `#10141C` is a leftover from the dark-first prototype the Figma replaced. It was
 * still painting the Android window and the splash, while the app itself renders
 * light — so launch went navy, then white, and any strip the app's own views had not
 * covered yet showed navy behind them. On an edge-to-edge Android window that strip
 * is exactly the status bar area.
 *
 * These must track `src/theme/tokens.ts`:
 *   SURFACE  = palettes.light.ink   — the window and splash, because light is default
 *   SURFACE_DARK = palettes.dark.ink — the splash when the system is in dark mode
 *   ICON_INK stays navy: the adaptive icon art was drawn against it.
 */
const SURFACE = '#FFFFFF';
const SURFACE_DARK = '#0E0E11';
const ICON_INK = '#10141C';

/**
 * The EAS project this app builds under.
 *
 * `eas init` normally writes this itself, but it can only edit a static app.json —
 * against a dynamic config it prints the id and expects you to add it by hand, which
 * is what this is.
 *
 * `slug` must match the Expo dashboard project. The on-device name, scheme, and
 * bundle id stay TellaTale; this field is only the Expo URL identifier.
 */
const EAS_PROJECT_ID = '9518139d-e38c-4731-9ac3-3dd61518d77a';

const config: ExpoConfig = {
  name: 'TellaTale',
  slug: 'zohaib-ali-shah',
  owner: 'zohaib-ali-shah',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'tellatale',
  userInterfaceStyle: 'automatic',
  // No `newArchEnabled` here: the New Architecture is the default in SDK 57 and the
  // flag was dropped from the config type. Setting it is now a typecheck error.
  backgroundColor: SURFACE,

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
      backgroundColor: ICON_INK,
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
        backgroundColor: SURFACE,
        dark: { backgroundColor: SURFACE_DARK },
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

  extra: {
    eas: { projectId: EAS_PROJECT_ID },
  },

  // Over-the-air updates. Worth having on a hackathon build specifically: a copy fix
  // or a layout correction ships to an already-installed APK without a rebuild or a
  // reinstall, which is the difference between fixing something the night before and
  // not fixing it.
  updates: {
    url: `https://u.expo.dev/${EAS_PROJECT_ID}`,
  },
  runtimeVersion: {
    // Tie updates to the native layer: an OTA update is only served to a build whose
    // compiled modules match. Without this, a JS bundle expecting a native module the
    // installed app does not have would crash on launch.
    policy: 'appVersion',
  },
};

export default config;
