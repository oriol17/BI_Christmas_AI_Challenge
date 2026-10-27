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

  setMuted(muted: boolean): void {
    this.update({ ...this.current, muted });
  }

  setReducedMotion(reducedMotion: boolean): void {
    this.update({ ...this.current, reducedMotion });
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
