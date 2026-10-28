import type { DifficultyMode } from '../config/balance';
import type { PersistedSettings, SaveService } from './SaveService';

type Listener = (settings: PersistedSettings) => void;

/** Player preferences (mute, reduced motion) with persistence and change notifications. */
export class SettingsStore {
  private current: PersistedSettings;
  private readonly listeners = new Set<Listener>();

  constructor(private readonly save: SaveService) {
    this.current = save.loadSettings();
  }

  get muted(): boolean {
    return this.current.muted;
  }

  get reducedMotion(): boolean {
    return this.current.reducedMotion;
  }

  get difficultyMode(): DifficultyMode {
    return this.current.difficultyMode;
  }

  get hintsEnabled(): boolean {
    return this.current.hintsEnabled;
  }

  setHintsEnabled(hintsEnabled: boolean): void {
    this.update({ ...this.current, hintsEnabled });
  }

  setMuted(muted: boolean): void {
    this.update({ ...this.current, muted });
  }

  setReducedMotion(reducedMotion: boolean): void {
    this.update({ ...this.current, reducedMotion });
  }

  setDifficultyMode(difficultyMode: DifficultyMode): void {
    this.update({ ...this.current, difficultyMode });
  }

  /** Returns an unsubscribe function; scenes must call it on shutdown. */
  onChange(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private update(next: PersistedSettings): void {
    this.current = next;
    this.save.saveSettings(next);
    for (const listener of this.listeners) listener(next);
  }
}
