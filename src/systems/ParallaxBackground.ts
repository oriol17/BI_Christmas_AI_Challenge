import type Phaser from 'phaser';
import { DEPTH, GAME_HEIGHT, GAME_WIDTH, LAYOUT } from '../config/layout';
import { TEXTURES } from '../graphics/textureKeys';

interface Layer {
  readonly sprite: Phaser.GameObjects.TileSprite;
  readonly factor: number;
  readonly fallSpeed: number;
}

/** Layered scrolling laboratory: night sky → snow → wall with windows → equipment → benches → floor. */
export class ParallaxBackground {
  private readonly layers: Layer[];

  constructor(scene: Phaser.Scene) {
    const env = TEXTURES.environment;
    const wallHeight: number = LAYOUT.groundY;
    const make = (key: string, factor: number, depth: number, fallSpeed = 0, y = 0, height: number = wallHeight): Layer => ({
      sprite: scene.add.tileSprite(0, y, GAME_WIDTH, height, key).setOrigin(0, 0).setDepth(depth),
      factor,
      fallSpeed,
    });

    this.layers = [
      make(env.night, 0.03, DEPTH.backgroundFar),
      make(env.snow, 0.08, DEPTH.backgroundFar + 1, 40),
      make(env.wall, 0.2, DEPTH.backgroundWall),
      make(env.equipment, 0.42, DEPTH.backgroundEquipment),
      make(env.benches, 0.72, DEPTH.backgroundBenches),
      make(env.floor, 1, DEPTH.floor, 0, LAYOUT.groundY, GAME_HEIGHT - LAYOUT.groundY),
    ];
    // Slightly darken deeper layers so gameplay objects keep the strongest contrast.
    this.layers[3]?.sprite.setTint(0xa9bbd0);
    this.layers[4]?.sprite.setTint(0xb7c7d8);
  }

  update(scrollPx: number, deltaSeconds: number): void {
    for (const layer of this.layers) {
      layer.sprite.tilePositionX += scrollPx * layer.factor;
      if (layer.fallSpeed) layer.sprite.tilePositionY -= layer.fallSpeed * deltaSeconds;
    }
  }
}
