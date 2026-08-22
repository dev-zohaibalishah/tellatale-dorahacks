/**
 * Design tokens — Heirloom (Figma).
 *
 * This replaces the earlier dark ink-blue palette entirely. Two things changed at the
 * root, and both ripple everywhere:
 *
 *   • Light-first. The ground is white, cards are white on a faint grey, and depth
 *     comes from soft shadow rather than from a hairline on a dark field.
 *   • One accent, not two. The old palette reserved a warm orange strictly for
 *     contribution actions and used a separate blue for links. The Figma uses a single
 *     crimson for every affordance — primary buttons, the FAB, pagination, "See all",
 *     toggles. So `accent` is that colour and the old reserved-orange rule no longer
 *     applies. Restraint now comes from *how much* is coloured, not from what.
 *
 * Values were read from the design screenshots, so hexes are close rather than exact.
 * They are all here in one place: when the Figma inspector values arrive, this file is
 * the only edit.
 */

export type ThemeName = 'light' | 'dark';

export interface Palette {
  /** App ground. */
  ink: string;
  /** Cards, sheets, bottom bar. */
  surface: string;
  /** Inputs, chips, inset panels, the faint grey behind cards. */
  surfaceRaised: string;
  /** 1px dividers and borders. */
  hairline: string;
  /** Primary text. */
  text: string;
  /** Secondary text, captions, metadata. */
  textMuted: string;
  /** The single accent: primary buttons, FAB, pagination, links, active toggles. */
  accent: string;
  /** Accent at low opacity — a disabled primary button. */
  accentSoft: string;
  /** Text/icon colour that sits on top of `accent`. */
  onAccent: string;
  /** Near-black button (the splash "Get started"). */
  inkButton: string;
  /** Text on `inkButton`. */
  onInkButton: string;
  /** Destructive only. */
  warn: string;
}

export const palettes: Record<ThemeName, Palette> = {
  light: {
    ink: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceRaised: '#F4F4F6',
    hairline: '#E8E8EC',
    text: '#16161A',
    textMuted: '#6E6E78',
    accent: '#F5334B',
    accentSoft: '#FBD3DA',
    onAccent: '#FFFFFF',
    inkButton: '#1C1C1E',
    onInkButton: '#FFFFFF',
    warn: '#E0342F',
  },
  // The Figma is light-only. This is a faithful transposition rather than an
  // invention: the same roles, the same single accent, on a dark ground.
  dark: {
    ink: '#0E0E11',
    surface: '#17171B',
    surfaceRaised: '#1F1F25',
    hairline: '#2A2A32',
    text: '#F2F2F5',
    textMuted: '#9A9AA6',
    accent: '#FF425C',
    accentSoft: '#4A1F27',
    onAccent: '#FFFFFF',
    inkButton: '#F2F2F5',
    onInkButton: '#16161A',
    warn: '#FF5A52',
  },
};

/** 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

/** The Figma is noticeably rounder than the previous design. */
export const radius = {
  card: 16,
  /** Photo cards and the onboarding hero. */
  image: 14,
  /** Bottom sheets, top corners only. */
  sheet: 24,
  button: 14,
  /** Pills: chips, the "Add a memory" bar, tab counters. */
  pill: 999,
  avatar: 999,
} as const;

export const motion = {
  standard: 200,
  sheet: 320,
  easing: [0.2, 0.8, 0.2, 1] as const,
} as const;

export const layout = {
  gutter: 20,
  cardGutter: 12,
  /** Accessibility floor for anything tappable. */
  minTouchTarget: 48,
  /** Height of the bottom tab bar, excluding the safe-area inset. */
  tabBar: 62,
  /** Diameter of the centre FAB. */
  fab: 56,
} as const;

/**
 * Depth. In light mode the design leans on soft shadow and mostly omits borders; in
 * dark mode shadow is invisible, so the same separation has to come from a hairline.
 * Callers should apply `elevation()` and let it decide.
 */
export function elevation(theme: ThemeName, level: 'card' | 'raised' | 'bar' = 'card') {
  if (theme === 'dark') {
    return { borderWidth: 1, borderColor: palettes.dark.hairline };
  }
  const shadows = {
    card: { opacity: 0.06, radius: 12, offset: 4, elevation: 2 },
    raised: { opacity: 0.1, radius: 20, offset: 8, elevation: 6 },
    bar: { opacity: 0.08, radius: 16, offset: -2, elevation: 8 },
  }[level];

  return {
    shadowColor: '#000000',
    shadowOpacity: shadows.opacity,
    shadowRadius: shadows.radius,
    shadowOffset: { width: 0, height: shadows.offset },
    elevation: shadows.elevation,
  };
}
