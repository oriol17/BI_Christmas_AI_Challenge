import Phaser from 'phaser';
import type { AudioManager } from '../audio/AudioManager';
import { MenuButton } from './MenuButton';

export interface MenuItem {
  readonly label: string;
  readonly onSelect: () => void;
}

export interface MenuListOptions {
  /** Distance between button centres. */
  readonly spacing?: number;
  readonly buttonWidth?: number;
  /** Lay buttons out left-to-right and navigate with Left/Right instead of Up/Down. */
  readonly horizontal?: boolean;
}

/**
 * List of MenuButtons with keyboard navigation (arrows or W/A/S/D) and Enter/Space activation.
 * Only the focused button reacts to Enter. Listeners are removed when the scene shuts down.
 */
export class MenuList {
  readonly buttons: MenuButton[];
  private index = 0;
  private enabled = true;
  private readonly horizontal: boolean;

  constructor(
    private readonly scene: Phaser.Scene,
    x: number,
    y: number,
    items: readonly MenuItem[],
    private readonly audio: AudioManager,
    options: MenuListOptions = {},
  ) {
    const { spacing = 66, buttonWidth = 340, horizontal = false } = options;
    this.horizontal = horizontal;
    this.buttons = items.map((item, i) => {
      const bx = horizontal ? x + i * spacing : x;
      const by = horizontal ? y : y + i * spacing;
      const button = new MenuButton(scene, bx, by, item.label, () => this.select(i, item.onSelect), buttonWidth);
      button.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => this.focus(i, true));
      button.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
        this.focus(i, false);
        button.activate();
      });
      return button;
    });
    this.buttons[0]?.setFocused(true);

    const keyboard = scene.input.keyboard;
    if (keyboard) {
      const handler = (event: KeyboardEvent): void => this.onKey(event);
      keyboard.on('keydown', handler);
      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => keyboard.off('keydown', handler));
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  setLabel(index: number, label: string): void {
    this.buttons[index]?.setLabel(label);
  }

  private onKey(event: KeyboardEvent): void {
    if (!this.enabled || !this.scene.sys.isActive()) return;
    const previous = this.horizontal ? ['ArrowLeft', 'KeyA'] : ['ArrowUp', 'KeyW'];
    const next = this.horizontal ? ['ArrowRight', 'KeyD'] : ['ArrowDown', 'KeyS'];
    const count = this.buttons.length;
    if (previous.includes(event.code)) {
      this.focus((this.index - 1 + count) % count, true);
    } else if (next.includes(event.code)) {
      this.focus((this.index + 1) % count, true);
    } else if (event.code === 'Enter' || event.code === 'NumpadEnter' || event.code === 'Space') {
      this.buttons[this.index]?.activate();
    }
  }

  private focus(index: number, withSound: boolean): void {
    if (index === this.index) return;
    this.buttons[this.index]?.setFocused(false);
    this.index = index;
    this.buttons[this.index]?.setFocused(true);
    if (withSound) this.audio.play('ui-move');
  }

  private select(index: number, onSelect: () => void): void {
    if (!this.enabled) return;
    this.index = index;
    this.audio.play('ui-select');
    onSelect();
  }
}
