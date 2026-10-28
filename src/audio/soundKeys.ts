/**
 * Sound effect identifiers. To replace a synthesized effect with a recorded one, add an
 * entry with the same key to `public/assets/asset-manifest.json` under "audio".
 * The background loop uses the key "music".
 */
export type SoundKey =
  | 'jump'
  | 'crouch'
  | 'cookie'
  | 'antibiotic-pickup'
  | 'already-stocked'
  | 'protected'
  | 'stumble'
  | 'delivery'
  | 'mdr-warning'
  | 'torpedo-warning'
  | 'torpedo-impact'
  | 'grumpus-throw'
  | 'defeat'
  | 'ui-move'
  | 'ui-select'
  | 'pause';

export const MUSIC_KEY = 'music';

export interface ToneStep {
  readonly frequency: number;
  readonly endFrequency?: number;
  readonly type: OscillatorType;
  /** Seconds after the effect starts. */
  readonly delay: number;
  readonly duration: number;
  readonly volume: number;
}

/** Original, simple synthesized effects. */
export const SOUND_RECIPES: Readonly<Record<SoundKey, readonly ToneStep[]>> = {
  jump: [{ frequency: 330, endFrequency: 660, type: 'square', delay: 0, duration: 0.12, volume: 0.12 }],
  crouch: [{ frequency: 260, endFrequency: 160, type: 'triangle', delay: 0, duration: 0.1, volume: 0.15 }],
  cookie: [
    { frequency: 880, type: 'triangle', delay: 0, duration: 0.08, volume: 0.18 },
    { frequency: 1320, type: 'triangle', delay: 0.07, duration: 0.12, volume: 0.18 },
  ],
  'antibiotic-pickup': [
    { frequency: 523, type: 'sine', delay: 0, duration: 0.1, volume: 0.2 },
    { frequency: 659, type: 'sine', delay: 0.08, duration: 0.1, volume: 0.2 },
    { frequency: 784, type: 'sine', delay: 0.16, duration: 0.16, volume: 0.2 },
  ],
  'already-stocked': [{ frequency: 440, type: 'sine', delay: 0, duration: 0.08, volume: 0.1 }],
  protected: [
    { frequency: 1046, endFrequency: 523, type: 'triangle', delay: 0, duration: 0.25, volume: 0.22 },
    { frequency: 220, endFrequency: 110, type: 'square', delay: 0, duration: 0.15, volume: 0.08 },
  ],
  stumble: [
    { frequency: 180, endFrequency: 75, type: 'sawtooth', delay: 0, duration: 0.18, volume: 0.2 },
    { frequency: 260, endFrequency: 120, type: 'square', delay: 0.04, duration: 0.14, volume: 0.13 },
  ],
  delivery: [
    { frequency: 784, type: 'triangle', delay: 0, duration: 0.12, volume: 0.18 },
    { frequency: 988, type: 'triangle', delay: 0.1, duration: 0.12, volume: 0.18 },
    { frequency: 1175, type: 'triangle', delay: 0.2, duration: 0.12, volume: 0.18 },
    { frequency: 1568, type: 'triangle', delay: 0.3, duration: 0.3, volume: 0.18 },
  ],
  'mdr-warning': [
    { frequency: 660, endFrequency: 440, type: 'sawtooth', delay: 0, duration: 0.25, volume: 0.09 },
    { frequency: 660, endFrequency: 440, type: 'sawtooth', delay: 0.3, duration: 0.25, volume: 0.09 },
    { frequency: 660, endFrequency: 440, type: 'sawtooth', delay: 0.6, duration: 0.25, volume: 0.09 },
  ],
  'torpedo-warning': [
    { frequency: 880, endFrequency: 560, type: 'sawtooth', delay: 0, duration: 0.18, volume: 0.13 },
    { frequency: 880, endFrequency: 560, type: 'sawtooth', delay: 0.22, duration: 0.18, volume: 0.13 },
  ],
  'torpedo-impact': [
    { frequency: 180, endFrequency: 70, type: 'sawtooth', delay: 0, duration: 0.32, volume: 0.22 },
    { frequency: 130, endFrequency: 55, type: 'square', delay: 0.04, duration: 0.25, volume: 0.15 },
  ],
  'grumpus-throw': [{ frequency: 500, endFrequency: 200, type: 'sine', delay: 0, duration: 0.18, volume: 0.07 }],
  defeat: [
    { frequency: 392, type: 'triangle', delay: 0, duration: 0.18, volume: 0.2 },
    { frequency: 330, type: 'triangle', delay: 0.18, duration: 0.18, volume: 0.2 },
    { frequency: 262, endFrequency: 196, type: 'triangle', delay: 0.36, duration: 0.45, volume: 0.2 },
  ],
  'ui-move': [{ frequency: 660, type: 'sine', delay: 0, duration: 0.05, volume: 0.08 }],
  'ui-select': [
    { frequency: 660, type: 'triangle', delay: 0, duration: 0.07, volume: 0.15 },
    { frequency: 990, type: 'triangle', delay: 0.06, duration: 0.1, volume: 0.15 },
  ],
  pause: [{ frequency: 520, endFrequency: 390, type: 'sine', delay: 0, duration: 0.12, volume: 0.12 }],
};

/** Original eight-bar arpeggio loop (C – Am – F – G), as MIDI note numbers per eighth note. */
const CHORDS: readonly (readonly number[])[] = [
  [60, 64, 67],
  [57, 60, 64],
  [53, 57, 60],
  [55, 59, 62],
];
const ARPEGGIO_ORDER = [0, 1, 2, 1, 0, 2, 1, 2] as const;

export const MUSIC_TEMPO_BPM = 112;
export const MUSIC_STEPS: readonly { readonly melody: number; readonly bass: number | null; readonly bell: boolean }[] =
  CHORDS.flatMap((chord) =>
    ARPEGGIO_ORDER.map((noteIndex, step) => ({
      melody: (chord[noteIndex] ?? 60) + 12,
      bass: step === 0 || step === 4 ? (chord[0] ?? 48) - 12 : null,
      bell: step % 2 === 1,
    })),
  );

export function midiToFrequency(note: number): number {
  return 440 * 2 ** ((note - 69) / 12);
}
