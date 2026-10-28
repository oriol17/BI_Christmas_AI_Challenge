import Phaser from 'phaser';
import { DEPTH, GAME_HEIGHT, GAME_WIDTH, LAYOUT } from '../config/layout';
import { COLORS, CSS_COLORS } from '../config/theme';
import type { DifficultyMode } from '../config/balance';
import { ANIMATIONS, TEXTURES } from '../graphics/textureKeys';
import { ParallaxBackground } from '../systems/ParallaxBackground';
import { getServices } from '../systems/services';
import { MenuList } from '../ui/MenuList';
import { bodyText, displayText } from '../ui/textStyles';
import { SCENES } from './sceneKeys';

export class MenuScene extends Phaser.Scene {
  private background!: ParallaxBackground;
  private leaving = false;

  constructor() {
    super(SCENES.menu);
  }

  create(): void {
    const { audio, settings, save } = getServices(this);
    this.leaving = false;
    this.cameras.main.fadeIn(300, 7, 18, 42);
    this.background = new ParallaxBackground(this);

    const shade = this.add.graphics().setDepth(DEPTH.hud - 1);
    shade.fillGradientStyle(COLORS.night, COLORS.night, COLORS.labDeep, COLORS.labDeep, 0.75, 0.75, 0.35, 0.35);
    shade.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Title
    const title = this.add
      .text(GAME_WIDTH / 2, 92, 'SCIENTIST SANTA', displayText(68, CSS_COLORS.gold, { strokeThickness: 10 }))
      .setOrigin(0.5)
      .setDepth(DEPTH.hud);
    this.add
      .text(GAME_WIDTH / 2, 158, 'vs. the SUPERBUGS', displayText(44, CSS_COLORS.mdr, { strokeThickness: 8 }))
      .setOrigin(0.5)
      .setDepth(DEPTH.hud);
    this.add
      .text(GAME_WIDTH / 2, 204, 'A Christmas Eve dash through the pharmaceutical lab', bodyText(20, CSS_COLORS.cyanSoft))
      .setOrigin(0.5)
      .setDepth(DEPTH.hud);
    if (!settings.reducedMotion) {
      this.tweens.add({ targets: title, scale: 1.03, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    // Characters
    this.add
      .sprite(200, LAYOUT.groundY, TEXTURES.santa.run[0])
      .setOrigin(0.5, 1)
      .setScale(1.6)
      .setDepth(DEPTH.hud)
      .play(ANIMATIONS.santaRun);
    const grumpus = this.add.container(1090, 330, [
      this.add.image(0, 70, TEXTURES.grumpus.platform),
      this.add.image(0, 58, TEXTURES.grumpus.idle).setOrigin(0.5, 1),
    ]);
    grumpus.setDepth(DEPTH.hud).setScale(1.3);
    this.tweens.add({ targets: grumpus, y: 342, duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    ([['gramPositive', 980, 470], ['gramNegative', 1100, 500], ['mdr', 1210, 450]] as const).forEach(([type, x, y], index) => {
      const bug = this.add.image(x, y, TEXTURES.bacteria[type]).setDepth(DEPTH.hud);
      this.tweens.add({ targets: bug, y: y - 14, angle: 10, duration: 900 + index * 150, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });

    // Menu
    const menu = new MenuList(
      this,
      GAME_WIDTH / 2,
      302,
      [
        { label: 'Start Game', onSelect: () => this.goTo(SCENES.intro) },
        { label: 'How to Play', onSelect: () => this.goTo(SCENES.howToPlay) },
        {
          label: this.difficultyLabel(settings.difficultyMode),
          onSelect: () => {
            const nextMode = settings.difficultyMode === 'competition' ? 'training' : 'competition';
            settings.setDifficultyMode(nextMode);
            menu.setLabel(2, this.difficultyLabel(nextMode));
          },
        },
        { label: this.soundLabel(settings.muted), onSelect: () => menu.setLabel(3, this.soundLabel(audio.toggleMute())) },
        {
          label: this.motionLabel(settings.reducedMotion),
          onSelect: () => {
            settings.setReducedMotion(!settings.reducedMotion);
            menu.setLabel(4, this.motionLabel(settings.reducedMotion));
          },
        },
      ],
      audio,
      { spacing: 49 },
    );
    menu.buttons.forEach((button) => button.setDepth(DEPTH.hud));

    const best = save.getBestScore();
    this.add
      .text(GAME_WIDTH / 2, 572, best > 0 ? `Best score: ${best.toLocaleString('en-US')}` : 'No best score yet. Make history!', bodyText(20, CSS_COLORS.gold, { fontStyle: 'bold' }))
      .setOrigin(0.5)
      .setDepth(DEPTH.hud);
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 30, '↑ / ↓ to choose · ENTER or SPACE to select · mouse works too', bodyText(17, CSS_COLORS.grey))
      .setOrigin(0.5)
      .setDepth(DEPTH.hud);

    audio.startMusic();
  }

  override update(_time: number, delta: number): void {
    this.background.update(delta * 0.08, delta / 1000);
  }

  private soundLabel(muted: boolean): string {
    return `Sound: ${muted ? 'Off' : 'On'}`;
  }

  private difficultyLabel(mode: DifficultyMode): string {
    return `Difficulty: ${mode === 'competition' ? 'Competition' : 'Training'}`;
  }

  private motionLabel(reduced: boolean): string {
    return `Screen Shake: ${reduced ? 'Off' : 'Gentle'}`;
  }

  private goTo(scene: string): void {
    if (this.leaving) return;
    this.leaving = true;
    this.cameras.main.fadeOut(250, 7, 18, 42);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(scene));
  }
}
