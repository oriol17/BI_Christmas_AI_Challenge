import Phaser from 'phaser';
import { DEPTH, GAME_WIDTH, LAYOUT } from '../config/layout';
import { TEXTURES } from '../graphics/textureKeys';
import type { PlatformLevel, TorpedoLane } from '../types/game';

export class VirusTorpedo extends Phaser.Physics.Arcade.Sprite {
  lane: TorpedoLane = 'low';
  platformLevel: PlatformLevel = 0;
  resolved = false;
  warningShown = false;
  private relativeSpeed = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, TEXTURES.hazards.virusTorpedo);
  }

  launch(
    lane: TorpedoLane,
    platformLevel: PlatformLevel,
    x: number,
    y: number,
    relativeSpeed: number,
    hitboxWidth: number,
    hitboxHeight: number,
  ): void {
    this.lane = lane;
    this.platformLevel = platformLevel;
    this.resolved = false;
    this.warningShown = false;
    this.relativeSpeed = relativeSpeed;
    this.enableBody(true, x, y, true, true);
    this.setDepth(DEPTH.hazards + 2).setRotation(0).setAlpha(1).clearTint();

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.moves = false;
    body.setSize(hitboxWidth, hitboxHeight, true);
  }

  advance(deltaSeconds: number, currentWorldSpeed: number): void {
    this.x -= (this.relativeSpeed + currentWorldSpeed) * deltaSeconds;
    this.rotation = Math.sin((GAME_WIDTH - this.x) / 42) * 0.035;
  }

  timeToImpact(currentWorldSpeed: number): number {
    return Math.max(0, (this.x - LAYOUT.playerX) / (this.relativeSpeed + currentWorldSpeed));
  }

  deactivate(): void {
    this.disableBody(true, true);
    this.rotation = 0;
  }
}
