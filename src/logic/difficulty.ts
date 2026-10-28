import type { BalanceConfig } from '../config/balance';
import { clamp, inverseLerp, lerp } from '../utils/math';

export interface DifficultySnapshot {
  /** Scroll speed of the world and bacteria (px/s), clamped to the configured maximum. */
  readonly worldSpeed: number;
  /** Normalised difficulty in [0, 1]; 1 means the configured cap has been reached. */
  readonly level: number;
  readonly spawnIntervalSeconds: number;
  readonly mdrUnlocked: boolean;
  readonly mdrProbability: number;
  readonly highLaneUnlocked: boolean;
  readonly skyLaneUnlocked: boolean;
  readonly lobUnlocked: boolean;
  readonly doublePatternsUnlocked: boolean;
  readonly triplePatternsUnlocked: boolean;
}

export function getWorldSpeed(distanceMeters: number, balance: BalanceConfig): number {
  const { initialWorldSpeed, maxWorldSpeed, speedIncreasePerMeter } = balance.world;
  const raw = initialWorldSpeed + Math.max(0, distanceMeters) * speedIncreasePerMeter;
  return clamp(raw, initialWorldSpeed, maxWorldSpeed);
}

export function getDifficulty(distanceMeters: number, balance: BalanceConfig): DifficultySnapshot {
  const distance = Math.max(0, distanceMeters);
  const worldSpeed = getWorldSpeed(distance, balance);
  const level = inverseLerp(balance.world.initialWorldSpeed, balance.world.maxWorldSpeed, worldSpeed);
  const { spawning, mdr } = balance;

  const spawnIntervalSeconds = Math.max(
    spawning.minimumReactionWindowSeconds,
    lerp(spawning.initialSpawnIntervalSeconds, spawning.minSpawnIntervalSeconds, level),
  );

  const mdrUnlocked = distance >= mdr.unlockDistance;
  const mdrProbability = mdrUnlocked ? clamp(lerp(mdr.baseProbability, mdr.maxProbability, level), 0, 1) : 0;

  return {
    worldSpeed,
    level,
    spawnIntervalSeconds,
    mdrUnlocked,
    mdrProbability,
    highLaneUnlocked: distance >= spawning.unlocks.highLane,
    skyLaneUnlocked: distance >= spawning.unlocks.skyLane,
    lobUnlocked: distance >= spawning.unlocks.lobTrajectory,
    doublePatternsUnlocked: distance >= spawning.unlocks.doublePatterns,
    triplePatternsUnlocked: distance >= spawning.unlocks.triplePatterns,
  };
}
