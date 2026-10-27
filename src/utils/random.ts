/** Returns a float in [0, 1). Injected everywhere randomness is needed so logic stays testable. */
export type RandomSource = () => number;

/** Small deterministic PRNG (mulberry32) used for reproducible tests and seeded runs. */
export function createSeededRandom(seed: number): RandomSource {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomRange(rng: RandomSource, min: number, max: number): number {
  return min + (max - min) * rng();
}

export function randomInt(rng: RandomSource, minInclusive: number, maxInclusive: number): number {
  return Math.floor(randomRange(rng, minInclusive, maxInclusive + 1));
}

export function pickRandom<T>(rng: RandomSource, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pickRandom requires at least one item');
  const index = Math.min(items.length - 1, Math.floor(rng() * items.length));
  return items[index] as T;
}

export function pickWeighted<T>(rng: RandomSource, entries: readonly { value: T; weight: number }[]): T {
  const total = entries.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
  if (total <= 0) throw new Error('pickWeighted requires a positive total weight');
  let roll = rng() * total;
  for (const entry of entries) {
    roll -= Math.max(0, entry.weight);
    if (roll < 0) return entry.value;
  }
  return entries[entries.length - 1]!.value;
}
