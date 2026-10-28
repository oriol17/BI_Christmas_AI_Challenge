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
    /** Gap between obstacle patterns at the start of a run (s). */
    readonly initialSpawnIntervalSeconds: number;
    /** Gap between obstacle patterns at the hardest difficulty (s). */
    readonly minSpawnIntervalSeconds: number;
    /** Random +/- fraction applied to the pattern interval. */
    readonly spawnIntervalJitter: number;
    /** Minimum time between hazards reaching Santa, even in a dense pattern (s). */
    readonly minimumReactionWindowSeconds: number;
    /** Typical gap between hazards within a pattern at the start of a run (s). */
    readonly initialPatternGapSeconds: number;
    /** Bounded extra spacing between hazards inside a pattern (s). */
    readonly patternGapJitterSeconds: number;
    /** Relative selection weights for straight, bobbing and lobbed trajectories. */
    readonly trajectoryWeights: {
      readonly straight: number;
      readonly bob: number;
      readonly lob: number;
    };
    /** Delay before the very first bacterium arrives (s). */
    readonly firstHazardDelaySeconds: number;
    /** Minimum time between a collectable and a hazard it could conflict with (s). */
    readonly collectableClearanceSeconds: number;
    /** Insert a short low-pressure interval after this many patterns. */
    readonly breathingWindowEveryChunks: number;
    /** Minimum gap after a breathing-window trigger (s). */
    readonly breathingWindowDurationSeconds: number;
    /** Distances (m) at which new obstacle features are introduced. */
    readonly unlocks: {
      readonly highLane: number;
      readonly skyLane: number;
      readonly lobTrajectory: number;
      readonly doublePatterns: number;
      readonly triplePatterns: number;
    };
    /** Pattern weights interpolate from the opening to maximum difficulty. */
    readonly patternWeights: Readonly<Record<
      ObstaclePatternId,
      {
        readonly unlockDistance: number;
        readonly initialWeight: number;
        readonly maxWeight: number;
      }
    >>;
  };
  readonly mdr: {
    readonly unlockDistance: number;
    /** Chance per eligible pattern after the guaranteed first MDR encounter. */
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
    /** Chance to place a pickup on a jump arc immediately before a ground hazard. */
    readonly riskPlacementChance: number;
    /** How far before a ground hazard a risky pickup is positioned (s). */
    readonly riskOffsetSeconds: number;
    /** Minimum leading gap for a non-risky jump-height pickup (s). */
    readonly jumpPickupMinGapSeconds: number;
    /** Probability that a pickup restocks a currently empty slot (when one exists). */
    readonly preferMissingChance: number;
  };
  readonly cookies: {
    /** Probability that an obstacle pattern carries a cookie reward. */
    readonly chancePerPattern: number;
    /** Chance to make a cookie arc begin shortly before a ground hazard. */
    readonly riskPlacementChance: number;
    /** How far before a ground hazard a risky cookie arc is centered (s). */
    readonly riskOffsetSeconds: number;
    /** Chance of using a jump arc when a ground obstacle is present. */
    readonly jumpArcChance: number;
    /** Time between cookies in a row (s). */
    readonly rowSpacingSeconds: number;
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

export type ObstaclePatternId =
  | 'single'
  | 'jumpThenCrouch'
  | 'crouchThenJump'
  | 'jumpThenStay'
  | 'stayThenCrouch'
  | 'jumpCrouchJump'
  | 'crouchJumpCrouch';

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
    initialWorldSpeed: 430,
    maxWorldSpeed: 760,
    // Reaches the existing cap in roughly 1.1 km instead of taking several minutes.
    speedIncreasePerMeter: 0.3,
  },
  spawning: {
    initialSpawnIntervalSeconds: 1.75,
    minSpawnIntervalSeconds: 1.2,
    spawnIntervalJitter: 0.2,
    minimumReactionWindowSeconds: 1.15,
    initialPatternGapSeconds: 1.42,
    patternGapJitterSeconds: 0.2,
    trajectoryWeights: { straight: 1, bob: 0.45, lob: 0.4 },
    firstHazardDelaySeconds: 1.35,
    collectableClearanceSeconds: 0.32,
    breathingWindowEveryChunks: 5,
    breathingWindowDurationSeconds: 2.15,
    unlocks: {
      highLane: 12,
      skyLane: 140,
      lobTrajectory: 280,
      doublePatterns: 12,
      triplePatterns: 360,
    },
    patternWeights: {
      single: { unlockDistance: 0, initialWeight: 1.3, maxWeight: 0.45 },
      jumpThenCrouch: { unlockDistance: 0, initialWeight: 0.65, maxWeight: 1.05 },
      crouchThenJump: { unlockDistance: 35, initialWeight: 0.55, maxWeight: 0.9 },
      jumpThenStay: { unlockDistance: 140, initialWeight: 0.3, maxWeight: 0.65 },
      stayThenCrouch: { unlockDistance: 160, initialWeight: 0.3, maxWeight: 0.65 },
      jumpCrouchJump: { unlockDistance: 260, initialWeight: 0.2, maxWeight: 0.55 },
      crouchJumpCrouch: { unlockDistance: 380, initialWeight: 0.2, maxWeight: 0.5 },
    },
  },
  mdr: {
    unlockDistance: 240,
    baseProbability: 0.2,
    maxProbability: 0.3,
    minSpacingMeters: 180,
    clearanceSeconds: 1.4,
    warningSeconds: 1.2,
  },
  antibiotics: {
    capacity: { gramPositive: 1, gramNegative: 1 },
    startingInventory: { gramPositive: 1, gramNegative: 1 },
    pickupIntervalMinMeters: 100,
    pickupIntervalMaxMeters: 165,
    riskPlacementChance: 0.3,
    riskOffsetSeconds: 0.22,
    jumpPickupMinGapSeconds: 2,
    preferMissingChance: 0.85,
  },
  cookies: {
    chancePerPattern: 0.5,
    riskPlacementChance: 0.4,
    riskOffsetSeconds: 0.22,
    jumpArcChance: 0.7,
    rowSpacingSeconds: 0.11,
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
