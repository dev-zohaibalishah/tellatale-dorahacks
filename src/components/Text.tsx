/**
 * The typographic rule, enforced in code.
 *
 * Narrative variants are serif; `meta` is monospace. That split is the product's
 * central distinction — what a person said vs. what the archive knows about it — so
 * it lives in a component rather than in per-screen style objects where it would
 * quietly drift.
 */

import React from 'react';
import { Text as RNText, type TextProps, type TextStyle } from 'react-native';

import { type as scale } from '../theme/typography';
import { useTheme } from '../state/theme';

type Variant = keyof typeof scale;
type Tone = 'default' | 'muted' | 'signal' | 'datestamp' | 'warn' | 'inverse';

export interface AppTextProps extends TextProps {
  variant?: Variant;
  tone?: Tone;
  /** Convenience — most metadata reads centred under a plate. */
  center?: boolean;
}

export function Text({
  variant = 'ui',
  tone = 'default',
  center,
  style,
  ...rest
}: AppTextProps) {
  const { c } = useTheme();

  const color: Record<Tone, string> = {
    default: c.text,
    muted: c.textMuted,
    signal: c.signal,
    // Only ever correct on a contribution action. See tokens.ts.
    datestamp: c.datestamp,
    warn: c.warn,
    inverse: c.ink,
  };

  const base: TextStyle = {
    ...scale[variant],
    color: color[tone],
    ...(center ? { textAlign: 'center' } : null),
  };

  return <RNText {...rest} style={[base, style]} />;
}
