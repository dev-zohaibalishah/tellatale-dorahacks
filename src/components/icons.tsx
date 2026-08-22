/**
 * Icons, drawn rather than installed.
 *
 * The set is small enough (nine glyphs) that a font dependency would cost more than
 * it saves, and react-native-svg is already in the tree for the QR code. Every glyph
 * is stroked on a 24-unit grid at 1.6 weight so they sit at the same optical weight
 * as Inter Tight Medium next to them.
 */

import React from 'react';
import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';

import { useTheme } from '../state/theme';

export type IconName =
  | 'back'
  | 'close'
  | 'plus'
  | 'share'
  | 'link'
  | 'qr'
  | 'image'
  | 'camera'
  | 'check'
  | 'trash'
  | 'refresh'
  | 'edit'
  | 'lock'
  | 'globe'
  | 'download'
  | 'sun'
  | 'moon'
  | 'star'
  | 'chevron'
  | 'eye'
  | 'eyeOff'
  | 'alert'
  | 'user'
  | 'signOut'
  | 'search'
  | 'folder'
  | 'inbox';

interface Props {
  name: IconName;
  size?: number;
  color?: string;
  /** Only meaningful for `star`, which doubles as a rating control. */
  filled?: boolean;
}

export function Icon({ name, size = 20, color, filled }: Props) {
  const { c } = useTheme();
  const stroke = color ?? c.text;
  const p = {
    stroke,
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {glyph(name, p, stroke, filled)}
    </Svg>
  );
}

function glyph(
  name: IconName,
  p: Record<string, unknown>,
  stroke: string,
  filled?: boolean
) {
  switch (name) {
    case 'back':
      return (
        <>
          <Line x1={20} y1={12} x2={5} y2={12} {...p} />
          <Polyline points="11 18 5 12 11 6" {...p} />
        </>
      );
    case 'chevron':
      return <Polyline points="9 6 15 12 9 18" {...p} />;
    case 'close':
      return (
        <>
          <Line x1={18} y1={6} x2={6} y2={18} {...p} />
          <Line x1={6} y1={6} x2={18} y2={18} {...p} />
        </>
      );
    case 'plus':
      return (
        <>
          <Line x1={12} y1={5} x2={12} y2={19} {...p} />
          <Line x1={5} y1={12} x2={19} y2={12} {...p} />
        </>
      );
    case 'share':
      return (
        <>
          <Path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" {...p} />
          <Polyline points="16 6 12 2 8 6" {...p} />
          <Line x1={12} y1={2} x2={12} y2={15} {...p} />
        </>
      );
    case 'link':
      return (
        <>
          <Path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" {...p} />
          <Path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" {...p} />
        </>
      );
    case 'qr':
      return (
        <>
          <Rect x={3} y={3} width={7} height={7} rx={1} {...p} />
          <Rect x={14} y={3} width={7} height={7} rx={1} {...p} />
          <Rect x={3} y={14} width={7} height={7} rx={1} {...p} />
          <Line x1={14} y1={14} x2={14} y2={21} {...p} />
          <Line x1={18} y1={14} x2={21} y2={14} {...p} />
          <Line x1={18} y1={18} x2={21} y2={21} {...p} />
        </>
      );
    case 'image':
      return (
        <>
          <Rect x={3} y={4} width={18} height={16} rx={2} {...p} />
          <Circle cx={8.5} cy={9.5} r={1.5} {...p} />
          <Polyline points="21 16 15.5 10.5 6 20" {...p} />
        </>
      );
    case 'camera':
      return (
        <>
          <Path d="M3 8a2 2 0 0 1 2-2h2.5l1.5-2h6l1.5 2H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" {...p} />
          <Circle cx={12} cy={13} r={3.5} {...p} />
        </>
      );
    case 'check':
      return <Polyline points="4 12.5 9.5 18 20 6" {...p} />;
    case 'trash':
      return (
        <>
          <Polyline points="3 6 21 6" {...p} />
          <Path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" {...p} />
          <Path d="M6 6v14a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V6" {...p} />
        </>
      );
    case 'refresh':
      return (
        <>
          <Path d="M20 12a8 8 0 1 1-2.6-5.9" {...p} />
          <Polyline points="20 4 20 10 14 10" {...p} />
        </>
      );
    case 'edit':
      return (
        <>
          <Path d="M4 20h4L20 8a2.8 2.8 0 0 0-4-4L4 16z" {...p} />
          <Line x1={14} y1={6} x2={18} y2={10} {...p} />
        </>
      );
    case 'lock':
      return (
        <>
          <Rect x={4} y={10} width={16} height={11} rx={2} {...p} />
          <Path d="M8 10V7a4 4 0 0 1 8 0v3" {...p} />
        </>
      );
    case 'eye':
      return (
        <>
          <Path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" {...p} />
          <Circle cx={12} cy={12} r={3} {...p} />
        </>
      );
    case 'eyeOff':
      return (
        <>
          <Path d="M10.6 6.1A9.7 9.7 0 0 1 12 6c6.5 0 10 7 10 7a17 17 0 0 1-3 3.9" {...p} />
          <Path d="M6.6 6.7A17 17 0 0 0 2 13s3.5 7 10 7a9.6 9.6 0 0 0 4.6-1.1" {...p} />
          <Path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" {...p} />
          <Line x1={3} y1={3} x2={21} y2={21} {...p} />
        </>
      );
    case 'alert':
      return (
        <>
          <Circle cx={12} cy={12} r={9} {...p} />
          <Line x1={12} y1={8} x2={12} y2={13} {...p} />
          <Line x1={12} y1={16.5} x2={12} y2={16.5} {...p} />
        </>
      );
    case 'user':
      return (
        <>
          <Circle cx={12} cy={8} r={4} {...p} />
          <Path d="M4 21a8 8 0 0 1 16 0" {...p} />
        </>
      );
    case 'search':
      return (
        <>
          <Circle cx={11} cy={11} r={7} {...p} />
          <Line x1={16.5} y1={16.5} x2={21} y2={21} {...p} />
        </>
      );
    case 'folder':
      return (
        <Path
          d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
          {...p}
        />
      );
    case 'inbox':
      return (
        <>
          <Path d="M3 12h5l2 3h4l2-3h5" {...p} />
          <Path d="M5 5h14l2 7v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5z" {...p} />
        </>
      );
    case 'signOut':
      return (
        <>
          <Path d="M14 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h8" {...p} />
          <Polyline points="17 16 21 12 17 8" {...p} />
          <Line x1={21} y1={12} x2={10} y2={12} {...p} />
        </>
      );
    case 'globe':
      return (
        <>
          <Circle cx={12} cy={12} r={9} {...p} />
          <Line x1={3} y1={12} x2={21} y2={12} {...p} />
          <Path d="M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18z" {...p} />
        </>
      );
    case 'download':
      return (
        <>
          <Path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" {...p} />
          <Polyline points="8 11 12 15 16 11" {...p} />
          <Line x1={12} y1={3} x2={12} y2={15} {...p} />
        </>
      );
    case 'sun':
      return (
        <>
          <Circle cx={12} cy={12} r={4} {...p} />
          <Line x1={12} y1={2} x2={12} y2={4} {...p} />
          <Line x1={12} y1={20} x2={12} y2={22} {...p} />
          <Line x1={2} y1={12} x2={4} y2={12} {...p} />
          <Line x1={20} y1={12} x2={22} y2={12} {...p} />
          <Line x1={5} y1={5} x2={6.5} y2={6.5} {...p} />
          <Line x1={17.5} y1={17.5} x2={19} y2={19} {...p} />
          <Line x1={19} y1={5} x2={17.5} y2={6.5} {...p} />
          <Line x1={6.5} y1={17.5} x2={5} y2={19} {...p} />
        </>
      );
    case 'moon':
      return <Path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" {...p} />;
    case 'star':
      return (
        <Path
          d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z"
          {...p}
          fill={filled ? stroke : 'none'}
        />
      );
  }
}
