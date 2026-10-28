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
  readonly mdrWarningSeconds: number;
  readonly highLaneUnlocked: boolean;
  readonly skyLaneUnlocked: boolean;
  readonly lobUnlocked: boolean;
  readonly doublePatternsUnlocked: boolean;
  readonly triplePatternsUnlocked: boolean;
  readonly platformsUnlocked: boolean;
  readonly torpedoesUnlocked: boolean;
  readonly torpedoProbability: number;
  readonly torpedoWarningSeconds: number;
}

/** Includes the slowest complete jump/crouch transition and a reaction buffer. */
export function getMinimumReactionWindowSeconds(balance: BalanceConfig): number {
  const jumpFlightSeconds = (2 * balance.player.jumpVelocity) / balance.player.gravity;
  const crouchCycleSeconds =
    (balance.player.crouchDurationMs + balance.player.crouchCooldownMs) / 1000;
  return Math.max(
    balance.spawning.minimumReactionWindowSeconds,
    Math.max(jumpFlightSeconds, crouchCycleSeconds) + balance.spawning.actionTransitionBufferSeconds,
  );
}

export function getWorldSpeed(distanceMeters: number, balance: BalanceConfig): number {
  const { initialWorldSpeed, maxWorldSpeed, speedIncreasePerMeter } = balance.world;
  const raw = initialWorldSpeed + Math.max(0, distanceMeters) * speedIncreasePerMeter;
  return clamp(raw, initialWorldSpeed, maxWorldSpeed);
}

export function getTorpedoProbability(distanceMeters: number, balance: BalanceConfig): number {
  const { torpedoes } = balance;
  if (distanceMeters < torpedoes.unlockDistanceMeters) return 0;
  const progress = Math.max(
    0,
    Math.min(1, (distanceMeters - torpedoes.unlockDistanceMeters) / torpedoes.probabilityRampMeters),
  );
  const maximum = Math.max(0, Math.min(1, torpedoes.maximumProbability));
  const initial = Math.max(0, Math.min(maximum, torpedoes.probabilityAtUnlock));
  return Math.max(0, Math.min(maximum, lerp(initial, maximum, progress)));
}

export function getDifficulty(distanceMeters: number, balance: BalanceConfig): DifficultySnapshot {
  const distance = Math.max(0, distanceMeters);
  const worldSpeed = getWorldSpeed(distance, balance);
  const level = inverseLerp(balance.world.initialWorldSpeed, balance.world.maxWorldSpeed, worldSpeed);
  const { spawning, mdr } = balance;

  const spawnIntervalSeconds = Math.max(
    getMinimumReactionWindowSeconds(balance),
    lerp(spawning.initialSpawnIntervalSeconds, spawning.minSpawnIntervalSeconds, level),
  );

  const mdrUnlocked = distance >= mdr.unlockDistance;
  const mdrProbability = mdrUnlocked ? clamp(lerp(mdr.baseProbability, mdr.maxProbability, level), 0, 1) : 0;
  const mdrWarningSeconds = Math.max(
    mdr.minimumWarningSeconds,
    lerp(mdr.warningSeconds, mdr.minimumWarningSeconds, level),
  );
  const torpedoProbability = getTorpedoProbability(distance, balance);
  const torpedoWarningProgress = Math.max(
    0,
    Math.min(
      1,
      (distance - balance.torpedoes.unlockDistanceMeters) / balance.torpedoes.probabilityRampMeters,
    ),
  );
  const torpedoWarningSeconds = lerp(
    balance.torpedoes.warningSeconds,
    balance.torpedoes.minimumWarningSeconds,
    torpedoWarningProgress,
  );

  return {
    worldSpeed,
    level,
    spawnIntervalSeconds,
    mdrUnlocked,
    mdrProbability,
    mdrWarningSeconds,
    highLaneUnlocked: distance >= spawning.unlocks.highLane,
    skyLaneUnlocked: distance >= spawning.unlocks.skyLane,
    lobUnlocked: distance >= spawning.unlocks.lobTrajectory,
    doublePatternsUnlocked: distance >= spawning.unlocks.doublePatterns,
    triplePatternsUnlocked: distance >= spawning.unlocks.triplePatterns,
    platformsUnlocked: distance >= balance.platforms.unlockDistanceMeters,
    torpedoesUnlocked: distance >= balance.torpedoes.unlockDistanceMeters,
    torpedoProbability,
    torpedoWarningSeconds,
  };
}
