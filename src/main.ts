import Phaser from 'phaser';
import './style.css';
import { GAME_HEIGHT, GAME_WIDTH } from './config/layout';
import { BootScene } from './scenes/BootScene';
import { GameOverScene } from './scenes/GameOverScene';
import { GameScene } from './scenes/GameScene';
import { HowToPlayScene } from './scenes/HowToPlayScene';
import { IntroScene } from './scenes/IntroScene';
import { MenuScene } from './scenes/MenuScene';
import { PauseScene } from './scenes/PauseScene';

/**
 * Keys that must never scroll the page. Phaser's global capture calls preventDefault *after*
 * it has processed the key; a separate early window listener would make Phaser ignore the
 * event, because Phaser skips events that are already defaultPrevented.
 */
const CAPTURED_KEYS = [
  Phaser.Input.Keyboard.KeyCodes.SPACE,
  Phaser.Input.Keyboard.KeyCodes.UP,
  Phaser.Input.Keyboard.KeyCodes.DOWN,
  Phaser.Input.Keyboard.KeyCodes.LEFT,
  Phaser.Input.Keyboard.KeyCodes.RIGHT,
  Phaser.Input.Keyboard.KeyCodes.PAGE_UP,
  Phaser.Input.Keyboard.KeyCodes.PAGE_DOWN,
];

function createGame(): Phaser.Game {
  const params = new URLSearchParams(window.location.search);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#0b1a2e',
    title: 'Scientist Santa vs. the Superbugs',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
    },
    input: {
      keyboard: { capture: CAPTURED_KEYS },
    },
    physics: {
      default: 'arcade',
      arcade: { gravity: { x: 0, y: 0 }, debug: params.has('hitboxes') },
    },
    render: { antialias: true, pixelArt: false },
    fps: { target: 60, smoothStep: true },
    disableContextMenu: true,
    scene: [BootScene, MenuScene, HowToPlayScene, IntroScene, GameScene, PauseScene, GameOverScene],
  });
  // `?debug` exposes the game instance for manual inspection in the browser console.
  if (params.has('debug')) Object.assign(window, { santaGame: game });
  return game;
}

createGame();
