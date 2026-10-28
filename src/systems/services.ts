import type Phaser from 'phaser';
import type { AudioManager } from '../audio/AudioManager';
import type { BalanceConfig } from '../config/balance';
import type { SaveService } from './SaveService';
import type { SettingsStore } from './SettingsStore';

/** Long-lived services shared by all scenes. Stored in the game registry, not in globals. */
export interface GameServices {
  readonly getBalance: () => BalanceConfig;
  readonly save: SaveService;
  readonly settings: SettingsStore;
  readonly audio: AudioManager;
}

const SERVICES_KEY = 'game-services';

export function registerServices(game: Phaser.Game, services: GameServices): void {
  game.registry.set(SERVICES_KEY, services);
}

export function getServices(scene: Phaser.Scene): GameServices {
  const services = scene.registry.get(SERVICES_KEY) as GameServices | undefined;
  if (!services) throw new Error('Game services are not registered. Did BootScene run?');
  return services;
}
