import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/layout';
import { COLORS, CSS_COLORS } from '../config/theme';
import { TEXTURES } from '../graphics/textureKeys';
import { getServices } from '../systems/services';
import { MenuList } from '../ui/MenuList';
import { bodyText, displayText } from '../ui/textStyles';
import { onEscapeKey } from '../utils/escapeKey';
import { SCENES } from './sceneKeys';

interface LegendRow {
  readonly texture: string;
  readonly scale: number;
  readonly title: string;
  readonly color: string;
  readonly text: string;
}

const LEGEND: readonly LegendRow[] = [
  {
    texture: TEXTURES.bacteria.gramPositive,
    scale: 0.9,
    title: 'Gram-positive',
    color: CSS_COLORS.gramPositive,
    text: 'Round grape-like cluster, thick outline, "+" symbol.\nYour Gram+ antibiotic protects you once.',
  },
  {
    texture: TEXTURES.bacteria.gramNegative,
    scale: 0.9,
    title: 'Gram-negative',
    color: CSS_COLORS.gramNegative,
    text: 'Rod shape, double outline, wiggly tails, "−" symbol.\nYour Gram− antibiotic protects you once.',
  },
  {
    texture: TEXTURES.bacteria.mdr,
    scale: 0.62,
    title: 'MDR superbug',
    color: CSS_COLORS.mdr,
    text: 'Big, spiky, ⚠ warning sign, flashing red alert.\nNo antibiotic works. ALWAYS dodge it!',
  },
  {
    texture: TEXTURES.antibiotics.gramPositive,
    scale: 0.85,
    title: 'Antibiotic pickups',
    color: CSS_COLORS.green,
    text: 'Capsule (+) refills an EMPTY Gram+ slot, vial (−) an EMPTY\nGram− slot. Full slots leave the pickup in place.',
  },
  {
    texture: TEXTURES.cookie,
    scale: 0.85,
    title: 'Gingerbread cookie',
    color: CSS_COLORS.gold,
    text: '+100 points each. Presents are delivered automatically\nevery 500 m for +500 points.',
  },
];

const CONTROLS: readonly [string, string][] = [
  ['SPACE / ↑', 'Jump over floor-level bacteria'],
  ['↓ (hold)', 'Duck under head-height bacteria'],
  ['Nothing!', 'Keep running under high flyers'],
  ['ESC', 'Pause / resume'],
  ['M', 'Mute / unmute'],
];

export class HowToPlayScene extends Phaser.Scene {
  constructor() {
    super(SCENES.howToPlay);
  }

  create(): void {
    const { audio } = getServices(this);
    this.cameras.main.setBackgroundColor(COLORS.labDeep).fadeIn(250, 7, 18, 42);
    const bg = this.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, TEXTURES.environment.wall).setOrigin(0).setAlpha(0.25);
    bg.tilePositionX = 300;

    this.add.text(GAME_WIDTH / 2, 44, 'How to Play', displayText(46, CSS_COLORS.gold)).setOrigin(0.5);
    this.add
      .text(
        GAME_WIDTH / 2,
        88,
        'Santa runs automatically. Dodge the Grumpus’s bacteria, deliver presents and grab cookies!',
        bodyText(19, CSS_COLORS.cyanSoft),
      )
      .setOrigin(0.5);

    // Controls column
    this.panel(40, 120, 470, 330);
    this.add.text(64, 136, 'Controls', displayText(26, CSS_COLORS.white));
    CONTROLS.forEach(([key, action], index) => {
      const y = 186 + index * 50;
      const keyText = this.add.text(64, y, key, bodyText(18, CSS_COLORS.ink, { fontStyle: 'bold', backgroundColor: CSS_COLORS.gold, padding: { x: 8, y: 4 } }));
      this.add.text(64 + Math.max(130, keyText.width + 14), y + 2, action, bodyText(18, CSS_COLORS.white));
    });

    this.panel(40, 462, 470, 160);
    this.add.text(64, 476, 'Antibiotic rules', displayText(22, CSS_COLORS.white));
    this.add.text(
      64,
      512,
      '• You carry at most ONE Gram+ and ONE Gram− dose.\n• Touching a bacterium uses the matching dose.\n• No matching dose: game over. MDR: always over!\n• Watch the HUD slots: READY or EMPTY.',
      bodyText(17, CSS_COLORS.white, { lineSpacing: 6, wordWrap: { width: 430 } }),
    );

    // Legend column
    this.panel(530, 120, 710, 502);
    this.add.text(554, 136, 'Field guide', displayText(26, CSS_COLORS.white));
    LEGEND.forEach((row, index) => {
      const y = 214 + index * 84;
      this.add.image(600, y, row.texture).setScale(row.scale);
      this.add.text(660, y - 34, row.title, bodyText(20, row.color, { fontStyle: 'bold' }));
      this.add.text(660, y - 9, row.text, bodyText(16, CSS_COLORS.white, { lineSpacing: 3 }));
    });
    this.add.image(632, 214 + 3 * 84 + 4, TEXTURES.antibiotics.gramNegative).setScale(0.6);

    this.add
      .text(
        GAME_WIDTH / 2,
        642,
        'Disclaimer: the microbiology in this game is intentionally simplified for entertainment and educational awareness.\nIt is not medical advice. Real antibiotic use should always follow professional guidance.',
        bodyText(14, '#c8d4e3', { align: 'center', lineSpacing: 3 }),
      )
      .setOrigin(0.5, 0);

    new MenuList(this, GAME_WIDTH - 150, 64, [{ label: 'Back', onSelect: () => this.back() }], audio, { buttonWidth: 180 });
    onEscapeKey(this, () => this.back());
  }

  private panel(x: number, y: number, w: number, h: number): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(COLORS.labBlue, 0.88);
    graphics.fillRoundedRect(x, y, w, h, 16);
    graphics.lineStyle(2, COLORS.cyan, 0.8);
    graphics.strokeRoundedRect(x, y, w, h, 16);
  }

  private back(): void {
    this.scene.start(SCENES.menu);
  }
}
