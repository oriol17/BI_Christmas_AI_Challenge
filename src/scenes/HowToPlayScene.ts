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
    texture: TEXTURES.hazards.virusTorpedo,
    scale: 0.7,
    title: 'Virus torpedo',
    color: CSS_COLORS.red,
    text: 'Fast, pointed projectile with a right-edge level warning.\nAlways lethal; jump, duck or change routes. Antibiotics never work.',
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
  ['SPACE / ↑', 'Jump (hold for full height)'],
  ['↓ grounded', 'Crouch under head-height threats'],
  ['↓ airborne', 'Fast-fall / tuck toward a lower route'],
  ['Jump / drop', 'Switch floor, walkway, top shelf'],
  ['H', 'Toggle first-time hints (saved)'],
  ['ESC', 'Pause / resume'],
  ['M', 'Mute / unmute'],
];

export class HowToPlayScene extends Phaser.Scene {
  constructor() {
    super(SCENES.howToPlay);
  }

  create(): void {
    const { audio, settings, getBalance } = getServices(this);
    this.cameras.main.setBackgroundColor(COLORS.labDeep).fadeIn(250, 7, 18, 42);
    const bg = this.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, TEXTURES.environment.wall).setOrigin(0).setAlpha(0.25);
    bg.tilePositionX = 300;

    this.add.text(GAME_WIDTH / 2, 44, 'How to Play', displayText(46, CSS_COLORS.gold)).setOrigin(0.5);
    this.add
      .text(
        GAME_WIDTH / 2,
        88,
        'Santa runs automatically. Change levels and dodge the Grumpus’s threats!',
        bodyText(19, CSS_COLORS.cyanSoft),
      )
      .setOrigin(0.5);

    // Controls column
    this.panel(40, 120, 470, 300);
    this.add.text(64, 136, 'Controls', displayText(26, CSS_COLORS.white));
    CONTROLS.forEach(([key, action], index) => {
      const y = 177 + index * 34;
      const keyText = this.add.text(64, y, key, bodyText(16, CSS_COLORS.ink, { fontStyle: 'bold', backgroundColor: CSS_COLORS.gold, padding: { x: 7, y: 3 } }));
      this.add.text(64 + Math.max(112, keyText.width + 14), y + 2, action, bodyText(16, CSS_COLORS.white));
    });

    this.panel(40, 432, 470, 190);
    this.add.text(64, 446, 'Antibiotic rules', displayText(22, CSS_COLORS.white));
    this.add.text(
      64,
      482,
      `• A matching dose stops one Gram+ or Gram− hit, then the slot is EMPTY.\n• Each protected hit costs ${getBalance().collision.protectedCollisionPenalty} points, and refills are rare.\n• MDR bacteria and virus torpedoes are always lethal.\n• Mode: ${settings.difficultyMode === 'competition' ? 'Competition' : 'Training'} (change it in the menu).`,
      bodyText(15, CSS_COLORS.white, { lineSpacing: 6, wordWrap: { width: 430 } }),
    );

    // Legend column
    this.panel(530, 120, 710, 502);
    this.add.text(554, 136, 'Field guide', displayText(26, CSS_COLORS.white));
    LEGEND.forEach((row, index) => {
      const y = 200 + index * 70;
      this.add.image(600, y, row.texture).setScale(row.scale);
      this.add.text(660, y - 31, row.title, bodyText(18, row.color, { fontStyle: 'bold' }));
      this.add.text(660, y - 8, row.text, bodyText(14, CSS_COLORS.white, { lineSpacing: 2 }));
    });
    this.add.image(632, 200 + 4 * 70 + 4, TEXTURES.antibiotics.gramNegative).setScale(0.6);

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
