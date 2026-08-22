/**
 * Type scale — Heirloom PRD v1.0 §10.2.
 *
 * The fonts are BUNDLED via @expo-google-fonts, not fetched at runtime. The HTML
 * prototype linked fonts.googleapis.com, which meant the whole typographic identity
 * collapsed to system fallbacks offline — and serif-vs-mono is the identity.
 *
 * Urdu faces (Noto Nastaliq Urdu / Noto Sans Arabic) are declared here and loaded in
 * the root layout. The PRD's open question — whether mono-for-metadata survives in
 * Nastaliq, which has no monospace equivalent — is unresolved; `metaUrdu` deliberately
 * falls back to Noto Sans Arabic rather than faking a monospace Nastaliq.
 */

import { TextStyle } from 'react-native';

export const fonts = {
  /** Narrative, headlines, story text. */
  serif: 'Newsreader_400Regular',
  serifItalic: 'Newsreader_400Regular_Italic',
  serifMedium: 'Newsreader_500Medium',
  /** UI chrome: buttons, labels, navigation. */
  ui: 'InterTight_500Medium',
  uiSemi: 'InterTight_600SemiBold',
  /** Metadata: dates, counts, place labels, contributor names, IDs. */
  mono: 'JetBrainsMono_400Regular',
  /** Urdu. */
  urduSerif: 'NotoNastaliqUrdu_400Regular',
  urduUi: 'NotoSansArabic_400Regular',
} as const;

type Variant =
  | 'display'
  | 'title'
  | 'heading'
  | 'body'
  | 'ui'
  | 'label'
  | 'meta'
  | 'metaLabel';

export const type: Record<Variant, TextStyle> = {
  display: { fontFamily: fonts.serif, fontSize: 32, lineHeight: 38 },
  title: { fontFamily: fonts.serif, fontSize: 24, lineHeight: 30 },
  heading: { fontFamily: fonts.uiSemi, fontSize: 18, lineHeight: 24 },
  /** Story text — generous leading, it's meant to be read. */
  body: { fontFamily: fonts.serif, fontSize: 16, lineHeight: 26 },
  ui: { fontFamily: fonts.ui, fontSize: 15, lineHeight: 20 },
  label: { fontFamily: fonts.uiSemi, fontSize: 13, lineHeight: 16, letterSpacing: 0.26 },
  meta: { fontFamily: fonts.mono, fontSize: 12, lineHeight: 16, letterSpacing: 0.48 },
  /** Mono labels are uppercased. */
  metaLabel: {
    fontFamily: fonts.mono,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.48,
    textTransform: 'uppercase',
  },
};

/**
 * Urdu overrides. Nastaliq needs markedly more line height than Latin at the same
 * point size or the descenders collide.
 */
export const urduType: Partial<Record<Variant, TextStyle>> = {
  display: { fontFamily: fonts.urduSerif, fontSize: 30, lineHeight: 56 },
  title: { fontFamily: fonts.urduSerif, fontSize: 22, lineHeight: 44 },
  body: { fontFamily: fonts.urduSerif, fontSize: 16, lineHeight: 40 },
  ui: { fontFamily: fonts.urduUi, fontSize: 15, lineHeight: 24 },
  meta: { fontFamily: fonts.urduUi, fontSize: 12, lineHeight: 20, letterSpacing: 0 },
  metaLabel: { fontFamily: fonts.urduUi, fontSize: 12, lineHeight: 20, letterSpacing: 0 },
};
