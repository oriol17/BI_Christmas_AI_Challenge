import type { BalanceConfig } from '../config/balance';
import { randomRange, type RandomSource } from '../utils/random';

export type IntensityPhase = 'preparation' | 'active' | 'surge' | 'breathing';

const PHASES: readonly IntensityPhase[] = ['preparation', 'active', 'surge', 'breathing'];

export interface IntensityTransition {
  readonly from: IntensityPhase;
  readonly to: IntensityPhase;
  readonly wave: number;
}

/** Repeating, bounded pressure waves; each duration is sampled once on entry. */
export class IntensityWave {
  private phaseIndex = 0;
  private remainingSeconds: number;
  private waveNumber = 1;

  constructor(
    private readonly balance: BalanceConfig,
    private readonly rng: RandomSource,
  ) {
    this.remainingSeconds = this.rollDuration('preparation');
  }

  get phase(): IntensityPhase {
    return PHASES[this.phaseIndex]!;
  }

  get wave(): number {
    return this.waveNumber;
  }

  advance(deltaSeconds: number): readonly IntensityTransition[] {
    let remaining = Math.max(0, deltaSeconds);
    const transitions: IntensityTransition[] = [];

    while (remaining >= this.remainingSeconds) {
      remaining -= this.remainingSeconds;
      const from = this.phase;
      this.phaseIndex = (this.phaseIndex + 1) % PHASES.length;
      if (this.phaseIndex === 0) this.waveNumber += 1;
      transitions.push({ from, to: this.phase, wave: this.waveNumber });
      this.remainingSeconds = this.rollDuration(this.phase);
    }

    this.remainingSeconds -= remaining;
    return transitions;
  }

  private rollDuration(phase: IntensityPhase): number {
    const range = this.balance.spawning.intensityWave[phase];
    return randomRange(this.rng, range.min, range.max);
  }
}
