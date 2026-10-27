import Phaser from 'phaser';
import { GAME_WIDTH } from '../config/layout';
import type { PlayerIntent } from '../entities/Player';

type KeyMap = Record<'space' | 'up' | 'w' | 'down' | 's', Phaser.Input.Keyboard.Key>;

/**
 * Translates keyboard (and optional touch) input into a PlayerIntent.
 * Keys are captured so Space/arrows never scroll the page.
 */
export class PlayerInput {
  private readonly keys: KeyMap | null;
  private touchJumpPressed = false;
  private touchJumpHeld = false;
  private touchCrouchHeld = false;

  constructor(scene: Phaser.Scene) {
    const keyboard = scene.input.keyboard;
    this.keys = keyboard
      ? (keyboard.addKeys(
          {
            space: Phaser.Input.Keyboard.KeyCodes.SPACE,
            up: Phaser.Input.Keyboard.KeyCodes.UP,
            w: Phaser.Input.Keyboard.KeyCodes.W,
            down: Phaser.Input.Keyboard.KeyCodes.DOWN,
            s: Phaser.Input.Keyboard.KeyCodes.S,
          },
          true,
        ) as KeyMap)
      : null;

    // Optional touch support: right half jumps, left half crouches.
    if (scene.sys.game.device.input.touch) {
      scene.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
        if (!pointer.wasTouch) return;
        if (pointer.x >= GAME_WIDTH / 2) {
          this.touchJumpPressed = true;
          this.touchJumpHeld = true;
        } else {
          this.touchCrouchHeld = true;
        }
      });
      scene.input.on(Phaser.Input.Events.POINTER_UP, (pointer: Phaser.Input.Pointer) => {
        if (!pointer.wasTouch) return;
        this.touchJumpHeld = false;
        this.touchCrouchHeld = false;
      });
    }
  }

  read(): PlayerIntent {
    const keys = this.keys;
    const justDown = (key: Phaser.Input.Keyboard.Key): boolean => Phaser.Input.Keyboard.JustDown(key);
    const jumpPressed =
      this.touchJumpPressed || (keys !== null && (justDown(keys.space) || justDown(keys.up) || justDown(keys.w)));
    this.touchJumpPressed = false;
    return {
      jumpPressed,
      jumpHeld: this.touchJumpHeld || (keys !== null && (keys.space.isDown || keys.up.isDown || keys.w.isDown)),
      crouchHeld: this.touchCrouchHeld || (keys !== null && (keys.down.isDown || keys.s.isDown)),
    };
  }

  /** Clears stale key state, e.g. after resuming from pause or regaining focus. */
  reset(): void {
    if (this.keys) for (const key of Object.values(this.keys)) key.reset();
    this.touchJumpPressed = false;
    this.touchJumpHeld = false;
    this.touchCrouchHeld = false;
  }
}
