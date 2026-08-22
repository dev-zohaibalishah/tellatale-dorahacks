import React, { createContext, useContext, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

import { elevation, palettes, type Palette, type ThemeName } from '../theme/tokens';

interface ThemeCtx {
  name: ThemeName;
  c: Palette;
  elevation: ReturnType<typeof elevation>;
  setTheme: (t: ThemeName | 'system') => void;
  preference: ThemeName | 'system';
}

const Ctx = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [preference, setPreference] = useState<ThemeName | 'system'>('system');

  const name: ThemeName =
    preference === 'system' ? (system === 'light' ? 'light' : 'dark') : preference;

  const value = useMemo<ThemeCtx>(
    () => ({
      name,
      c: palettes[name],
      elevation: elevation(name),
      preference,
      setTheme: setPreference,
    }),
    [name, preference]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTheme must be used inside <ThemeProvider>');
  return v;
}
