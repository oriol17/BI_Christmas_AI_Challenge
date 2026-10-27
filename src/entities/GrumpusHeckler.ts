import type Phaser from 'phaser';
import { DEPTH } from '../config/layout';
import { CSS_COLORS } from '../config/theme';
import { TEXTURES } from '../graphics/textureKeys';
import { bodyText } from '../ui/textStyles';
import { randomRange, type RandomSource } from '../utils/random';

type GrumpusState = 'hidden' | 'entering' | 'visible' | 'leaving';

const SHOWN_Y = 232;
const HIDDEN_Y = -170;
const X = 1110;

const TAUNTS = [
  'Bah! Humbug-bugs!',
  'Catch my cultures, Santa!',
  'No Christmas this year!',
  'Fresh from my petri dish!',
  'Achoo-ristmas is cancelled!',
] as const;

/**
 * The Grumpus appears occasionally on a hover platform in the background. He is decorative
 * and never collides with Santa; gameplay focus stays on the bacteria.
 */
export class GrumpusHeckler {
  private readonly container: Phaser.GameObjects.Container;
  private readonly figure: Phaser.GameObjects.Image;
  private readonly bubble: Phaser.GameObjects.Container;
  private readonly bubbleText: Phaser.GameObjects.Text;
  private state: GrumpusState = 'hidden';
  private stateTimerMs: number;
  private poseTimerMs = 0;
  private forcedVisibleMs = 0;
  private hoverTween: Phaser.Tweens.Tween | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly rng: RandomSource,
    firstAppearanceMs = 2500,
  ) {
    const platform = scene.add.image(0, 70, TEXTURES.grumpus.platform);
    this.figure = scene.add.image(0, 58, TEXTURES.grumpus.idle).setOrigin(0.5, 1);
    this.bubbleText = scene.add.text(0, 0, '', bodyText(17, CSS_COLORS.ink, { fontStyle: 'bold' })).setOrigin(0.5);
    const bubbleBg = scene.add.graphics();
    this.bubble = scene.add.container(-150, -40, [bubbleBg, this.bubbleText]).setVisible(false);
    this.container = scene.add.container(X, HIDDEN_Y, [platform, this.figure, this.bubble]).setDepth(DEPTH.grumpus);
    this.stateTimerMs = firstAppearanceMs;
  }

  get isVisible(): boolean {
    return this.state === 'visible';
  }

  update(deltaMs: number): void {
    this.stateTimerMs -= deltaMs;
    if (this.forcedVisibleMs > 0) this.forcedVisibleMs -= deltaMs;
    if (this.poseTimerMs > 0) {
      this.poseTimerMs -= deltaMs;
      if (this.poseTimerMs <= 0) this.figure.setTexture(TEXTURES.grumpus.idle);
    }

    if (this.state === 'hidden' && this.stateTimerMs <= 0) {
      this.enter();
      if (this.rng() < 0.7) this.say(TAUNTS[Math.floor(this.rng() * TAUNTS.length)] ?? TAUNTS[0]);
    } else if (this.state === 'visible' && this.stateTimerMs <= 0 && this.forcedVisibleMs <= 0) {
      this.leave();
    }
  }

  /** Throwing pose when a bacterium is released while he is on screen. */
  throwBacterium(): boolean {
    if (this.state !== 'visible') return false;
    this.setPose(TEXTURES.grumpus.throw, 320);
    this.scene.tweens.add({ targets: this.figure, angle: { from: -8, to: 0 }, duration: 260, ease: 'Back.easeOut' });
    return true;
  }

  /** Dramatic MDR warning: he rushes in, raises both arms and announces the superbug. */
  warnMdr(isFirst: boolean): void {
    this.forcedVisibleMs = 2600;
    if (this.state === 'hidden' || this.state === 'leaving') this.enter(220);
    this.setPose(TEXTURES.grumpus.warn, 1800);
    this.say(isFirst ? 'Meet my SUPERBUG!' : 'Superbug incoming!', 1800);
    this.scene.tweens.add({ targets: this.figure, scale: { from: 1.15, to: 1 }, duration: 300, ease: 'Back.easeOut' });
  }

  say(text: string, durationMs = 1700): void {
    this.bubbleText.setText(text);
    const bg = this.bubble.list[0] as Phaser.GameObjects.Graphics;
    const w = this.bubbleText.width + 28;
    const h = this.bubbleText.height + 16;
    bg.clear();
    bg.fillStyle(0xffffff, 0.95);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
    // Tail pointing right, towards the Grumpus.
    bg.fillTriangle(w / 2 - 2, -8, w / 2 - 2, 8, w / 2 + 16, 2);
    bg.lineStyle(2, 0x0a1426, 1);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
    this.bubble.setVisible(true).setAlpha(1).setX(-w / 2 - 70);
    this.scene.tweens.killTweensOf(this.bubble);
    this.scene.tweens.add({ targets: this.bubble, alpha: 0, delay: durationMs, duration: 250 });
  }

  private setPose(texture: string, durationMs: number): void {
    this.figure.setTexture(texture);
    this.poseTimerMs = durationMs;
  }

  private enter(durationMs = 700): void {
    this.state = 'entering';
    this.scene.tweens.killTweensOf(this.container);
    this.hoverTween?.stop();
    this.scene.tweens.add({
      targets: this.container,
      y: SHOWN_Y,
      duration: durationMs,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.state = 'visible';
        this.stateTimerMs = randomRange(this.rng, 5500, 9000);
        this.hoverTween = this.scene.tweens.add({
          targets: this.container,
          y: SHOWN_Y + 8,
          duration: 900,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      },
    });
  }

  private leave(): void {
    this.state = 'leaving';
    this.hoverTween?.stop();
    this.hoverTween = null;
    this.scene.tweens.add({
      targets: this.container,
      y: HIDDEN_Y,
      duration: 650,
      ease: 'Back.easeIn',
      onComplete: () => {
        this.state = 'hidden';
        this.stateTimerMs = randomRange(this.rng, 6000, 11000);
      },
    });
  }
}
