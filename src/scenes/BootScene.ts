import Phaser from 'phaser';
import { AudioManager } from '../audio/AudioManager';
import { DEFAULT_BALANCE } from '../config/balance';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/layout';
import { COLORS, CSS_COLORS } from '../config/theme';
import { countManifestEntries, parseAssetManifest, type AssetManifest } from '../graphics/assetManifest';
import { createAnimations, generateProceduralTextures } from '../graphics/generateTextures';
import { SaveService } from '../systems/SaveService';
import { registerServices } from '../systems/services';
import { SettingsStore } from '../systems/SettingsStore';
import { bodyText } from '../ui/textStyles';
import { SCENES } from './sceneKeys';

const MANIFEST_KEY = 'asset-manifest';

/**
 * Loads the optional asset manifest and any replacement assets it lists, then generates
 * procedural placeholders for everything else and registers shared services.
 */
export class BootScene extends Phaser.Scene {
  private statusText!: Phaser.GameObjects.Text;

  constructor() {
    super(SCENES.boot);
  }

  preload(): void {
    this.cameras.main.setBackgroundColor(COLORS.labDeep);
    this.statusText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'Preparing the laboratory…', bodyText(26, CSS_COLORS.cyanSoft))
      .setOrigin(0.5);
    // BASE_URL is "./" in production builds, so assets resolve under any GitHub Pages sub-path.
    this.load.setPath(`${import.meta.env.BASE_URL}assets/`);
    this.load.json(MANIFEST_KEY, 'asset-manifest.json');
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      console.warn(`[assets] Optional asset "${file.key}" could not be loaded; using a placeholder.`);
    });
  }

  create(): void {
    const manifest = parseAssetManifest(this.cache.json.get(MANIFEST_KEY));
    if (countManifestEntries(manifest) === 0) {
      this.finish(manifest);
      return;
    }
    this.statusText.setText('Loading artwork…');
    for (const [key, path] of Object.entries(manifest.images)) this.load.image(key, path);
    for (const [key, entry] of Object.entries(manifest.spritesheets)) {
      this.load.spritesheet(key, entry.path, { frameWidth: entry.frameWidth, frameHeight: entry.frameHeight });
    }
    for (const [key, path] of Object.entries(manifest.audio)) this.load.audio(key, typeof path === 'string' ? path : [...path]);
    this.load.once(Phaser.Loader.Events.COMPLETE, () => this.finish(manifest));
    this.load.start();
  }

  private finish(manifest: AssetManifest): void {
    generateProceduralTextures(this.textures);
    const frameRates: Record<string, number> = {};
    for (const [key, entry] of Object.entries(manifest.spritesheets)) {
      if (entry.frameRate) frameRates[key] = entry.frameRate;
    }
    createAnimations(this.anims, this.textures, frameRates);

    const save = SaveService.fromBrowser();
    const settings = new SettingsStore(save);
    const audio = new AudioManager(this.sound, this.cache.audio, settings);
    registerServices(this.game, { balance: DEFAULT_BALANCE, save, settings, audio });
    this.game.events.once(Phaser.Core.Events.DESTROY, () => audio.destroy());

    this.scene.start(SCENES.menu);
  }
}
