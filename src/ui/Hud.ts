import Phaser from 'phaser';
import { DEPTH, GAME_HEIGHT, GAME_WIDTH } from '../config/layout';
import { COLORS, CSS_COLORS } from '../config/theme';
import { TEXTURES } from '../graphics/textureKeys';
import type { AntibioticType } from '../types/game';
import { bodyText, displayText } from './textStyles';

export interface HudState {
  readonly score: number;
  readonly distanceMeters: number;
  readonly cookies: number;
  readonly presents: number;
  readonly readiness: Readonly<Record<AntibioticType, boolean>>;
  readonly muted: boolean;
}

interface SlotView {
  readonly container: Phaser.GameObjects.Container;
  readonly frame: Phaser.GameObjects.Graphics;
  readonly icon: Phaser.GameObjects.Image;
  readonly status: Phaser.GameObjects.Text;
  readonly cross: Phaser.GameObjects.Text;
  ready: boolean | null;
}

const SLOT_WIDTH = 262;
const SLOT_HEIGHT = 66;
const SLOT_LABELS: Record<AntibioticType, string> = {
  gramPositive: 'GRAM+ ANTIBIOTIC',
  gramNegative: 'GRAM− ANTIBIOTIC',
};
const SLOT_ACCENTS: Record<AntibioticType, number> = {
  gramPositive: COLORS.gramPositive,
  gramNegative: COLORS.gramNegative,
};

/** Always-visible run information. Purely presentational: it renders whatever state it is given. */
export class Hud {
  private readonly scoreText: Phaser.GameObjects.Text;
  private readonly distanceText: Phaser.GameObjects.Text;
  private readonly cookieText: Phaser.GameObjects.Text;
  private readonly presentText: Phaser.GameObjects.Text;
  private readonly soundIcon: Phaser.GameObjects.Image;
  private readonly slots: Record<AntibioticType, SlotView>;
  private last: { score: number; distance: number; cookies: number; presents: number; muted: boolean | null } = {
    score: -1,
    distance: -1,
    cookies: -1,
    presents: -1,
    muted: null,
  };

  constructor(
    private readonly scene: Phaser.Scene,
    bestScore: number,
    onToggleSound: () => void,
  ) {
    const root = scene.add.container(0, 0).setDepth(DEPTH.hud);

    // Score / distance panel
    root.add(this.panel(16, 14, 290, 92, COLORS.cyan));
    root.add(scene.add.text(32, 22, 'SCORE', bodyText(15, CSS_COLORS.cyanSoft, { fontStyle: 'bold' })));
    this.scoreText = scene.add.text(32, 38, '0', displayText(34, CSS_COLORS.white));
    this.distanceText = scene.add.text(294, 22, '0 m', bodyText(20, CSS_COLORS.gold, { fontStyle: 'bold' })).setOrigin(1, 0);
    root.add([this.scoreText, this.distanceText]);
    root.add(scene.add.text(294, 50, `BEST ${bestScore}`, bodyText(14, CSS_COLORS.grey)).setOrigin(1, 0));

    // Antibiotic slots
    const slotsLeft = GAME_WIDTH / 2 - SLOT_WIDTH - 8;
    this.slots = {
      gramPositive: this.createSlot(root, 'gramPositive', slotsLeft, 14),
      gramNegative: this.createSlot(root, 'gramNegative', slotsLeft + SLOT_WIDTH + 16, 14),
    };

    // Cookies / presents panel
    const right = GAME_WIDTH - 16;
    root.add(this.panel(right - 220, 14, 220, 92, COLORS.gold));
    root.add(scene.add.image(right - 192, 40, TEXTURES.cookie).setScale(0.62));
    this.cookieText = scene.add.text(right - 168, 26, '× 0', displayText(24, CSS_COLORS.white));
    root.add(scene.add.image(right - 192, 80, TEXTURES.present).setScale(0.8));
    this.presentText = scene.add.text(right - 168, 66, '× 0', displayText(24, CSS_COLORS.white));
    root.add([this.cookieText, this.presentText]);
    root.add(scene.add.text(right - 14, 30, 'COOKIES', bodyText(13, CSS_COLORS.grey)).setOrigin(1, 0));
    root.add(scene.add.text(right - 14, 70, 'PRESENTS', bodyText(13, CSS_COLORS.grey)).setOrigin(1, 0));

    // Controls hint and sound toggle
    root.add(
      scene.add
        .text(GAME_WIDTH - 64, GAME_HEIGHT - 24, 'SPACE/↑ jump · ↓ crouch / air-tuck · H hints · ESC pause · M mute', bodyText(14, CSS_COLORS.cyanSoft))
        .setOrigin(1, 0.5)
        .setAlpha(0.85),
    );
    this.soundIcon = scene.add
      .image(GAME_WIDTH - 32, GAME_HEIGHT - 24, TEXTURES.ui.soundOn)
      .setInteractive({ useHandCursor: true })
      .on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, onToggleSound);
    root.add(this.soundIcon);
  }

  update(state: HudState): void {
    const score = Math.floor(state.score);
    const distance = Math.floor(state.distanceMeters);
    if (score !== this.last.score) {
      this.scoreText.setText(score.toLocaleString('en-US'));
      this.last.score = score;
    }
    if (distance !== this.last.distance) {
      this.distanceText.setText(`${distance.toLocaleString('en-US')} m`);
      this.last.distance = distance;
    }
    if (state.cookies !== this.last.cookies) {
      this.cookieText.setText(`× ${state.cookies}`);
      if (this.last.cookies >= 0) this.pulse(this.cookieText);
      this.last.cookies = state.cookies;
    }
    if (state.presents !== this.last.presents) {
      this.presentText.setText(`× ${state.presents}`);
      if (this.last.presents >= 0) this.pulse(this.presentText);
      this.last.presents = state.presents;
    }
    if (state.muted !== this.last.muted) {
      this.soundIcon.setTexture(state.muted ? TEXTURES.ui.soundOff : TEXTURES.ui.soundOn);
      this.last.muted = state.muted;
    }
    this.updateSlot('gramPositive', state.readiness.gramPositive);
    this.updateSlot('gramNegative', state.readiness.gramNegative);
  }

  /** World position of a slot icon, used for "fly to HUD" pickup effects. */
  slotPosition(type: AntibioticType): Phaser.Math.Vector2 {
    const slot = this.slots[type];
    return new Phaser.Math.Vector2(slot.container.x + 36, slot.container.y + SLOT_HEIGHT / 2);
  }

  flashSlot(type: AntibioticType, color: number): void {
    const slot = this.slots[type];
    this.drawSlotFrame(slot.frame, color, 5);
    this.scene.tweens.add({ targets: slot.container, scale: 1.08, duration: 110, yoyo: true, repeat: 1 });
    this.scene.time.delayedCall(450, () => this.drawSlotFrame(slot.frame, SLOT_ACCENTS[type], 3));
  }

  private updateSlot(type: AntibioticType, ready: boolean): void {
    const slot = this.slots[type];
    if (slot.ready === ready) return;
    const firstRender = slot.ready === null;
    slot.ready = ready;
    slot.status.setText(ready ? 'READY' : 'EMPTY').setColor(ready ? CSS_COLORS.green : CSS_COLORS.grey);
    slot.icon.setAlpha(ready ? 1 : 0.3);
    slot.cross.setVisible(!ready);
    if (!firstRender) this.pulse(slot.status);
  }

  private createSlot(root: Phaser.GameObjects.Container, type: AntibioticType, x: number, y: number): SlotView {
    const frame = this.scene.add.graphics();
    this.drawSlotFrame(frame, SLOT_ACCENTS[type], 3);
    const icon = this.scene.add.image(36, SLOT_HEIGHT / 2, TEXTURES.antibiotics[type]).setScale(0.9);
    const cross = this.scene.add.text(36, SLOT_HEIGHT / 2, '✕', displayText(30, CSS_COLORS.red)).setOrigin(0.5).setVisible(false);
    const label = this.scene.add.text(70, 10, SLOT_LABELS[type], bodyText(15, CSS_COLORS.white, { fontStyle: 'bold' }));
    const status = this.scene.add.text(70, 30, 'READY', displayText(24, CSS_COLORS.green));
    const container = this.scene.add.container(x, y, [frame, icon, cross, label, status]);
    root.add(container);
    return { container, frame, icon, status, cross, ready: null };
  }

  private drawSlotFrame(frame: Phaser.GameObjects.Graphics, accent: number, width: number): void {
    frame.clear();
    frame.fillStyle(COLORS.labDeep, 0.85);
    frame.fillRoundedRect(0, 0, SLOT_WIDTH, SLOT_HEIGHT, 12);
    frame.lineStyle(width, accent, 1);
    frame.strokeRoundedRect(0, 0, SLOT_WIDTH, SLOT_HEIGHT, 12);
  }

  private panel(x: number, y: number, w: number, h: number, accent: number): Phaser.GameObjects.Graphics {
    const graphics = this.scene.add.graphics();
    graphics.fillStyle(COLORS.labDeep, 0.82);
    graphics.fillRoundedRect(x, y, w, h, 12);
    graphics.lineStyle(2, accent, 0.9);
    graphics.strokeRoundedRect(x, y, w, h, 12);
    return graphics;
  }

  private pulse(target: Phaser.GameObjects.Text): void {
    this.scene.tweens.add({ targets: target, scale: 1.25, duration: 100, yoyo: true, ease: 'Sine.easeOut' });
  }
}
