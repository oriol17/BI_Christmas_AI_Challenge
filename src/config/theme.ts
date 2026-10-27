/** Shared colour palette and typography. Cool lab blues/cyans + warm Christmas reds/golds. */
export const COLORS = {
  night: 0x07122a,
  labDeep: 0x0b1a2e,
  labBlue: 0x14304f,
  labSteel: 0x2a4a6b,
  cyan: 0x2de2e6,
  cyanSoft: 0x8ff4ff,
  christmasRed: 0xd6283b,
  christmasGreen: 0x2fae66,
  gold: 0xffc94a,
  white: 0xffffff,
  ink: 0x0a1426,
  gramPositive: 0x8e4dff,
  gramNegative: 0xff5fa2,
  mdr: 0x9cff2e,
  mdrDanger: 0xff3b2f,
  ready: 0x46e38a,
  empty: 0x7f8ea3,
  cookie: 0xc77a3a,
} as const;

export const CSS_COLORS = {
  white: '#ffffff',
  ink: '#0a1426',
  cyan: '#2de2e6',
  cyanSoft: '#8ff4ff',
  gold: '#ffc94a',
  red: '#ff4d5e',
  christmasRed: '#d6283b',
  green: '#46e38a',
  grey: '#9fb0c4',
  gramPositive: '#b48bff',
  gramNegative: '#ff7db4',
  mdr: '#b6ff5c',
  mdrDanger: '#ff5a4a',
  panel: '#0b1a2e',
} as const;

export const FONT_FAMILY = '"Trebuchet MS", "Segoe UI", Arial, sans-serif';
export const DISPLAY_FONT_FAMILY = '"Arial Black", "Trebuchet MS", "Segoe UI", Arial, sans-serif';

export function hexToCss(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}
