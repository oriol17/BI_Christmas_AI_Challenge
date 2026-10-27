import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/layout';
import { COLORS, CSS_COLORS } from '../config/theme';
import { getServices } from '../systems/services';
import { MenuList } from '../ui/MenuList';
import { bodyText, displayText } from '../ui/textStyles';
import { onEscapeKey } from '../utils/escapeKey';
import { SCENES } from './sceneKeys';

/** Overlay shown on top of the paused GameScene. */
export class PauseScene extends Phaser.Scene {
  private closing = false;

  constructor() {
    super(SCENES.pause);
  }

  create(): void {
    const { audio, settings } = getServices(this);
    this.closing = false;

    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLORS.night, 0.72).setOrigin(0);
    const panel = this.add.graphics();
    panel.fillStyle(COLORS.labDeep, 0.95);
    panel.fillRoundedRect(GAME_WIDTH / 2 - 240, 110, 480, 500, 22);
    panel.lineStyle(3, COLORS.cyan, 1);
    panel.strokeRoundedRect(GAME_WIDTH / 2 - 240, 110, 480, 500, 22);

    this.add.text(GAME_WIDTH / 2, 160, 'PAUSED', displayText(48, CSS_COLORS.gold)).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, 206, 'Santa is catching his breath…', bodyText(18, CSS_COLORS.cyanSoft)).setOrigin(0.5);

    const soundLabel = (): string => `Sound: ${settings.muted ? 'Off' : 'On'}`;
    const motionLabel = (): string => `Screen Shake: ${settings.reducedMotion ? 'Off' : 'Gentle'}`;
    const menu = new MenuList(
      this,
      GAME_WIDTH / 2,
      260,
      [
        { label: 'Resume', onSelect: () => this.resumeGame() },
        { label: 'Restart Run', onSelect: () => this.leaveTo(SCENES.game) },
        {
          label: soundLabel(),
          onSelect: () => {
            audio.toggleMute();
            menu.setLabel(2, soundLabel());
          },
        },
        {
          label: motionLabel(),
          onSelect: () => {
            settings.setReducedMotion(!settings.reducedMotion);
            menu.setLabel(3, motionLabel());
          },
        },
        { label: 'Main Menu', onSelect: () => this.leaveTo(SCENES.menu) },
      ],
      audio,
    );

    this.add.text(GAME_WIDTH / 2, 588, 'ESC to resume', bodyText(16, CSS_COLORS.grey)).setOrigin(0.5);
    onEscapeKey(this, () => this.resumeGame());
    this.input.keyboard?.on('keydown-P', () => this.resumeGame());
  }

  private resumeGame(): void {
    if (this.closing) return;
    this.closing = true;
    this.scene.resume(SCENES.game);
    this.scene.stop();
  }

  private leaveTo(scene: string): void {
    if (this.closing) return;
    this.closing = true;
    this.scene.stop(SCENES.game);
    this.scene.start(scene);
  }
}
