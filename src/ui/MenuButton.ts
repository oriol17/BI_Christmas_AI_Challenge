import Phaser from 'phaser';
import { COLORS, CSS_COLORS } from '../config/theme';
import { bodyText } from './textStyles';

const HEIGHT = 54;

/** A keyboard- and mouse-friendly button with a clearly visible focus state. */
export class MenuButton extends Phaser.GameObjects.Container {
  private readonly background: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private readonly marker: Phaser.GameObjects.Text;
  private focused = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    text: string,
    private readonly onActivate: () => void,
    private readonly buttonWidth = 340,
  ) {
    super(scene, x, y);
    this.background = scene.add.graphics();
    this.label = scene.add.text(0, 0, text, bodyText(24, CSS_COLORS.white, { fontStyle: 'bold' })).setOrigin(0.5);
    this.marker = scene.add.text(-buttonWidth / 2 + 22, 0, '▶', bodyText(20, CSS_COLORS.gold)).setOrigin(0.5);
    this.add([this.background, this.label, this.marker]);
    this.setSize(buttonWidth, HEIGHT);
    this.setInteractive({ useHandCursor: true });
    this.redraw();
    scene.add.existing(this);
  }

  get isFocused(): boolean {
    return this.focused;
  }

  setLabel(text: string): this {
    this.label.setText(text);
    return this;
  }

  setFocused(focused: boolean): this {
    if (this.focused === focused) return this;
    this.focused = focused;
    this.redraw();
    this.scene.tweens.add({ targets: this, scale: focused ? 1.04 : 1, duration: 110, ease: 'Sine.easeOut' });
    return this;
  }

  activate(): void {
    this.scene.tweens.add({ targets: this, scale: 0.96, duration: 60, yoyo: true });
    this.onActivate();
  }

  private redraw(): void {
    const w = this.buttonWidth;
    this.background.clear();
    this.background.fillStyle(this.focused ? COLORS.christmasRed : COLORS.labBlue, this.focused ? 1 : 0.92);
    this.background.fillRoundedRect(-w / 2, -HEIGHT / 2, w, HEIGHT, 14);
    this.background.lineStyle(this.focused ? 4 : 2, this.focused ? COLORS.gold : COLORS.cyan, 1);
    this.background.strokeRoundedRect(-w / 2, -HEIGHT / 2, w, HEIGHT, 14);
    this.marker.setVisible(this.focused);
  }
}
