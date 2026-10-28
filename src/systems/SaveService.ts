import type { DifficultyMode } from '../config/balance';

/** Minimal subset of the Web Storage API so the service can be tested with fakes. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface PersistedSettings {
  readonly muted: boolean;
  readonly reducedMotion: boolean;
  readonly difficultyMode: DifficultyMode;
  /** First-time gameplay hints; repeat players can turn them off with H. */
  readonly hintsEnabled: boolean;
}

export const DEFAULT_SETTINGS: PersistedSettings = {
  muted: false,
  reducedMotion: false,
  difficultyMode: 'competition',
  hintsEnabled: true,
};

const STORAGE_PREFIX = 'scientist-santa-vs-superbugs';
const BEST_SCORE_KEY = `${STORAGE_PREFIX}:best-score`;
const SETTINGS_KEY = `${STORAGE_PREFIX}:settings`;

class MemoryStorage implements KeyValueStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

/**
 * Persists the best score and settings. Falls back to in-memory storage when
 * localStorage is unavailable (private mode, disabled cookies, sandboxed iframes...).
 */
export class SaveService {
  private storage: KeyValueStorage;
  private readonly memory = new MemoryStorage();

  constructor(storage: KeyValueStorage | null) {
    this.storage = storage ?? this.memory;
  }

  static fromBrowser(): SaveService {
    try {
      const storage = globalThis.localStorage;
      const probe = `${STORAGE_PREFIX}:probe`;
      storage.setItem(probe, '1');
      storage.getItem(probe);
      return new SaveService(storage);
    } catch {
      return new SaveService(null);
    }
  }

  getBestScore(): number {
    const value = Number.parseInt(this.read(BEST_SCORE_KEY) ?? '0', 10);
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  /** Stores the score if it beats the previous best. */
  submitScore(score: number): { best: number; isNewBest: boolean } {
    const previous = this.getBestScore();
    const safeScore = Math.max(0, Math.floor(score));
    if (safeScore > previous) {
      this.write(BEST_SCORE_KEY, String(safeScore));
      return { best: safeScore, isNewBest: true };
    }
    return { best: previous, isNewBest: false };
  }

  loadSettings(): PersistedSettings {
    const raw = this.read(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null) return DEFAULT_SETTINGS;
      const record = parsed as Record<string, unknown>;
      return {
        muted: typeof record.muted === 'boolean' ? record.muted : DEFAULT_SETTINGS.muted,
        reducedMotion: typeof record.reducedMotion === 'boolean' ? record.reducedMotion : DEFAULT_SETTINGS.reducedMotion,
        difficultyMode: record.difficultyMode === 'training' ? 'training' : DEFAULT_SETTINGS.difficultyMode,
        hintsEnabled: typeof record.hintsEnabled === 'boolean' ? record.hintsEnabled : DEFAULT_SETTINGS.hintsEnabled,
      };
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  saveSettings(settings: PersistedSettings): void {
    this.write(SETTINGS_KEY, JSON.stringify(settings));
  }

  private read(key: string): string | null {
    try {
      return this.storage.getItem(key);
    } catch {
      this.storage = this.memory;
      return this.memory.getItem(key);
    }
  }

  private write(key: string, value: string): void {
    try {
      this.storage.setItem(key, value);
    } catch {
      // Quota exceeded or storage revoked mid-session: keep playing with in-memory storage.
      this.storage = this.memory;
      this.memory.setItem(key, value);
    }
  }
}
