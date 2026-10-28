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
    /** Maximum continuous crouch before Santa must stand and release Down. */
    readonly maxCrouchHoldMs: number;
    /** Minimum time after a crouch ends before another crouch can start. */
    readonly crouchCooldownMs: number;
    /** Pressing Down in the air pulls Santa down at this speed (px/s). */
    readonly fastFallVelocity: number;
    /** Extra downward acceleration while Down is held in the air (px/s²). */
    readonly fastFallAcceleration: number;
    /** Terminal falling speed, including fast-fall (px/s). */
    readonly maximumFallSpeed: number;
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
    /** Extra margin added to the slowest legal action transition (s). */
    readonly actionTransitionBufferSeconds: number;
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
    /** Spike-wave spawn interval multiplier; lower values create denser waves. */
    readonly surgeSpawnIntervalMultiplier: number;
    /** Multiplier for multi-step patterns during short surge phases. */
    readonly surgePatternWeightMultiplier: number;
    /** Distance before a delivery checkpoint at which its rush pattern is eligible. */
    readonly deliveryRushLeadMeters: number;
    /** Durations of the four repeating intensity-wave phases (seconds). */
    readonly intensityWave: {
      readonly preparation: { readonly min: number; readonly max: number };
      readonly active: { readonly min: number; readonly max: number };
      readonly surge: { readonly min: number; readonly max: number };
      readonly breathing: { readonly min: number; readonly max: number };
    };
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
        readonly minimumDifficulty: number;
        readonly initialWeight: number;
        readonly maxWeight: number;
        readonly cooldownChunks: number;
        readonly spacingMultiplier: number;
      }
    >>;
  };
  readonly platforms: {
    /** Keeps route switching out of the first few seconds. */
    readonly unlockDistanceMeters: number;
    /** Distance of normal planner gameplay between two platform sections. */
    readonly sectionIntervalMinMeters: number;
    readonly sectionIntervalMaxMeters: number;
    /** Vertical spacing between route levels; must stay reachable by a jump and leave headroom below. */
    readonly levelRisePixels: number;
    /** Required margin between the jump apex and one level rise. */
    readonly minimumJumpClearancePixels: number;
    /** Required gap between a standing Santa's head and the underside of a shelf. */
    readonly headroomPixels: number;
    readonly minimumPlatformWidthPixels: number;
    /** Maximum horizontal gap between consecutive shelves. */
    readonly maximumPlatformGapPixels: number;
    readonly platformThicknessPixels: number;
    /** Extra distance beyond the spawn edge before a section may start. */
    readonly sectionLeadPixels: number;
    readonly maximumConcurrentPlatforms: number;
    /** Threat-free time before a section's first object (also respects post-MDR clearance). */
    readonly entryClearanceSeconds: number;
    /** Threat-free time after a section before normal spawning resumes. */
    readonly exitClearanceSeconds: number;
    /** Every route must survive with all inputs this much early or late. Larger is more forgiving. */
    readonly routeTimingToleranceSeconds: number;
    /** Shortest time a route may demand between two consecutive inputs. */
    readonly minimumInputSpacingSeconds: number;
    /** Per-pattern unlock, selection weight, cooldown and speed range. */
    readonly patternWeights: Readonly<Record<
      PlatformPatternId,
      {
        readonly unlockDistanceMeters: number;
        readonly minimumDifficulty: number;
        readonly selectionWeight: number;
        readonly cooldownSections: number;
        readonly minimumWorldSpeed: number;
        readonly maximumWorldSpeed: number;
      }
    >>;
  };
  readonly torpedoes: {
    /** Distance before the separate projectile hazard can appear. */
    readonly unlockDistanceMeters: number;
    /** Delay after unlocking before the guaranteed first torpedo opportunity. */
    readonly firstOpportunityDelaySeconds: number;
    /** Probability of later opportunities at unlock distance; the first encounter is guaranteed when safe. */
    readonly probabilityAtUnlock: number;
    /** Hard cap on torpedo frequency as distance increases. */
    readonly maximumProbability: number;
    readonly probabilityRampMeters: number;
    readonly initialOpportunityIntervalSeconds: number;
    readonly minimumOpportunityIntervalSeconds: number;
    readonly speedPixelsPerSecond: number;
    readonly hitboxWidthPixels: number;
    readonly hitboxHeightPixels: number;
    /** Starting telegraph duration, gradually reduced only to the configured minimum. */
    readonly warningSeconds: number;
    readonly minimumWarningSeconds: number;
    /** Minimum time separating two projectile launches. */
    readonly minimumSeparationSeconds: number;
    readonly maximumActive: number;
    /** Mixed MDR/torpedo patterns stay locked until both threats are independently known. */
    readonly mixedPatternUnlockDistanceMeters: number;
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
    /** Shortest MDR warning at maximum difficulty (s). */
    readonly minimumWarningSeconds: number;
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
    /** Minimum time between antibiotic pickups regardless of inventory state (s). */
    readonly minimumPickupCooldownSeconds: number;
    /** Delay after the last hazard for a deliberate post-pattern refill (s). */
    readonly postPatternPickupDelaySeconds: number;
    /** Probability that a pickup restocks a currently empty slot (when one exists). */
    readonly preferMissingChance: number;
    /** Probability that a distance/cooldown-eligible pickup is actually scheduled. */
    readonly pickupChance: number;
    /** Maximum antibiotic pickups allowed in any configured distance window. */
    readonly maxPickupsPerDistanceWindow: number;
    readonly distanceWindowMeters: number;
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
    /** Visible but non-blocking stumble animation after protected contact (ms). */
    readonly protectedRecoveryMs: number;
    /** Points deducted when an antibiotic prevents defeat after a collision. */
    readonly protectedCollisionPenalty: number;
  };
  readonly effects: {
    /** Camera shake intensity for normal settings. Kept small on purpose. */
    readonly screenShakeIntensity: number;
    readonly screenShakeDurationMs: number;
  };
}

export type DifficultyMode = 'competition' | 'training';

export type PlatformPatternId =
  | 'JUMP_THEN_FAST_FALL'
  | 'PLATFORM_SWITCH'
  | 'TORPEDO_LOW_JUMP'
  | 'TORPEDO_MID_CROUCH'
  | 'TORPEDO_PLATFORM_ESCAPE'
  | 'MDR_ROUTE_BLOCK'
  | 'GRAM_CHAIN_ON_PLATFORMS'
  | 'ANTIBIOTIC_RISK_ROUTE'
  | 'COOKIE_UPPER_ROUTE'
  | 'DESCEND_BEFORE_TORPEDO'
  | 'ASCEND_TO_AVOID_MDR'
  | 'CROSS_LEVEL_DOUBLE_THREAT'
  | 'DELIVERY_GAUNTLET'
  | 'MIXED_LAB_ASSAULT';

export type ObstaclePatternId =
  | 'single'
  | 'lowHigh'
  | 'highLow'
  | 'gramSwitch'
  | 'antibioticTemptation'
  | 'cookieBait'
  | 'doubleReaction'
  | 'mdrWarningJump'
  | 'mdrWarningCrouch'
  | 'resourcePressure'
  | 'deliveryRush'
  | 'falseRhythm'
  | 'mixedHeightChain';

export const COMPETITION_BALANCE: BalanceConfig = {
  player: {
    gravity: 3200,
    jumpVelocity: 960,
    jumpCutVelocity: 460,
    coyoteTimeMs: 90,
    jumpBufferMs: 130,
    crouchDurationMs: 300,
    maxCrouchHoldMs: 500,
    crouchCooldownMs: 120,
    fastFallVelocity: 1500,
    fastFallAcceleration: 1800,
    maximumFallSpeed: 1750,
    allowAirJump: false,
  },
  world: {
    pixelsPerMeter: 40,
    // Competition is immediately demanding without starting at the eventual cap.
    initialWorldSpeed: 540,
    maxWorldSpeed: 900,
    // Reaches the finite cap in the first few hundred metres instead of several minutes.
    speedIncreasePerMeter: 1,
  },
  spawning: {
    // Brief target: initial interval −34% (0.98 → 0.65 s) and floor −21% (0.82 → 0.65 s).
    // 0.65 s is the physics floor (one 0.6 s jump flight + 0.05 s buffer), so two jumps in a row stay possible.
    // Difficulty keeps ramping through speed, pattern mix, platform sections, MDR and torpedoes.
    initialSpawnIntervalSeconds: 0.65,
    minSpawnIntervalSeconds: 0.65,
    spawnIntervalJitter: 0.12,
    minimumReactionWindowSeconds: 0.65,
    initialPatternGapSeconds: 0.78,
    patternGapJitterSeconds: 0.1,
    actionTransitionBufferSeconds: 0.05,
    trajectoryWeights: { straight: 1, bob: 0.3, lob: 0.15 },
    firstHazardDelaySeconds: 0.8,
    collectableClearanceSeconds: 0.4,
    breathingWindowEveryChunks: 7,
    // Competition breathing windows are 0.6–1.2 s, inside the brief's 0.5–1.5 s target.
    breathingWindowDurationSeconds: 1,
    surgeSpawnIntervalMultiplier: 0.82,
    surgePatternWeightMultiplier: 1.45,
    deliveryRushLeadMeters: 42,
    intensityWave: {
      preparation: { min: 0.6, max: 1 },
      active: { min: 6, max: 9 },
      surge: { min: 3, max: 5 },
      breathing: { min: 0.6, max: 1.2 },
    },
    unlocks: {
      highLane: 5,
      skyLane: 30,
      lobTrajectory: 90,
      doublePatterns: 5,
      triplePatterns: 55,
    },
    patternWeights: {
      single: { unlockDistance: 0, minimumDifficulty: 0, initialWeight: 0.45, maxWeight: 0.2, cooldownChunks: 1, spacingMultiplier: 1 },
      lowHigh: { unlockDistance: 0, minimumDifficulty: 0, initialWeight: 1.6, maxWeight: 2, cooldownChunks: 3, spacingMultiplier: 1 },
      highLow: { unlockDistance: 0, minimumDifficulty: 0.05, initialWeight: 1.1, maxWeight: 1.7, cooldownChunks: 3, spacingMultiplier: 1 },
      gramSwitch: { unlockDistance: 0, minimumDifficulty: 0, initialWeight: 1.5, maxWeight: 1.9, cooldownChunks: 2, spacingMultiplier: 1.1 },
      antibioticTemptation: { unlockDistance: 25, minimumDifficulty: 0.1, initialWeight: 0.35, maxWeight: 0.7, cooldownChunks: 4, spacingMultiplier: 1 },
      cookieBait: { unlockDistance: 15, minimumDifficulty: 0.05, initialWeight: 0.55, maxWeight: 0.95, cooldownChunks: 3, spacingMultiplier: 1 },
      doubleReaction: { unlockDistance: 10, minimumDifficulty: 0.1, initialWeight: 0.65, maxWeight: 1.2, cooldownChunks: 3, spacingMultiplier: 1 },
      mdrWarningJump: { unlockDistance: 0, minimumDifficulty: 0, initialWeight: 1, maxWeight: 1, cooldownChunks: 2, spacingMultiplier: 1 },
      mdrWarningCrouch: { unlockDistance: 0, minimumDifficulty: 0, initialWeight: 1, maxWeight: 1, cooldownChunks: 2, spacingMultiplier: 1 },
      resourcePressure: { unlockDistance: 55, minimumDifficulty: 0.2, initialWeight: 0.25, maxWeight: 0.65, cooldownChunks: 5, spacingMultiplier: 1 },
      deliveryRush: { unlockDistance: 0, minimumDifficulty: 0.15, initialWeight: 0.5, maxWeight: 0.8, cooldownChunks: 5, spacingMultiplier: 1 },
      falseRhythm: { unlockDistance: 45, minimumDifficulty: 0.15, initialWeight: 0.45, maxWeight: 0.85, cooldownChunks: 3, spacingMultiplier: 1.35 },
      mixedHeightChain: { unlockDistance: 75, minimumDifficulty: 0.3, initialWeight: 0.3, maxWeight: 0.8, cooldownChunks: 4, spacingMultiplier: 1 },
    },
  },
  platforms: {
    // Shelves start after a few seconds of normal bacteria and then make up roughly half the run.
    unlockDistanceMeters: 60,
    sectionIntervalMinMeters: 20,
    sectionIntervalMaxMeters: 45,
    // 118 px rise: ~18 px below the real 60 fps jump apex (~136 px) and 10 px headroom under a 16 px shelf.
    levelRisePixels: 118,
    minimumJumpClearancePixels: 12,
    headroomPixels: 8,
    minimumPlatformWidthPixels: 300,
    maximumPlatformGapPixels: 170,
    platformThicknessPixels: 16,
    sectionLeadPixels: 80,
    maximumConcurrentPlatforms: 24,
    entryClearanceSeconds: 0.7,
    exitClearanceSeconds: 0.5,
    // Every authored route must still work with all inputs 40 ms early or late.
    routeTimingToleranceSeconds: 0.04,
    minimumInputSpacingSeconds: 0.12,
    patternWeights: {
      JUMP_THEN_FAST_FALL: { unlockDistanceMeters: 60, minimumDifficulty: 0, selectionWeight: 1.4, cooldownSections: 2, minimumWorldSpeed: 540, maximumWorldSpeed: 900 },
      COOKIE_UPPER_ROUTE: { unlockDistanceMeters: 60, minimumDifficulty: 0, selectionWeight: 1, cooldownSections: 3, minimumWorldSpeed: 540, maximumWorldSpeed: 900 },
      PLATFORM_SWITCH: { unlockDistanceMeters: 90, minimumDifficulty: 0, selectionWeight: 1.2, cooldownSections: 3, minimumWorldSpeed: 540, maximumWorldSpeed: 900 },
      GRAM_CHAIN_ON_PLATFORMS: { unlockDistanceMeters: 110, minimumDifficulty: 0, selectionWeight: 1.25, cooldownSections: 3, minimumWorldSpeed: 540, maximumWorldSpeed: 900 },
      ANTIBIOTIC_RISK_ROUTE: { unlockDistanceMeters: 150, minimumDifficulty: 0, selectionWeight: 0.7, cooldownSections: 5, minimumWorldSpeed: 540, maximumWorldSpeed: 900 },
      TORPEDO_LOW_JUMP: { unlockDistanceMeters: 300, minimumDifficulty: 0, selectionWeight: 1.2, cooldownSections: 3, minimumWorldSpeed: 540, maximumWorldSpeed: 900 },
      TORPEDO_MID_CROUCH: { unlockDistanceMeters: 320, minimumDifficulty: 0, selectionWeight: 1, cooldownSections: 3, minimumWorldSpeed: 540, maximumWorldSpeed: 900 },
      MDR_ROUTE_BLOCK: { unlockDistanceMeters: 340, minimumDifficulty: 0, selectionWeight: 0.95, cooldownSections: 4, minimumWorldSpeed: 540, maximumWorldSpeed: 900 },
      TORPEDO_PLATFORM_ESCAPE: { unlockDistanceMeters: 380, minimumDifficulty: 0, selectionWeight: 0.9, cooldownSections: 4, minimumWorldSpeed: 540, maximumWorldSpeed: 900 },
      ASCEND_TO_AVOID_MDR: { unlockDistanceMeters: 380, minimumDifficulty: 0, selectionWeight: 0.75, cooldownSections: 5, minimumWorldSpeed: 540, maximumWorldSpeed: 900 },
      DESCEND_BEFORE_TORPEDO: { unlockDistanceMeters: 400, minimumDifficulty: 0, selectionWeight: 0.85, cooldownSections: 4, minimumWorldSpeed: 540, maximumWorldSpeed: 900 },
      CROSS_LEVEL_DOUBLE_THREAT: { unlockDistanceMeters: 420, minimumDifficulty: 0, selectionWeight: 0.6, cooldownSections: 6, minimumWorldSpeed: 540, maximumWorldSpeed: 900 },
      DELIVERY_GAUNTLET: { unlockDistanceMeters: 450, minimumDifficulty: 0, selectionWeight: 0.6, cooldownSections: 7, minimumWorldSpeed: 540, maximumWorldSpeed: 900 },
      MIXED_LAB_ASSAULT: { unlockDistanceMeters: 600, minimumDifficulty: 0, selectionWeight: 0.5, cooldownSections: 8, minimumWorldSpeed: 540, maximumWorldSpeed: 900 },
    },
  },
  torpedoes: {
    // First torpedo at roughly 20 s: after shelves/fast-fall, before the first MDR.
    unlockDistanceMeters: 300,
    firstOpportunityDelaySeconds: 1.5,
    probabilityAtUnlock: 0.55,
    maximumProbability: 0.8,
    probabilityRampMeters: 900,
    initialOpportunityIntervalSeconds: 7,
    minimumOpportunityIntervalSeconds: 4.5,
    // Relative to the world: 1300–1660 px/s on screen versus 540–900 px/s for bacteria.
    speedPixelsPerSecond: 760,
    hitboxWidthPixels: 76,
    hitboxHeightPixels: 30,
    warningSeconds: 1.05,
    minimumWarningSeconds: 0.9,
    minimumSeparationSeconds: 1.4,
    maximumActive: 2,
    mixedPatternUnlockDistanceMeters: 600,
  },
  mdr: {
    // Introduced right after the first torpedo, following the brief's mechanic order.
    unlockDistance: 340,
    baseProbability: 0.24,
    maxProbability: 0.4,
    minSpacingMeters: 135,
    clearanceSeconds: 1.9,
    warningSeconds: 1.25,
    minimumWarningSeconds: 0.95,
  },
  antibiotics: {
    capacity: { gramPositive: 1, gramNegative: 1 },
    startingInventory: { gramPositive: 1, gramNegative: 1 },
    // Rare enough to keep empty slots meaningful; pickups are still never required to survive.
    pickupIntervalMinMeters: 480,
    pickupIntervalMaxMeters: 760,
    riskPlacementChance: 0.55,
    riskOffsetSeconds: 0.32,
    jumpPickupMinGapSeconds: 1.6,
    minimumPickupCooldownSeconds: 42,
    postPatternPickupDelaySeconds: 0.55,
    preferMissingChance: 0.08,
    pickupChance: 0.62,
    maxPickupsPerDistanceWindow: 1,
    distanceWindowMeters: 520,
  },
  cookies: {
    chancePerPattern: 0.42,
    riskPlacementChance: 0.6,
    riskOffsetSeconds: 0.38,
    jumpArcChance: 0.8,
    rowSpacingSeconds: 0.1,
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
    invulnerabilityMs: 650,
    protectedRecoveryMs: 180,
    protectedCollisionPenalty: 125,
  },
  effects: {
    screenShakeIntensity: 0.006,
    screenShakeDurationMs: 220,
  },
};

/** Lower-pressure preset using the same mechanics and pattern catalogue. */
export const TRAINING_BALANCE: BalanceConfig = {
  ...COMPETITION_BALANCE,
  player: {
    ...COMPETITION_BALANCE.player,
    gravity: 2400,
    jumpVelocity: 950,
    jumpCutVelocity: 420,
    crouchDurationMs: 450,
    maxCrouchHoldMs: 1500,
    crouchCooldownMs: 0,
    fastFallVelocity: 1100,
    fastFallAcceleration: 1050,
    maximumFallSpeed: 1320,
  },
  world: {
    ...COMPETITION_BALANCE.world,
    initialWorldSpeed: 380,
    maxWorldSpeed: 760,
    speedIncreasePerMeter: 0.14,
  },
  spawning: {
    ...COMPETITION_BALANCE.spawning,
    initialSpawnIntervalSeconds: 2.1,
    minSpawnIntervalSeconds: 1.2,
    spawnIntervalJitter: 0.16,
    minimumReactionWindowSeconds: 1.05,
    actionTransitionBufferSeconds: 0.2,
    initialPatternGapSeconds: 1.55,
    patternGapJitterSeconds: 0.18,
    firstHazardDelaySeconds: 1.5,
    breathingWindowEveryChunks: 5,
    breathingWindowDurationSeconds: 2.3,
    surgeSpawnIntervalMultiplier: 0.95,
    surgePatternWeightMultiplier: 1.12,
    intensityWave: {
      preparation: { min: 3, max: 5 },
      active: { min: 7, max: 10 },
      surge: { min: 2, max: 3 },
      breathing: { min: 2, max: 4 },
    },
    unlocks: {
      highLane: 10,
      skyLane: 160,
      lobTrajectory: 300,
      doublePatterns: 20,
      triplePatterns: 400,
    },
  },
  mdr: {
    ...COMPETITION_BALANCE.mdr,
    unlockDistance: 600,
    baseProbability: 0.1,
    maxProbability: 0.25,
    minSpacingMeters: 250,
    clearanceSeconds: 2.2,
    warningSeconds: 1.6,
    minimumWarningSeconds: 1.2,
  },
  platforms: {
    ...COMPETITION_BALANCE.platforms,
    unlockDistanceMeters: 140,
    sectionIntervalMinMeters: 90,
    sectionIntervalMaxMeters: 150,
    entryClearanceSeconds: 1.1,
    exitClearanceSeconds: 0.9,
    routeTimingToleranceSeconds: 0.07,
    minimumInputSpacingSeconds: 0.2,
    patternWeights: {
      JUMP_THEN_FAST_FALL: { unlockDistanceMeters: 140, minimumDifficulty: 0, selectionWeight: 1, cooldownSections: 2, minimumWorldSpeed: 380, maximumWorldSpeed: 760 },
      COOKIE_UPPER_ROUTE: { unlockDistanceMeters: 160, minimumDifficulty: 0, selectionWeight: 0.9, cooldownSections: 3, minimumWorldSpeed: 380, maximumWorldSpeed: 760 },
      PLATFORM_SWITCH: { unlockDistanceMeters: 220, minimumDifficulty: 0, selectionWeight: 0.8, cooldownSections: 3, minimumWorldSpeed: 380, maximumWorldSpeed: 760 },
      GRAM_CHAIN_ON_PLATFORMS: { unlockDistanceMeters: 260, minimumDifficulty: 0, selectionWeight: 0.8, cooldownSections: 3, minimumWorldSpeed: 380, maximumWorldSpeed: 760 },
      ANTIBIOTIC_RISK_ROUTE: { unlockDistanceMeters: 320, minimumDifficulty: 0, selectionWeight: 0.6, cooldownSections: 5, minimumWorldSpeed: 380, maximumWorldSpeed: 760 },
      TORPEDO_LOW_JUMP: { unlockDistanceMeters: 500, minimumDifficulty: 0, selectionWeight: 0.6, cooldownSections: 3, minimumWorldSpeed: 380, maximumWorldSpeed: 760 },
      TORPEDO_MID_CROUCH: { unlockDistanceMeters: 540, minimumDifficulty: 0, selectionWeight: 0.5, cooldownSections: 3, minimumWorldSpeed: 380, maximumWorldSpeed: 760 },
      MDR_ROUTE_BLOCK: { unlockDistanceMeters: 640, minimumDifficulty: 0, selectionWeight: 0.45, cooldownSections: 4, minimumWorldSpeed: 380, maximumWorldSpeed: 760 },
      TORPEDO_PLATFORM_ESCAPE: { unlockDistanceMeters: 620, minimumDifficulty: 0, selectionWeight: 0.4, cooldownSections: 4, minimumWorldSpeed: 380, maximumWorldSpeed: 760 },
      ASCEND_TO_AVOID_MDR: { unlockDistanceMeters: 700, minimumDifficulty: 0, selectionWeight: 0.35, cooldownSections: 5, minimumWorldSpeed: 380, maximumWorldSpeed: 760 },
      DESCEND_BEFORE_TORPEDO: { unlockDistanceMeters: 660, minimumDifficulty: 0, selectionWeight: 0.4, cooldownSections: 4, minimumWorldSpeed: 380, maximumWorldSpeed: 760 },
      CROSS_LEVEL_DOUBLE_THREAT: { unlockDistanceMeters: 720, minimumDifficulty: 0, selectionWeight: 0.3, cooldownSections: 6, minimumWorldSpeed: 380, maximumWorldSpeed: 760 },
      DELIVERY_GAUNTLET: { unlockDistanceMeters: 900, minimumDifficulty: 0, selectionWeight: 0.25, cooldownSections: 7, minimumWorldSpeed: 380, maximumWorldSpeed: 620 },
      MIXED_LAB_ASSAULT: { unlockDistanceMeters: 1300, minimumDifficulty: 0, selectionWeight: 0.2, cooldownSections: 8, minimumWorldSpeed: 380, maximumWorldSpeed: 760 },
    },
  },
  torpedoes: {
    ...COMPETITION_BALANCE.torpedoes,
    unlockDistanceMeters: 480,
    firstOpportunityDelaySeconds: 3,
    probabilityAtUnlock: 0.35,
    maximumProbability: 0.58,
    probabilityRampMeters: 1500,
    initialOpportunityIntervalSeconds: 14,
    minimumOpportunityIntervalSeconds: 10,
    speedPixelsPerSecond: 600,
    warningSeconds: 1.6,
    minimumWarningSeconds: 1.3,
    minimumSeparationSeconds: 2.2,
    maximumActive: 1,
    mixedPatternUnlockDistanceMeters: 1100,
  },
  antibiotics: {
    ...COMPETITION_BALANCE.antibiotics,
    pickupIntervalMinMeters: 210,
    pickupIntervalMaxMeters: 340,
    riskPlacementChance: 0.2,
    riskOffsetSeconds: 0.22,
    minimumPickupCooldownSeconds: 16,
    postPatternPickupDelaySeconds: 0.5,
    preferMissingChance: 0.55,
    pickupChance: 0.9,
    maxPickupsPerDistanceWindow: 2,
    distanceWindowMeters: 500,
  },
  cookies: {
    ...COMPETITION_BALANCE.cookies,
    chancePerPattern: 0.5,
    riskPlacementChance: 0.25,
    riskOffsetSeconds: 0.22,
  },
  collision: {
    ...COMPETITION_BALANCE.collision,
    invulnerabilityMs: 900,
    protectedRecoveryMs: 120,
    protectedCollisionPenalty: 75,
  },
  effects: {
    ...COMPETITION_BALANCE.effects,
    screenShakeIntensity: 0.004,
    screenShakeDurationMs: 160,
  },
};

export const DIFFICULTY_PRESETS: Readonly<Record<DifficultyMode, BalanceConfig>> = {
  competition: COMPETITION_BALANCE,
  training: TRAINING_BALANCE,
};

/** Competition is the default experience; Training is an explicit accessibility option. */
export const DEFAULT_BALANCE = COMPETITION_BALANCE;

export function getBalanceForMode(mode: DifficultyMode): BalanceConfig {
  return DIFFICULTY_PRESETS[mode];
}
