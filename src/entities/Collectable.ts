import Phaser from 'phaser';
import { COLLECTABLE_HITBOX_RADIUS, COLLECTABLE_LANE_Y, DEPTH } from '../config/layout';
import { TEXTURES } from '../graphics/textureKeys';
import type { AntibioticType, CollectableLane } from '../types/game';

export type CollectableKind = 'cookie' | 'antibiotic';

/** Pooled cookie or antibiotic pickup, scrolled by the spawn director. */
export class Collectable extends Phaser.Physics.Arcade.Sprite {
  kind: CollectableKind = 'cookie';
  antibiotic: AntibioticType | null = null;
  collected = false;
  /** Prevents repeating the "Already stocked" hint every frame while Santa overlaps it. */
  hintShown = false;
  private baseY = 0;
  private ageSeconds = 0;
  private phase = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, TEXTURES.cookie);
  }

  launch(
    kind: CollectableKind,
    lane: CollectableLane,
    x: number,
    antibiotic: AntibioticType | null,
    phase: number,
    raisePixels = 0,
  ): void {
    this.kind = kind;
    this.antibiotic = antibiotic;
    this.collected = false;
    this.hintShown = false;
    this.baseY = COLLECTABLE_LANE_Y[lane] - raisePixels;
    this.ageSeconds = 0;
    this.phase = phase;

    this.setTexture(kind === 'antibiotic' && antibiotic ? TEXTURES.antibiotics[antibiotic] : TEXTURES.cookie);
    this.enableBody(true, x, this.baseY, true, true);
    this.setDepth(DEPTH.collectables).setAlpha(1).setRotation(0).clearTint();

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.moves = false;
    const r = COLLECTABLE_HITBOX_RADIUS;
    body.setCircle(r, this.width / 2 - r, this.height / 2 - r);
  }

  advance(dx: number, deltaSeconds: number): void {
    this.ageSeconds += deltaSeconds;
    this.x -= dx;
    const t = this.ageSeconds + this.phase;
    this.y = this.baseY + Math.sin(t * 4) * 4;
    this.rotation = this.kind === 'cookie' ? Math.sin(t * 3) * 0.15 : Math.sin(t * 2) * 0.08;
  }

  /** Marks the pickup as collected and flies it towards a target (e.g. a HUD slot). */
  collect(target: Phaser.Math.Vector2 | null, onComplete: () => void): void {
    this.collected = true;
    (this.body as Phaser.Physics.Arcade.Body).enable = false;
    this.setDepth(DEPTH.hud + 1);
    this.scene.tweens.add({
      targets: this,
      x: target?.x ?? this.x,
      y: target?.y ?? this.y - 60,
      alpha: target ? 0.9 : 0,
      scale: target ? 0.6 : 1.4,
      duration: target ? 420 : 220,
      ease: 'Cubic.easeIn',
      onComplete,
    });
  }

  deactivate(): void {
    this.scene.tweens.killTweensOf(this);
    this.setScale(1);
    this.disableBody(true, true);
  }
}
