import type Phaser from 'phaser';
import { GAME_WIDTH } from '../config/layout';
import { DEPTH } from '../config/layout';
import { COLORS, CSS_COLORS } from '../config/theme';
import { bodyText, displayText } from './textStyles';

interface ToastEntry {
  readonly container: Phaser.GameObjects.Container;
}

const TOP_Y = 150;
const SPACING = 52;
const MAX_VISIBLE = 3;

/** Non-blocking notifications ("Present delivered!", tutorial hints...). */
export class ToastManager {
  private readonly entries: ToastEntry[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  show(message: string, options: { color?: string; accent?: number; durationMs?: number; large?: boolean } = {}): void {
    const { color = CSS_COLORS.white, accent = COLORS.cyan, durationMs = 2200, large = false } = options;
    const text = this.scene.add
      .text(0, 0, message, large ? displayText(30, color) : bodyText(22, color, { fontStyle: 'bold' }))
      .setOrigin(0.5);
    const width = text.width + 44;
    const height = text.height + 18;
    const background = this.scene.add.graphics();
    background.fillStyle(COLORS.labDeep, 0.88);
    background.fillRoundedRect(-width / 2, -height / 2, width, height, 14);
    background.lineStyle(3, accent, 1);
    background.strokeRoundedRect(-width / 2, -height / 2, width, height, 14);

    const container = this.scene.add
      .container(GAME_WIDTH / 2, TOP_Y - 20, [background, text])
      .setDepth(DEPTH.toast)
      .setAlpha(0);
    const entry: ToastEntry = { container };

    if (this.entries.length >= MAX_VISIBLE) this.dismiss(this.entries[0]!);
    this.entries.push(entry);
    this.layout();

    this.scene.tweens.add({ targets: container, alpha: 1, duration: 160 });
    this.scene.time.delayedCall(durationMs, () => this.dismiss(entry));
  }

  clear(): void {
    for (const entry of [...this.entries]) entry.container.destroy();
    this.entries.length = 0;
  }

  private dismiss(entry: ToastEntry): void {
    const index = this.entries.indexOf(entry);
    if (index === -1) return;
    this.entries.splice(index, 1);
    this.scene.tweens.add({
      targets: entry.container,
      alpha: 0,
      y: entry.container.y - 16,
      duration: 220,
      onComplete: () => entry.container.destroy(),
    });
    this.layout();
  }

  private layout(): void {
    this.entries.forEach((entry, index) => {
      this.scene.tweens.add({ targets: entry.container, y: TOP_Y + index * SPACING, duration: 160, ease: 'Sine.easeOut' });
    });
  }
}
