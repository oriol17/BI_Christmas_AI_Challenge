import Phaser from 'phaser';
import type { SettingsStore } from '../systems/SettingsStore';
import { midiToFrequency, MUSIC_KEY, MUSIC_STEPS, MUSIC_TEMPO_BPM, SOUND_RECIPES, type SoundKey, type ToneStep } from './soundKeys';

const MUSIC_VOLUME = 0.045;
const SCHEDULE_AHEAD_SECONDS = 0.2;
const SCHEDULER_INTERVAL_MS = 60;

/**
 * Plays sound effects and music. Recorded audio declared in the asset manifest is used when
 * available; otherwise short original tones are synthesized with Web Audio. Audio is never
 * required to understand gameplay; everything also has a visual cue.
 */
export class AudioManager {
  private readonly context: AudioContext | null;
  private readonly output: AudioNode | null;
  private readonly unsubscribe: () => void;
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private musicStep = 0;
  private nextNoteTime = 0;
  private externalMusic: Phaser.Sound.BaseSound | null = null;

  constructor(
    private readonly sound: Phaser.Sound.BaseSoundManager,
    private readonly audioCache: Phaser.Cache.BaseCache,
    private readonly settings: SettingsStore,
  ) {
    if (sound instanceof Phaser.Sound.WebAudioSoundManager) {
      this.context = sound.context;
      this.output = sound.destination;
    } else {
      this.context = null;
      this.output = null;
    }
    this.sound.mute = settings.muted;
    this.unsubscribe = settings.onChange((next) => {
      this.sound.mute = next.muted;
    });
  }

  get muted(): boolean {
    return this.settings.muted;
  }

  toggleMute(): boolean {
    this.settings.setMuted(!this.settings.muted);
    return this.settings.muted;
  }

  play(key: SoundKey): void {
    if (this.settings.muted) return;
    if (this.audioCache.exists(key)) {
      this.sound.play(key, { volume: 0.7 });
      return;
    }
    this.synthesize(SOUND_RECIPES[key]);
  }

  startMusic(): void {
    if (this.musicTimer !== null || this.externalMusic) return;
    if (this.audioCache.exists(MUSIC_KEY)) {
      this.externalMusic = this.sound.add(MUSIC_KEY, { loop: true, volume: 0.4 });
      this.externalMusic.play();
      return;
    }
    if (!this.context) return;
    this.musicStep = 0;
    this.nextNoteTime = 0;
    this.musicTimer = setInterval(() => this.scheduleMusic(), SCHEDULER_INTERVAL_MS);
  }

  stopMusic(): void {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    if (this.externalMusic) {
      this.externalMusic.stop();
      this.externalMusic.destroy();
      this.externalMusic = null;
    }
  }

  destroy(): void {
    this.stopMusic();
    this.unsubscribe();
  }

  private isContextRunning(): boolean {
    return this.context !== null && this.output !== null && this.context.state === 'running';
  }

  private synthesize(steps: readonly ToneStep[], when?: number): void {
    if (!this.isContextRunning() || !this.context || !this.output) return;
    const start = when ?? this.context.currentTime;
    for (const step of steps) this.tone(step, start);
  }

  private tone(step: ToneStep, start: number): void {
    const context = this.context;
    const output = this.output;
    if (!context || !output) return;
    const t0 = start + step.delay;
    const t1 = t0 + step.duration;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = step.type;
    oscillator.frequency.setValueAtTime(step.frequency, t0);
    if (step.endFrequency !== undefined) oscillator.frequency.exponentialRampToValueAtTime(step.endFrequency, t1);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(step.volume, t0 + Math.min(0.015, step.duration / 3));
    gain.gain.exponentialRampToValueAtTime(0.0001, t1);
    oscillator.connect(gain);
    gain.connect(output);
    oscillator.start(t0);
    oscillator.stop(t1 + 0.02);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  }

  private scheduleMusic(): void {
    if (!this.isContextRunning() || !this.context) return;
    if (this.settings.muted) {
      this.nextNoteTime = 0;
      return;
    }
    const stepDuration = 60 / MUSIC_TEMPO_BPM / 2;
    const now = this.context.currentTime;
    if (this.nextNoteTime < now) this.nextNoteTime = now + 0.05;
    while (this.nextNoteTime < now + SCHEDULE_AHEAD_SECONDS) {
      const step = MUSIC_STEPS[this.musicStep % MUSIC_STEPS.length];
      if (step) {
        this.tone(
          { frequency: midiToFrequency(step.melody), type: 'triangle', delay: 0, duration: stepDuration * 0.9, volume: MUSIC_VOLUME },
          this.nextNoteTime,
        );
        if (step.bass !== null) {
          this.tone(
            { frequency: midiToFrequency(step.bass), type: 'sine', delay: 0, duration: stepDuration * 3.5, volume: MUSIC_VOLUME * 1.4 },
            this.nextNoteTime,
          );
        }
        if (step.bell) {
          this.tone(
            { frequency: 2637, type: 'sine', delay: 0, duration: 0.05, volume: MUSIC_VOLUME * 0.35 },
            this.nextNoteTime,
          );
        }
      }
      this.musicStep += 1;
      this.nextNoteTime += stepDuration;
    }
  }
}
