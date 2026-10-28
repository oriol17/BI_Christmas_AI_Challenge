import { describe, expect, it } from 'vitest';
import {
  COMPETITION_BALANCE,
  DEFAULT_BALANCE,
  TRAINING_BALANCE,
  type BalanceConfig,
} from '../src/config/balance';
import { getDifficulty, getMinimumReactionWindowSeconds, getWorldSpeed } from '../src/logic/difficulty';
import { RunState } from '../src/logic/RunState';
import { calculateScore, calculateScoreBreakdown, countCheckpointsCrossed, nextCheckpointDistance } from '../src/logic/scoring';

describe('scoring', () => {
  it('combines distance, cookies and deliveries using configured values', () => {
    expect(calculateScore({ distanceMeters: 1234.9, cookies: 3, presents: 2 }, DEFAULT_BALANCE)).toBe(1234 + 300 + 1000);
  });

  it('respects custom scoring configuration', () => {
    const balance: BalanceConfig = {
      ...DEFAULT_BALANCE,
      scoring: { pointsPerMeter: 2 },
      cookies: { ...DEFAULT_BALANCE.cookies, score: 50 },
      deliveries: { ...DEFAULT_BALANCE.deliveries, score: 1000 },
    };
    expect(calculateScoreBreakdown({ distanceMeters: 100, cookies: 2, presents: 1 }, balance)).toEqual({
      distancePoints: 200,
      cookiePoints: 100,
      deliveryPoints: 1000,
      total: 1300,
    });
  });

  it('never produces negative scores', () => {
    expect(calculateScore({ distanceMeters: -50, cookies: -1, presents: -1 }, DEFAULT_BALANCE)).toBe(0);
  });
});

describe('delivery checkpoints', () => {
  it('counts crossed checkpoints', () => {
    expect(countCheckpointsCrossed(0, 499.9, 500)).toBe(0);
    expect(countCheckpointsCrossed(499.9, 500, 500)).toBe(1);
    expect(countCheckpointsCrossed(500, 500.1, 500)).toBe(0);
    expect(countCheckpointsCrossed(10, 1600, 500)).toBe(3);
    expect(countCheckpointsCrossed(600, 400, 500)).toBe(0);
  });

  it('computes the next checkpoint ahead', () => {
    expect(nextCheckpointDistance(0, 500)).toBe(500);
    expect(nextCheckpointDistance(500, 500)).toBe(1000);
    expect(nextCheckpointDistance(999.99, 500)).toBe(1000);
  });
});

describe('RunState', () => {
  it('delivers presents at checkpoints and awards the delivery bonus', () => {
    const run = new RunState(DEFAULT_BALANCE);
    let delivered = 0;
    for (let step = 0; step < 1000; step += 1) delivered += run.advance(1.05).deliveries;
    expect(run.distanceMeters).toBeCloseTo(1050);
    expect(delivered).toBe(2);
    expect(run.presents).toBe(2);
    expect(run.score).toBe(Math.floor(run.distanceMeters) + 2 * DEFAULT_BALANCE.deliveries.score);
  });

  it('awards cookie points and tracks cookies', () => {
    const run = new RunState(DEFAULT_BALANCE);
    expect(run.collectCookie()).toBe(100);
    run.collectCookie();
    expect(run.cookies).toBe(2);
    expect(run.score).toBe(200);
  });

  it('deducts a configured score penalty when an antibiotic absorbs a collision', () => {
    const run = new RunState(DEFAULT_BALANCE);
    run.advance(200);
    expect(run.resolveContact('gramPositive', false)).toEqual({
      kind: 'protected',
      antibiotic: 'gramPositive',
    });
    expect(run.score).toBe(200 - DEFAULT_BALANCE.collision.protectedCollisionPenalty);
    run.reset();
    expect(run.score).toBe(0);
  });

  it('records the defeat cause and freezes progress', () => {
    const run = new RunState(DEFAULT_BALANCE);
    run.advance(10);
    expect(run.resolveContact('mdr', false)).toEqual({ kind: 'defeated', cause: 'mdr' });
    expect(run.defeatCause).toBe('mdr');
    expect(run.advance(100).deliveries).toBe(0);
    expect(run.distanceMeters).toBe(10);
    expect(run.resolveContact('gramPositive', false)).toEqual({ kind: 'ignored' });
  });

  it('reset restores a clean run', () => {
    const run = new RunState(DEFAULT_BALANCE);
    run.advance(700);
    run.collectCookie();
    run.resolveContact('gramPositive', false);
    run.resolveContact('gramPositive', false);
    run.reset();
    expect(run.distanceMeters).toBe(0);
    expect(run.cookies).toBe(0);
    expect(run.presents).toBe(0);
    expect(run.defeatCause).toBeNull();
    expect(run.inventory.snapshot()).toEqual({ gramPositive: 1, gramNegative: 1 });
  });
});

describe('difficulty', () => {
  it('starts at the initial speed and clamps at the maximum', () => {
    expect(getWorldSpeed(0, DEFAULT_BALANCE)).toBe(DEFAULT_BALANCE.world.initialWorldSpeed);
    expect(getWorldSpeed(1100, DEFAULT_BALANCE)).toBe(DEFAULT_BALANCE.world.maxWorldSpeed);
    expect(getWorldSpeed(1_000_000, DEFAULT_BALANCE)).toBe(DEFAULT_BALANCE.world.maxWorldSpeed);
    expect(getWorldSpeed(-100, DEFAULT_BALANCE)).toBe(DEFAULT_BALANCE.world.initialWorldSpeed);
  });

  it('increases monotonically and never exceeds the configured cap', () => {
    let previous = getDifficulty(0, DEFAULT_BALANCE);
    for (let distance = 0; distance <= 20000; distance += 25) {
      const current = getDifficulty(distance, DEFAULT_BALANCE);
      expect(current.worldSpeed).toBeGreaterThanOrEqual(previous.worldSpeed);
      expect(current.spawnIntervalSeconds).toBeLessThanOrEqual(previous.spawnIntervalSeconds);
      expect(current.worldSpeed).toBeLessThanOrEqual(DEFAULT_BALANCE.world.maxWorldSpeed);
      expect(current.level).toBeGreaterThanOrEqual(0);
      expect(current.level).toBeLessThanOrEqual(1);
      expect(current.spawnIntervalSeconds).toBeGreaterThanOrEqual(DEFAULT_BALANCE.spawning.minSpawnIntervalSeconds);
      expect(current.mdrProbability).toBeLessThanOrEqual(DEFAULT_BALANCE.mdr.maxProbability);
      previous = current;
    }
    expect(previous.level).toBe(1);
  });

  it('keeps MDR locked during the forgiving opening section', () => {
    const early = getDifficulty(DEFAULT_BALANCE.mdr.unlockDistance - 1, DEFAULT_BALANCE);
    expect(early.mdrUnlocked).toBe(false);
    expect(early.mdrProbability).toBe(0);
    const later = getDifficulty(DEFAULT_BALANCE.mdr.unlockDistance, DEFAULT_BALANCE);
    expect(later.mdrUnlocked).toBe(true);
    expect(later.mdrProbability).toBeGreaterThan(0);
    expect(getDifficulty(2000, DEFAULT_BALANCE).mdrProbability).toBeGreaterThan(later.mdrProbability);
  });

  it('introduces obstacle features progressively', () => {
    const start = getDifficulty(0, DEFAULT_BALANCE);
    expect(start.highLaneUnlocked || start.skyLaneUnlocked || start.doublePatternsUnlocked).toBe(false);
    const late = getDifficulty(5000, DEFAULT_BALANCE);
    expect(late.highLaneUnlocked && late.skyLaneUnlocked && late.doublePatternsUnlocked && late.triplePatternsUnlocked).toBe(true);
  });

  it('starts with an engaging spawn interval instead of a long warm-up', () => {
    expect(getDifficulty(0, DEFAULT_BALANCE).spawnIntervalSeconds).toBe(
      DEFAULT_BALANCE.spawning.initialSpawnIntervalSeconds,
    );
    expect(DEFAULT_BALANCE.spawning.firstHazardDelaySeconds).toBeLessThan(1.5);
  });

  it('uses Competition by default and keeps Training materially easier', () => {
    expect(DEFAULT_BALANCE).toBe(COMPETITION_BALANCE);
    expect(COMPETITION_BALANCE.world.initialWorldSpeed).toBeGreaterThan(TRAINING_BALANCE.world.initialWorldSpeed);
    expect(getDifficulty(0, COMPETITION_BALANCE).spawnIntervalSeconds).toBeLessThan(
      getDifficulty(0, TRAINING_BALANCE).spawnIntervalSeconds,
    );
    expect(COMPETITION_BALANCE.mdr.unlockDistance).toBeLessThan(TRAINING_BALANCE.mdr.unlockDistance);
  });

  it('reaches but never exceeds the configured Competition speed cap early', () => {
    expect(getWorldSpeed(360, COMPETITION_BALANCE)).toBe(COMPETITION_BALANCE.world.maxWorldSpeed);
    expect(getWorldSpeed(1_000_000, COMPETITION_BALANCE)).toBe(COMPETITION_BALANCE.world.maxWorldSpeed);
  });

  it('ramps MDR probability with difficulty while preserving a physics-based reaction floor', () => {
    const first = getDifficulty(COMPETITION_BALANCE.mdr.unlockDistance, COMPETITION_BALANCE);
    const later = getDifficulty(360, COMPETITION_BALANCE);
    expect(later.mdrProbability).toBeGreaterThan(first.mdrProbability);
    expect(later.mdrProbability).toBeLessThanOrEqual(COMPETITION_BALANCE.mdr.maxProbability);
    expect(COMPETITION_BALANCE.spawning.minimumReactionWindowSeconds).toBeGreaterThanOrEqual(
      getMinimumReactionWindowSeconds(COMPETITION_BALANCE),
    );
    expect(getDifficulty(360, COMPETITION_BALANCE).spawnIntervalSeconds).toBeGreaterThanOrEqual(
      getMinimumReactionWindowSeconds(COMPETITION_BALANCE),
    );
  });
});
