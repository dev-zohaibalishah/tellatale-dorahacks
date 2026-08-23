import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';

import { elevation, palettes, type Palette, type ThemeName } from '../theme/tokens';

type Preference = ThemeName | 'system';

const PREF_KEY = 'tellatale.theme.v1';

interface ThemeCtx {
  name: ThemeName;
  c: Palette;
  elevation: ReturnType<typeof elevation>;
  setTheme: (t: Preference) => void;
  preference: Preference;
}

const Ctx = createContext<ThemeCtx | null>(null);

function isPreference(v: string | null): v is Preference {
  return v === 'light' || v === 'dark' || v === 'system';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  // The Figma is light-only, so light is the default rather than following the OS.
  // Dark stays available behind the toggle in Me for anyone who wants it.
  const [preference, setPreference] = useState<Preference>('light');

  /**
   * Restore the saved choice.
   *
   * Without this the toggle in Me was theatre: it changed the colours until the app
   * was closed, and every cold start silently overrode the user. A preference the
   * product offers and then forgets is worse than one it never offered — the second
   * is a missing feature, the first reads as a bug in something they already chose.
   */
  useEffect(() => {
    let cancelled = false;
    void AsyncStorage.getItem(PREF_KEY).then((stored) => {
      if (cancelled || !isPreference(stored)) return;
      setPreference(stored);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setTheme = useCallback((next: Preference) => {
    // Applied immediately, persisted in the background. A theme switch that waits on
    // disk feels like a dropped tap.
    setPreference(next);
    void AsyncStorage.setItem(PREF_KEY, next).catch(() => {});
  }, []);

  const name: ThemeName =
    preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;

  const value = useMemo<ThemeCtx>(
    () => ({
      name,
      c: palettes[name],
      elevation: elevation(name),
      preference,
      setTheme,
    }),
    [name, preference, setTheme]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTheme must be used inside <ThemeProvider>');
  return v;
}
