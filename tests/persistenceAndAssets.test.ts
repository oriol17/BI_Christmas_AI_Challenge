import { describe, expect, it } from 'vitest';
import { countManifestEntries, parseAssetManifest } from '../src/graphics/assetManifest';
import { SaveService, type KeyValueStorage } from '../src/systems/SaveService';

describe('parseAssetManifest', () => {
  it('returns an empty manifest for invalid input', () => {
    expect(countManifestEntries(parseAssetManifest(undefined))).toBe(0);
    expect(countManifestEntries(parseAssetManifest('nope'))).toBe(0);
    expect(countManifestEntries(parseAssetManifest([]))).toBe(0);
  });

  it('keeps valid entries and drops malformed or unsafe ones', () => {
    const manifest = parseAssetManifest({
      images: {
        'santa-run-0': 'characters/santa-run-0.png',
        'bad-traversal': '../secret.png',
        'bad-url': 'https://example.com/x.png',
        'bad-type': 42,
      },
      spritesheets: {
        'santa-run': { path: 'characters/santa-run.png', frameWidth: 96, frameHeight: 112, frameRate: 14 },
        broken: { path: 'characters/x.png', frameWidth: 0, frameHeight: 112 },
      },
      audio: {
        jump: 'audio/jump.ogg',
        music: ['audio/music.ogg', 'audio/music.mp3'],
        invalid: [],
      },
    });
    expect(Object.keys(manifest.images)).toEqual(['santa-run-0']);
    expect(manifest.spritesheets['santa-run']).toEqual({
      path: 'characters/santa-run.png',
      frameWidth: 96,
      frameHeight: 112,
      frameRate: 14,
    });
    expect(manifest.spritesheets.broken).toBeUndefined();
    expect(Object.keys(manifest.audio).sort()).toEqual(['jump', 'music']);
    expect(countManifestEntries(manifest)).toBe(4);
  });
});

class FakeStorage implements KeyValueStorage {
  readonly values = new Map<string, string>();
  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

class BrokenStorage implements KeyValueStorage {
  getItem(): string | null {
    throw new Error('SecurityError');
  }
  setItem(): void {
    throw new Error('QuotaExceededError');
  }
}

describe('SaveService', () => {
  it('stores only improved best scores', () => {
    const save = new SaveService(new FakeStorage());
    expect(save.getBestScore()).toBe(0);
    expect(save.submitScore(1200)).toEqual({ best: 1200, isNewBest: true });
    expect(save.submitScore(800)).toEqual({ best: 1200, isNewBest: false });
    expect(save.getBestScore()).toBe(1200);
  });

  it('keeps working when localStorage is unavailable', () => {
    const save = new SaveService(null);
    expect(save.submitScore(500).isNewBest).toBe(true);
    expect(save.getBestScore()).toBe(500);
  });

  it('falls back to memory when storage throws', () => {
    const save = new SaveService(new BrokenStorage());
    expect(save.getBestScore()).toBe(0);
    expect(save.submitScore(300)).toEqual({ best: 300, isNewBest: true });
    expect(save.getBestScore()).toBe(300);
    save.saveSettings({ muted: true, reducedMotion: true, difficultyMode: 'training', hintsEnabled: false });
    expect(save.loadSettings()).toEqual({ muted: true, reducedMotion: true, difficultyMode: 'training', hintsEnabled: false });
  });

  it('ignores corrupted saved data', () => {
    const storage = new FakeStorage();
    storage.values.set('scientist-santa-vs-superbugs:best-score', 'not-a-number');
    storage.values.set('scientist-santa-vs-superbugs:settings', '{broken json');
    const save = new SaveService(storage);
    expect(save.getBestScore()).toBe(0);
    expect(save.loadSettings()).toEqual({ muted: false, reducedMotion: false, difficultyMode: 'competition', hintsEnabled: true });
  });

  it('migrates older settings to the Competition default with hints on', () => {
    const storage = new FakeStorage();
    storage.values.set('scientist-santa-vs-superbugs:settings', JSON.stringify({ muted: true, reducedMotion: false }));
    const save = new SaveService(storage);
    expect(save.loadSettings()).toEqual({ muted: true, reducedMotion: false, difficultyMode: 'competition', hintsEnabled: true });
  });
});
