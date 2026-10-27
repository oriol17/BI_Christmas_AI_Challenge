import type Phaser from 'phaser';
import type { BalanceConfig } from '../config/balance';
import { DEPTH, GAME_HEIGHT, GAME_WIDTH } from '../config/layout';
import { COLORS } from '../config/theme';
import { TEXTURES } from '../graphics/textureKeys';
import { displayText } from '../ui/textStyles';
import type { SettingsStore } from './SettingsStore';

/** Particles, floating text, flashes and (conservative) screen shake. */
export class Effects {
  private readonly sparks: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly confetti: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly crumbs: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly flashRect: Phaser.GameObjects.Rectangle;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly settings: SettingsStore,
    private readonly balance: BalanceConfig,
  ) {
    this.sparks = scene.add
      .particles(0, 0, TEXTURES.particles.star, {
        speed: { min: 120, max: 320 },
        angle: { min: 0, max: 360 },
        scale: { start: 0.9, end: 0 },
        lifespan: 600,
        gravityY: 250,
        emitting: false,
      })
      .setDepth(DEPTH.effects);
    this.confetti = scene.add
      .particles(0, 0, TEXTURES.particles.confetti, {
        speed: { min: 180, max: 420 },
        angle: { min: 220, max: 320 },
        rotate: { min: 0, max: 360 },
        scale: { start: 1.1, end: 0.6 },
        lifespan: 1300,
        gravityY: 520,
        tint: [COLORS.christmasRed, COLORS.gold, COLORS.christmasGreen, COLORS.cyan, COLORS.white],
        emitting: false,
      })
      .setDepth(DEPTH.effects);
    this.crumbs = scene.add
      .particles(0, 0, TEXTURES.particles.crumb, {
        speed: { min: 60, max: 180 },
        angle: { min: 0, max: 360 },
        scale: { start: 1, end: 0.2 },
        lifespan: 450,
        gravityY: 400,
        emitting: false,
      })
      .setDepth(DEPTH.effects);
    this.flashRect = scene.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLORS.white, 0)
      .setOrigin(0)
      .setDepth(DEPTH.effects + 5);
  }

  sparkBurst(x: number, y: number, tint: number, count = 14): void {
    this.sparks.particleTint = tint;
    this.sparks.explode(count, x, y);
  }

  confettiBurst(x: number, y: number, count = 40): void {
    this.confetti.explode(count, x, y);
  }

  cookieBurst(x: number, y: number): void {
    this.crumbs.explode(10, x, y);
    this.sparkBurst(x, y, COLORS.gold, 6);
  }

  ring(x: number, y: number, tint: number): void {
    const ring = this.scene.add.image(x, y, TEXTURES.particles.ring).setTint(tint).setDepth(DEPTH.effects).setScale(0.4);
    this.scene.tweens.add({ targets: ring, scale: 2.4, alpha: 0, duration: 420, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
  }

  floatText(x: number, y: number, message: string, color: string, size = 24): void {
    const text = this.scene.add.text(x, y, message, displayText(size, color)).setOrigin(0.5).setDepth(DEPTH.effects + 2);
    this.scene.tweens.add({
      targets: text,
      y: y - 60,
      alpha: { from: 1, to: 0 },
      duration: 900,
      ease: 'Cubic.easeOut',
      onComplete: () => text.destroy(),
    });
  }

  /** Very small camera shake; disabled entirely with the reduced-motion setting. */
  shake(multiplier = 1): void {
    if (this.settings.reducedMotion) return;
    const { screenShakeDurationMs, screenShakeIntensity } = this.balance.effects;
    this.scene.cameras.main.shake(screenShakeDurationMs, screenShakeIntensity * multiplier);
  }

  /** Soft full-screen colour flash (kept faint; skipped with reduced motion). */
  flash(color: number, alpha = 0.25): void {
    if (this.settings.reducedMotion) return;
    this.flashRect.setFillStyle(color, alpha).setAlpha(1);
    this.scene.tweens.killTweensOf(this.flashRect);
    this.scene.tweens.add({ targets: this.flashRect, alpha: 0, duration: 260 });
  }
}
