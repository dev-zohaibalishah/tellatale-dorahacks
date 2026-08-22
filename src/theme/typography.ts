/**
 * Type scale — Heirloom (Figma).
 *
 * Two faces, and the split is different from before. The old design set narrative in
 * a serif and metadata in monospace, to separate what a person said from what the
 * archive knows. The Figma drops the monospace entirely: the serif is reserved for the
 * wordmark and for headlines, and everything else — body, metadata, labels, buttons —
 * is one grotesque at different weights and sizes.
 *
 * That is a quieter, more conventional system, and it is what the design does. The
 * eyebrow labels (LET'S BEGIN, ONE PLACE, YOUR CIRCLE) carry the personality instead:
 * small, uppercase, wide-tracked, usually in the accent.
 *
 * Fonts are bundled via @expo-google-fonts, not fetched at runtime.
 */

import { TextStyle } from 'react-native';

export const fonts = {
  /** The wordmark and headlines. A transitional serif with real contrast. */
  serif: 'PlayfairDisplay_600SemiBold',
  serifRegular: 'PlayfairDisplay_400Regular',
  /** Everything else. */
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

type Variant =
  | 'wordmark'
  | 'display'
  | 'title'
  | 'heading'
  | 'body'
  | 'bodyLarge'
  | 'ui'
  | 'uiStrong'
  | 'label'
  | 'meta'
  | 'eyebrow'
  | 'stat';

export const type: Record<Variant, TextStyle> = {
  /** "Heirloom" in the onboarding header. */
  wordmark: { fontFamily: fonts.serif, fontSize: 20, lineHeight: 26 },

  /** "The whole family, remembering together" — the biggest thing on a screen. */
  display: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 36, letterSpacing: -0.4 },

  /** Screen titles: "What will you remember today?", "Who are you collecting for?" */
  title: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 31, letterSpacing: -0.3 },

  /** Card titles, list-row names, section headers. */
  heading: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22, letterSpacing: -0.1 },

  /** Paragraphs and supporting copy. */
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  bodyLarge: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 25 },

  /** Buttons, inputs, tab labels. */
  ui: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 20 },
  uiStrong: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20 },

  /** Secondary row text: "Grandmother · 18 memories". */
  label: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },

  /** Counts, timestamps, the smallest text that still has to be read. */
  meta: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16 },

  /**
   * LET'S BEGIN · ONE PLACE · YOUR CIRCLE · THINGS TO DO.
   * The one place the design lets type get loud, so the tracking matters.
   */
  eyebrow: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },

  /** The big numbers on the profile: 7 Memories, 23 In photos. */
  stat: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 28, letterSpacing: -0.3 },
};
