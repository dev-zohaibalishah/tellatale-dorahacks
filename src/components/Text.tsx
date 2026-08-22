/**
 * Typed text.
 *
 * Every string in the app goes through here so the scale stays in one file. `tone`
 * covers the four colour roles the design actually uses — anything beyond that is a
 * sign the palette needs a token, not that this needs a prop.
 */

import React from 'react';
import { Text as RNText, type TextProps, type TextStyle } from 'react-native';

import { type as scale } from '../theme/typography';
import { useTheme } from '../state/theme';

type Variant = keyof typeof scale;
type Tone = 'default' | 'muted' | 'accent' | 'onAccent' | 'onInk' | 'warn';

export interface AppTextProps extends TextProps {
  variant?: Variant;
  tone?: Tone;
  center?: boolean;
}

export function Text({
  variant = 'body',
  tone = 'default',
  center,
  style,
  ...rest
}: AppTextProps) {
  const { c } = useTheme();

  const color: Record<Tone, string> = {
    default: c.text,
    muted: c.textMuted,
    accent: c.accent,
    onAccent: c.onAccent,
    onInk: c.onInkButton,
    warn: c.warn,
  };

  const base: TextStyle = {
    ...scale[variant],
    color: color[tone],
    ...(center ? { textAlign: 'center' } : null),
  };

  return <RNText {...rest} style={[base, style]} />;
}
