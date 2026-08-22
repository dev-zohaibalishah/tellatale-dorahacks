/**
 * Design tokens — Heirloom PRD v1.0 §10.2, verbatim.
 *
 * Two rules from the PRD that are load-bearing, not stylistic:
 *
 *  1. `datestamp` is reserved for CONTRIBUTION ACTIONS ONLY (post, add your side,
 *     answer, tag). Nothing else in the product is that colour. Warmth in this
 *     interface means someone did something. Do not use it for emphasis, links,
 *     selected states, or decoration — use `signal` for those.
 *  2. Narrative is serif, metadata is monospace. That distinction separates what a
 *     person said from what the archive knows about it, which is the central
 *     distinction in the product. See ./typography.ts.
 *
 * Extend the token set rather than hardcoding values into components.
 */

export type ThemeName = 'dark' | 'light';

export interface Palette {
  /** App ground. */
  ink: string;
  /** Cards, sheets. */
  surface: string;
  /** Inputs, pressed states. */
  surfaceRaised: string;
  /** 1px dividers, borders, graph edges. */
  hairline: string;
  /** Primary text. */
  text: string;
  /** Metadata, captions, timestamps. */
  textMuted: string;
  /** CONTRIBUTION ACTIONS ONLY. */
  datestamp: string;
  /** Links, selected states. */
  signal: string;
  /** Destructive only. */
  warn: string;
}

export const palettes: Record<ThemeName, Palette> = {
  dark: {
    ink: '#10141C',
    surface: '#1A202B',
    surfaceRaised: '#232B38',
    hairline: '#2E3644',
    text: '#EDF0F4',
    textMuted: '#8B96A8',
    datestamp: '#FF6B2C',
    signal: '#7FA8D9',
    warn: '#E0574F',
  },
  light: {
    // Cool near-white, deliberately NOT cream.
    ink: '#F6F7F8',
    surface: '#FFFFFF',
    surfaceRaised: '#EDEFF2',
    hairline: '#DDE1E7',
    text: '#131820',
    textMuted: '#5F6A7B',
    datestamp: '#E85A1A',
    signal: '#2F6BAA',
    warn: '#E0574F',
  },
};

/** SPACE 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 */
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

export const radius = {
  card: 14,
  /** Top corners only. */
  sheet: 20,
  button: 10,
  avatar: 999,
  image: 8,
} as const;

export const motion = {
  standard: 200,
  sheet: 320,
  /** Tag reveal: 260ms, staggered 40ms per label. */
  reveal: 260,
  revealStagger: 40,
  /** cubic-bezier(.2,.8,.2,1) */
  easing: [0.2, 0.8, 0.2, 1] as const,
} as const;

export const layout = {
  /** Screen gutter. */
  gutter: 16,
  /** Between cards. */
  cardGutter: 8,
  /** Minimum touch target — PRD global DoD requires >= 48dp. */
  minTouchTarget: 48,
} as const;

/**
 * SHADOW: none on dark (use hairline borders); light mode gets a single soft lift.
 * Returned as a style object rather than a token string so RN can consume it directly.
 */
export function elevation(theme: ThemeName) {
  if (theme === 'dark') return {};
  return {
    shadowColor: '#131820',
    shadowOpacity: 0.06,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  };
}
