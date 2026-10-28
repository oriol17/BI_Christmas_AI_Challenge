import { describe, expect, it } from 'vitest';
import { COMPETITION_BALANCE, TRAINING_BALANCE } from '../src/config/balance';
import { IntensityWave } from '../src/logic/IntensityWave';

describe('IntensityWave', () => {
  it('cycles preparation → active → surge → breathing and increments the wave', () => {
    const wave = new IntensityWave(COMPETITION_BALANCE, () => 0);
    const phases = COMPETITION_BALANCE.spawning.intensityWave;
    expect(wave.phase).toBe('preparation');
    expect(wave.advance(phases.preparation.min)).toEqual([{ from: 'preparation', to: 'active', wave: 1 }]);
    expect(wave.advance(phases.active.min)).toEqual([{ from: 'active', to: 'surge', wave: 1 }]);
    expect(wave.advance(phases.surge.min)).toEqual([{ from: 'surge', to: 'breathing', wave: 1 }]);
    expect(wave.advance(phases.breathing.min)).toEqual([{ from: 'breathing', to: 'preparation', wave: 2 }]);
    expect(wave.wave).toBe(2);
  });

  it('keeps Competition breathing windows short and Training ones longer', () => {
    const competition = COMPETITION_BALANCE.spawning.intensityWave.breathing;
    expect(competition.min).toBeGreaterThanOrEqual(0.5);
    expect(competition.max).toBeLessThanOrEqual(1.5);
    expect(TRAINING_BALANCE.spawning.intensityWave.breathing.min).toBeGreaterThan(competition.max);
  });

  it('keeps phase durations within the selected preset ranges', () => {
    const wave = new IntensityWave(TRAINING_BALANCE, () => 0.999);
    expect(wave.advance(TRAINING_BALANCE.spawning.intensityWave.preparation.max - 0.01)).toEqual([]);
    expect(wave.advance(0.01)).toHaveLength(1);
    expect(wave.phase).toBe('active');
  });

  it('handles large frame deltas without losing phase transitions', () => {
    const wave = new IntensityWave(COMPETITION_BALANCE, () => 0);
    const transitions = wave.advance(30);
    expect(transitions.length).toBeGreaterThan(4);
    expect(transitions.some(({ to }) => to === 'surge')).toBe(true);
    expect(transitions.some(({ to }) => to === 'breathing')).toBe(true);
  });
});
