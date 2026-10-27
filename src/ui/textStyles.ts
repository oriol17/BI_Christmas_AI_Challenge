import type Phaser from 'phaser';
import { CSS_COLORS, DISPLAY_FONT_FAMILY, FONT_FAMILY } from '../config/theme';

type TextStyle = Phaser.Types.GameObjects.Text.TextStyle;

export function bodyText(size: number, color: string = CSS_COLORS.white, extra: TextStyle = {}): TextStyle {
  return {
    fontFamily: FONT_FAMILY,
    fontSize: `${size}px`,
    color,
    ...extra,
  };
}

export function displayText(size: number, color: string = CSS_COLORS.white, extra: TextStyle = {}): TextStyle {
  return {
    fontFamily: DISPLAY_FONT_FAMILY,
    fontSize: `${size}px`,
    color,
    stroke: CSS_COLORS.ink,
    strokeThickness: Math.max(3, Math.round(size / 8)),
    ...extra,
  };
}
