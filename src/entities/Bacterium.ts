import Phaser from 'phaser';
import { DEPTH, GAME_WIDTH, HAZARD_HITBOX_RADIUS, hazardLaneY, LAYOUT } from '../config/layout';
import { TEXTURES } from '../graphics/textureKeys';
import type { BacteriumType, HazardLane, Trajectory } from '../types/game';
import { clamp, lerp } from '../utils/math';

/**
 * Pooled bacterium hazard. Its body never moves on its own (`moves = false`); the spawn
 * director scrolls it each frame so collisions stay deterministic. Visual wobble only uses
 * rotation, which does not affect the Arcade hitbox.
 */
export class Bacterium extends Phaser.Physics.Arcade.Sprite {
  bacteriumType: BacteriumType = 'gramPositive';
  lane: HazardLane = 'ground';
  trajectory: Trajectory = 'straight';
  /** Set once Santa has interacted with it, so one bacterium is only resolved once. */
  resolved = false;
  /** Set when it first scrolls on screen (used for Grumpus throw animations). */
  announced = false;
  private laneY = 0;
  private ageSeconds = 0;
  private phase = 0;
  private aura: Phaser.GameObjects.Image | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, TEXTURES.bacteria.gramPositive);
  }

  launch(type: BacteriumType, lane: HazardLane, trajectory: Trajectory, x: number, phase: number): void {
    this.bacteriumType = type;
    this.lane = lane;
    this.trajectory = trajectory;
    this.laneY = hazardLaneY(type, lane);
    this.ageSeconds = 0;
    this.phase = phase;
    this.resolved = false;
    this.announced = false;

    this.setTexture(TEXTURES.bacteria[type]);
    this.enableBody(true, x, this.computeY(x), true, true);
    this.setDepth(DEPTH.hazards).setRotation(0).setAlpha(1).clearTint();

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.moves = false;
    const radius = HAZARD_HITBOX_RADIUS[type];
    body.setCircle(radius, this.width / 2 - radius, this.height / 2 - radius);

    if (type === 'mdr') {
      this.aura ??= this.scene.add.image(x, this.y, TEXTURES.particles.ring).setTint(0xff3b2f);
      this.aura.setVisible(true).setDepth(DEPTH.hazards - 1).setPosition(x, this.y);
    } else {
      this.aura?.setVisible(false);
    }
  }

  advance(dx: number, deltaSeconds: number): void {
    this.ageSeconds += deltaSeconds;
    this.x -= dx;
    this.y = this.computeY(this.x);

    const t = this.ageSeconds + this.phase;
    switch (this.bacteriumType) {
      case 'gramPositive':
        this.rotation = Math.sin(t * 3) * 0.18;
        break;
      case 'gramNegative':
        this.rotation = Math.sin(t * 9) * 0.07;
        break;
      case 'mdr':
        this.rotation += deltaSeconds * 1.6;
        if (this.aura) {
          const pulse = 1.5 + Math.sin(t * 8) * 0.18;
          this.aura.setPosition(this.x, this.y).setScale(pulse).setAlpha(0.55 + Math.sin(t * 8) * 0.25);
        }
        break;
    }
  }

  /** Fades out a bacterium neutralised by an antibiotic. The body is disabled immediately. */
  neutralise(onComplete: () => void): void {
    this.resolved = true;
    (this.body as Phaser.Physics.Arcade.Body).enable = false;
    this.setTintFill(0xffffff);
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      angle: this.angle + 120,
      duration: 220,
      onComplete,
    });
  }

  deactivate(): void {
    this.scene.tweens.killTweensOf(this);
    this.disableBody(true, true);
    this.aura?.setVisible(false);
  }

  override destroy(fromScene?: boolean): void {
    this.aura?.destroy();
    this.aura = null;
    super.destroy(fromScene);
  }

  private computeY(x: number): number {
    switch (this.trajectory) {
      case 'bob':
        return this.laneY + Math.sin((this.ageSeconds + this.phase) * 5) * 4;
      case 'lob': {
        // Falls from the Grumpus's platform height into its lane before reaching mid-screen.
        const start = GAME_WIDTH + 20;
        const progress = clamp((start - x) / (start - LAYOUT.lobSettleX), 0, 1);
        return lerp(LAYOUT.lobStartY, this.laneY, progress * progress);
      }
      default:
        return this.laneY;
    }
  }
}
