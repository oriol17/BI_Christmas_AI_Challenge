import type Phaser from 'phaser';
import { generateEntityTextures } from './entityArt';
import { generateEnvironmentTextures } from './environmentArt';
import { generateGrumpusTextures } from './grumpusArt';
import { generateSantaTextures } from './santaArt';
import { ANIMATIONS, TEXTURES } from './textureKeys';

/** Generates every procedural placeholder that was not replaced by a loaded asset. */
export function generateProceduralTextures(textures: Phaser.Textures.TextureManager): void {
  generateEnvironmentTextures(textures);
  generateSantaTextures(textures);
  generateGrumpusTextures(textures);
  generateEntityTextures(textures);
}

/**
 * Builds animations. A sprite sheet loaded under the animation key (e.g. "santa-run")
 * takes priority; otherwise the individual procedural frames are used.
 */
export function createAnimations(anims: Phaser.Animations.AnimationManager, textures: Phaser.Textures.TextureManager, frameRates: Readonly<Record<string, number>>): void {
  if (anims.exists(ANIMATIONS.santaRun)) return;
  if (textures.exists(ANIMATIONS.santaRun)) {
    anims.create({
      key: ANIMATIONS.santaRun,
      frames: anims.generateFrameNumbers(ANIMATIONS.santaRun),
      frameRate: frameRates[ANIMATIONS.santaRun] ?? 12,
      repeat: -1,
    });
    return;
  }
  anims.create({
    key: ANIMATIONS.santaRun,
    frames: TEXTURES.santa.run.map((key) => ({ key })),
    frameRate: 12,
    repeat: -1,
  });
}
