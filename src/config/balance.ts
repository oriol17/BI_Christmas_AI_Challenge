import type { AntibioticCounts } from '../types/game';

/**
 * All gameplay balancing values live here. Gameplay classes receive this object
 * (or read DEFAULT_BALANCE) instead of hardcoding numbers, so tuning never
 * requires touching scene or entity code.
 *
 * Units: pixels, seconds, metres and milliseconds as indicated by each name.
 */
export interface BalanceConfig {
  readonly player: {
    /** Downward acceleration applied to Santa (px/s²). */
    readonly gravity: number;
    /** Initial upward speed of a jump (px/s). */
    readonly jumpVelocity: number;
    /** Releasing jump early caps upward speed to this value for a shorter hop (px/s). */
    readonly jumpCutVelocity: number;
    /** Grace period after running off the ground during which a jump is still accepted. */
    readonly coyoteTimeMs: number;
    /** A jump pressed slightly before landing is remembered for this long. */
    readonly jumpBufferMs: number;
    /** Minimum crouch duration for a quick tap; holding Down extends it. */
    readonly crouchDurationMs: number;
    /** Pressing Down in the air pulls Santa down at this speed (px/s). */
    readonly fastFallVelocity: number;
    /** Allow jumping again while airborne. Disabled by default. */
    readonly allowAirJump: boolean;
  };
  readonly world: {
    readonly pixelsPerMeter: number;
    /** World / bacteria scroll speed at the start of a run (px/s). */
    readonly initialWorldSpeed: number;
    /** Hard cap for world speed (px/s). */
    readonly maxWorldSpeed: number;
    /** Speed gained per metre travelled (px/s per m). */
    readonly speedIncreasePerMeter: number;
  };
  readonly spawning: {
    /** Gap between obstacle patterns at the easiest difficulty (s). */
    readonly maxSpawnIntervalSeconds: number;
    /** Gap between obstacle patterns at the hardest difficulty (s). */
    readonly minSpawnIntervalSeconds: number;
    /** Random +/- fraction applied to the pattern interval. */
    readonly spawnIntervalJitter: number;
    /** Absolute minimum time between two hazards reaching Santa (s). Guarantees avoidability. */
    readonly minHazardGapSeconds: number;
    /** Delay before the very first bacterium arrives (s). */
    readonly firstHazardDelaySeconds: number;
    /** Minimum time between a collectable and a hazard it could conflict with (s). */
    readonly collectableClearanceSeconds: number;
    /** Distances (m) at which new obstacle features are introduced. */
    readonly unlocks: {
      readonly highLane: number;
      readonly skyLane: number;
      readonly lobTrajectory: number;
      readonly doublePatterns: number;
      readonly triplePatterns: number;
    };
  };
  readonly mdr: {
    readonly unlockDistance: number;
    /** Chance per pattern of an MDR bacterium right after unlocking. */
    readonly baseProbability: number;
    /** Chance per pattern of an MDR bacterium at maximum difficulty. */
    readonly maxProbability: number;
    /** Minimum metres between two MDR bacteria. */
    readonly minSpacingMeters: number;
    /** Hazard-free time kept before and after every MDR bacterium (s). */
    readonly clearanceSeconds: number;
    /** How long the off-screen warning is visible before an MDR bacterium appears (s). */
    readonly warningSeconds: number;
  };
  readonly antibiotics: {
    readonly capacity: AntibioticCounts;
    readonly startingInventory: AntibioticCounts;
    /** Distance range (m) between antibiotic pickups. */
    readonly pickupIntervalMinMeters: number;
    readonly pickupIntervalMaxMeters: number;
    /** Probability that a pickup restocks a currently empty slot (when one exists). */
    readonly preferMissingChance: number;
  };
  readonly cookies: {
    /** Probability that an obstacle pattern carries a cookie reward. */
    readonly chancePerPattern: number;
    readonly score: number;
    readonly maxRowLength: number;
  };
  readonly scoring: {
    readonly pointsPerMeter: number;
  };
  readonly deliveries: {
    readonly intervalMeters: number;
    readonly score: number;
  };
  readonly collision: {
    /** Invulnerability granted after an antibiotic neutralises a bacterium (ms). */
    readonly invulnerabilityMs: number;
  };
  readonly effects: {
    /** Camera shake intensity for normal settings. Kept small on purpose. */
    readonly screenShakeIntensity: number;
    readonly screenShakeDurationMs: number;
  };
}

export const DEFAULT_BALANCE: BalanceConfig = {
  player: {
    gravity: 2400,
    jumpVelocity: 950,
    jumpCutVelocity: 420,
    coyoteTimeMs: 90,
    jumpBufferMs: 130,
    crouchDurationMs: 450,
    fastFallVelocity: 1100,
    allowAirJump: false,
  },
  world: {
    pixelsPerMeter: 40,
    initialWorldSpeed: 380,
    maxWorldSpeed: 760,
    speedIncreasePerMeter: 0.14,
  },
  spawning: {
    maxSpawnIntervalSeconds: 2.3,
    minSpawnIntervalSeconds: 1.1,
    spawnIntervalJitter: 0.15,
    minHazardGapSeconds: 0.95,
    firstHazardDelaySeconds: 2.6,
    collectableClearanceSeconds: 0.32,
    unlocks: {
      highLane: 110,
      skyLane: 260,
      lobTrajectory: 380,
      doublePatterns: 550,
      triplePatterns: 1500,
    },
  },
  mdr: {
    unlockDistance: 900,
    baseProbability: 0.08,
    maxProbability: 0.16,
    minSpacingMeters: 300,
    clearanceSeconds: 1.35,
    warningSeconds: 1.2,
  },
  antibiotics: {
    capacity: { gramPositive: 1, gramNegative: 1 },
    startingInventory: { gramPositive: 1, gramNegative: 1 },
    pickupIntervalMinMeters: 220,
    pickupIntervalMaxMeters: 380,
    preferMissingChance: 0.85,
  },
  cookies: {
    chancePerPattern: 0.5,
    score: 100,
    maxRowLength: 3,
  },
  scoring: {
    pointsPerMeter: 1,
  },
  deliveries: {
    intervalMeters: 500,
    score: 500,
  },
  collision: {
    invulnerabilityMs: 1000,
  },
  effects: {
    screenShakeIntensity: 0.004,
    screenShakeDurationMs: 160,
  },
};
