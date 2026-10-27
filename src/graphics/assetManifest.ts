/**
 * Optional replacement artwork and audio are declared in `public/assets/asset-manifest.json`.
 * Keys must match the texture keys in `textureKeys.ts` (images/spritesheets) or the sound keys
 * in `audio/soundKeys.ts`. Paths are relative to `public/assets/`.
 */
export interface SpritesheetEntry {
  readonly path: string;
  readonly frameWidth: number;
  readonly frameHeight: number;
  readonly frameRate?: number;
}

export interface AssetManifest {
  readonly images: Readonly<Record<string, string>>;
  readonly spritesheets: Readonly<Record<string, SpritesheetEntry>>;
  readonly audio: Readonly<Record<string, string | readonly string[]>>;
}

export const EMPTY_ASSET_MANIFEST: AssetManifest = { images: {}, spritesheets: {}, audio: {} };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSafeRelativePath(path: unknown): path is string {
  return typeof path === 'string' && path.length > 0 && !path.includes('..') && !/^[a-z]+:/i.test(path);
}

/** Validates untrusted JSON and silently drops malformed entries so the game always boots. */
export function parseAssetManifest(raw: unknown): AssetManifest {
  if (!isRecord(raw)) return EMPTY_ASSET_MANIFEST;

  const images: Record<string, string> = {};
  if (isRecord(raw.images)) {
    for (const [key, path] of Object.entries(raw.images)) {
      if (isSafeRelativePath(path)) images[key] = path;
    }
  }

  const spritesheets: Record<string, SpritesheetEntry> = {};
  if (isRecord(raw.spritesheets)) {
    for (const [key, entry] of Object.entries(raw.spritesheets)) {
      if (!isRecord(entry) || !isSafeRelativePath(entry.path)) continue;
      const { frameWidth, frameHeight, frameRate } = entry;
      if (typeof frameWidth !== 'number' || typeof frameHeight !== 'number' || frameWidth <= 0 || frameHeight <= 0) {
        continue;
      }
      spritesheets[key] = {
        path: entry.path,
        frameWidth,
        frameHeight,
        ...(typeof frameRate === 'number' && frameRate > 0 ? { frameRate } : {}),
      };
    }
  }

  const audio: Record<string, string | readonly string[]> = {};
  if (isRecord(raw.audio)) {
    for (const [key, value] of Object.entries(raw.audio)) {
      if (isSafeRelativePath(value)) audio[key] = value;
      else if (Array.isArray(value) && value.length > 0 && value.every(isSafeRelativePath)) audio[key] = value;
    }
  }

  return { images, spritesheets, audio };
}

export function countManifestEntries(manifest: AssetManifest): number {
  return (
    Object.keys(manifest.images).length + Object.keys(manifest.spritesheets).length + Object.keys(manifest.audio).length
  );
}
