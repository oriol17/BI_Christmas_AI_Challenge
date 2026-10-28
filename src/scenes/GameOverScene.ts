import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/layout';
import { COLORS, CSS_COLORS } from '../config/theme';
import { TEXTURES } from '../graphics/textureKeys';
import { DEFEAT_MESSAGES } from '../logic/collisionRules';
import type { DefeatCause } from '../types/game';
import { getServices } from '../systems/services';
import { MenuList } from '../ui/MenuList';
import { bodyText, displayText } from '../ui/textStyles';
import { onEscapeKey } from '../utils/escapeKey';
import type { GameOverData } from './GameScene';
import { SCENES } from './sceneKeys';

const CAUSE_TEXTURE: Record<DefeatCause, string> = {
  gramPositive: TEXTURES.bacteria.gramPositive,
  gramNegative: TEXTURES.bacteria.gramNegative,
  mdr: TEXTURES.bacteria.mdr,
  virusTorpedo: TEXTURES.hazards.virusTorpedo,
};

const CAUSE_TIP: Record<DefeatCause, string> = {
  gramPositive: 'Tip: when your Gram+ slot shows EMPTY, jump or duck around round "+" clusters.',
  gramNegative: 'Tip: when your Gram− slot shows EMPTY, avoid the rod-shaped "−" bacteria.',
  mdr: 'Tip: MDR superbugs are announced with a red edge warning that says JUMP! or DUCK!',
  virusTorpedo: 'Tip: virus torpedoes are always lethal. Jump, duck, or change levels; antibiotics never work.',
};

const CAUSE_COLOR: Record<DefeatCause, string> = {
  gramPositive: CSS_COLORS.gramPositive,
  gramNegative: CSS_COLORS.gramNegative,
  mdr: CSS_COLORS.mdrDanger,
  virusTorpedo: CSS_COLORS.red,
};

const FALLBACK: GameOverData = {
  cause: 'gramPositive',
  distanceMeters: 0,
  cookies: 0,
  presents: 0,
  score: 0,
  best: 0,
  isNewBest: false,
};

function isGameOverData(value: unknown): value is GameOverData {
  return typeof value === 'object' && value !== null && 'cause' in value && 'score' in value;
}

export class GameOverScene extends Phaser.Scene {
  private leaving = false;

  constructor() {
    super(SCENES.gameOver);
  }

  create(rawData: unknown): void {
    const data = isGameOverData(rawData) ? rawData : FALLBACK;
    const { audio } = getServices(this);
    const message = DEFEAT_MESSAGES[data.cause];
    this.leaving = false;

    this.cameras.main.setBackgroundColor(COLORS.labDeep).fadeIn(350, 7, 18, 42);
    this.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, TEXTURES.environment.wall).setOrigin(0).setAlpha(0.22);

    const panel = this.add.graphics();
    panel.fillStyle(COLORS.labBlue, 0.94);
    panel.fillRoundedRect(110, 40, GAME_WIDTH - 220, 640, 24);
    panel.lineStyle(4, Phaser.Display.Color.HexStringToColor(CAUSE_COLOR[data.cause]).color, 1);
    panel.strokeRoundedRect(110, 40, GAME_WIDTH - 220, 640, 24);

    this.add.text(GAME_WIDTH / 2, 92, 'GAME OVER', displayText(30, CSS_COLORS.grey)).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, 142, message.title, displayText(44, CAUSE_COLOR[data.cause])).setOrigin(0.5);
    this.add
      .text(GAME_WIDTH / 2, 194, message.description, bodyText(20, CSS_COLORS.white, { align: 'center', wordWrap: { width: 860 } }))
      .setOrigin(0.5, 0);

    // Defeated Santa and the culprit
    this.add.image(300, 410, TEXTURES.santa.defeat).setScale(1.9);
    const culprit = this.add.image(300 + 130, 380, CAUSE_TEXTURE[data.cause]).setScale(
      data.cause === 'mdr' ? 0.9 : data.cause === 'virusTorpedo' ? 1 : 1.2,
    );
    this.tweens.add({ targets: culprit, y: 366, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // Results
    const rows: [string, string][] = [
      ['Distance', `${Math.floor(data.distanceMeters).toLocaleString('en-US')} m`],
      ['Gingerbread cookies', `${data.cookies}`],
      ['Presents delivered', `${data.presents}`],
      ['Final score', data.score.toLocaleString('en-US')],
      ['Best score (this browser)', data.best.toLocaleString('en-US')],
    ];
    rows.forEach(([label, value], index) => {
      const y = 290 + index * 44;
      const isScore = index === 3;
      this.add.text(560, y, label, bodyText(20, CSS_COLORS.cyanSoft));
      this.add
        .text(1060, y - (isScore ? 6 : 0), value, isScore ? displayText(30, CSS_COLORS.gold) : bodyText(22, CSS_COLORS.white, { fontStyle: 'bold' }))
        .setOrigin(1, 0);
    });
    if (data.isNewBest && data.score > 0) {
      const badge = this.add
        .text(810, 520, '★ NEW BEST SCORE! ★', displayText(26, CSS_COLORS.gold))
        .setOrigin(0.5);
      this.tweens.add({ targets: badge, scale: 1.1, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    this.add.text(GAME_WIDTH / 2, 556, CAUSE_TIP[data.cause], bodyText(17, CSS_COLORS.grey)).setOrigin(0.5);

    new MenuList(
      this,
      GAME_WIDTH / 2 - 170,
      616,
      [
        { label: 'Play Again', onSelect: () => this.leaveTo(SCENES.game) },
        { label: 'Main Menu', onSelect: () => this.leaveTo(SCENES.menu) },
      ],
      audio,
      { horizontal: true, spacing: 340, buttonWidth: 300 },
    );
    this.input.keyboard?.on('keydown-R', () => this.leaveTo(SCENES.game));
    this.input.keyboard?.on('keydown-M', () => this.leaveTo(SCENES.menu));
    onEscapeKey(this, () => this.leaveTo(SCENES.menu));
    this.add
      .text(GAME_WIDTH / 2, 662, '← / → choose · ENTER select · R play again · M / ESC main menu', bodyText(14, CSS_COLORS.grey))
      .setOrigin(0.5);
  }

  private leaveTo(scene: string): void {
    if (this.leaving) return;
    this.leaving = true;
    this.cameras.main.fadeOut(250, 7, 18, 42);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(scene));
  }
}
