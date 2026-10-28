import type { BalanceConfig, ObstaclePatternId } from '../config/balance';
import type {
  AntibioticType,
  BacteriumType,
  CollectableLane,
  HazardLane,
  RequiredAction,
  Trajectory,
  TreatableBacteriumType,
} from '../types/game';
import { ANTIBIOTIC_TYPES } from '../types/game';
import { lerp } from '../utils/math';
import { pickRandom, pickWeighted, randomInt, randomRange, type RandomSource } from '../utils/random';
import {
  getDifficulty,
  getMinimumReactionWindowSeconds,
  getWorldSpeed,
  type DifficultySnapshot,
} from './difficulty';
import type { IntensityPhase } from './IntensityWave';

export interface PlannedHazard {
  readonly kind: 'bacterium';
  /** Seconds after the chunk start at which the bacterium reaches Santa. */
  readonly time: number;
  readonly bacterium: BacteriumType;
  readonly lane: HazardLane;
  readonly trajectory: Trajectory;
}

export interface PlannedCookie {
  readonly kind: 'cookie';
  readonly time: number;
  readonly lane: CollectableLane;
}

export interface PlannedAntibiotic {
  readonly kind: 'antibiotic';
  readonly time: number;
  readonly lane: CollectableLane;
  readonly antibiotic: AntibioticType;
}

export type PlannedCollectable = PlannedCookie | PlannedAntibiotic;
export type PlannedItem = PlannedHazard | PlannedCollectable;

/** Reusable patterns use lanes to communicate their intended action sequence. */
export type PlannedPatternId = ObstaclePatternId | 'opening';

/**
 * A group of items scheduled relative to the previous chunk's last hazard (time 0).
 * `duration` is the time of the chunk's last planned item, so pickups also clear before
 * the next pattern begins.
 */
export interface PlannedChunk {
  readonly items: readonly PlannedItem[];
  readonly duration: number;
  readonly hasMdr: boolean;
  readonly patternId: PlannedPatternId;
}

export const REQUIRED_ACTION: Readonly<Record<HazardLane, RequiredAction>> = {
  ground: 'jump',
  high: 'crouch',
  sky: 'stay',
};

const TREATABLE_TYPES: readonly TreatableBacteriumType[] = ['gramPositive', 'gramNegative'];
const EPSILON = 1e-6;

export interface PatternStep {
  readonly lane: HazardLane;
  readonly bacterium: BacteriumType | null;
}

export interface PatternDefinition {
  readonly id: ObstaclePatternId;
  readonly steps: readonly PatternStep[];
  readonly allowsMdr: boolean;
  readonly allowsAntibiotic: boolean;
  readonly allowsCookies: boolean;
  readonly cookieLane: CollectableLane;
}

export const PATTERN_CATALOG: Readonly<Record<ObstaclePatternId, PatternDefinition>> = {
  single: {
    id: 'single',
    steps: [{ lane: 'ground', bacterium: null }],
    allowsMdr: false,
    allowsAntibiotic: true,
    allowsCookies: true,
    cookieLane: 'jump',
  },
  lowHigh: {
    id: 'lowHigh',
    steps: [
      { lane: 'ground', bacterium: 'gramPositive' },
      { lane: 'high', bacterium: 'gramNegative' },
    ],
    allowsMdr: false,
    allowsAntibiotic: true,
    allowsCookies: true,
    cookieLane: 'jump',
  },
  highLow: {
    id: 'highLow',
    steps: [
      { lane: 'high', bacterium: 'gramNegative' },
      { lane: 'ground', bacterium: 'gramPositive' },
    ],
    allowsMdr: false,
    allowsAntibiotic: true,
    allowsCookies: true,
    cookieLane: 'crouch',
  },
  gramSwitch: {
    id: 'gramSwitch',
    steps: [
      { lane: 'ground', bacterium: 'gramPositive' },
      { lane: 'ground', bacterium: 'gramNegative' },
    ],
    allowsMdr: false,
    allowsAntibiotic: true,
    allowsCookies: true,
    cookieLane: 'jump',
  },
  antibioticTemptation: {
    id: 'antibioticTemptation',
    steps: [
      { lane: 'ground', bacterium: 'gramPositive' },
      { lane: 'high', bacterium: 'gramNegative' },
    ],
    allowsMdr: false,
    allowsAntibiotic: true,
    allowsCookies: false,
    cookieLane: 'jump',
  },
  cookieBait: {
    id: 'cookieBait',
    steps: [
      { lane: 'ground', bacterium: 'gramNegative' },
      { lane: 'high', bacterium: 'gramPositive' },
    ],
    allowsMdr: false,
    allowsAntibiotic: true,
    allowsCookies: true,
    cookieLane: 'jump',
  },
  doubleReaction: {
    id: 'doubleReaction',
    steps: [
      { lane: 'ground', bacterium: null },
      { lane: 'high', bacterium: null },
    ],
    allowsMdr: false,
    allowsAntibiotic: true,
    allowsCookies: true,
    cookieLane: 'jump',
  },
  mdrWarningJump: {
    id: 'mdrWarningJump',
    steps: [
      { lane: 'high', bacterium: 'gramNegative' },
      { lane: 'ground', bacterium: 'mdr' },
    ],
    allowsMdr: true,
    allowsAntibiotic: false,
    allowsCookies: false,
    cookieLane: 'jump',
  },
  mdrWarningCrouch: {
    id: 'mdrWarningCrouch',
    steps: [
      { lane: 'ground', bacterium: 'gramPositive' },
      { lane: 'high', bacterium: 'mdr' },
    ],
    allowsMdr: true,
    allowsAntibiotic: false,
    allowsCookies: false,
    cookieLane: 'crouch',
  },
  resourcePressure: {
    id: 'resourcePressure',
    steps: [
      { lane: 'ground', bacterium: 'gramPositive' },
      { lane: 'high', bacterium: 'gramNegative' },
    ],
    allowsMdr: false,
    allowsAntibiotic: true,
    allowsCookies: false,
    cookieLane: 'jump',
  },
  deliveryRush: {
    id: 'deliveryRush',
    steps: [
      { lane: 'ground', bacterium: 'gramPositive' },
      { lane: 'high', bacterium: 'gramNegative' },
      { lane: 'ground', bacterium: null },
    ],
    allowsMdr: false,
    allowsAntibiotic: false,
    allowsCookies: true,
    cookieLane: 'jump',
  },
  falseRhythm: {
    id: 'falseRhythm',
    steps: [
      { lane: 'ground', bacterium: null },
      { lane: 'high', bacterium: null },
    ],
    allowsMdr: false,
    allowsAntibiotic: true,
    allowsCookies: true,
    cookieLane: 'jump',
  },
  mixedHeightChain: {
    id: 'mixedHeightChain',
    steps: [
      { lane: 'ground', bacterium: 'gramPositive' },
      { lane: 'sky', bacterium: null },
      { lane: 'high', bacterium: 'gramNegative' },
    ],
    allowsMdr: false,
    allowsAntibiotic: true,
    allowsCookies: true,
    cookieLane: 'jump',
  },
};

export function isHazard(item: PlannedItem): item is PlannedHazard {
  return item.kind === 'bacterium';
}

/**
 * Produces deliberate, reusable obstacle patterns. The earliest chunks teach both
 * jump and crouch, while configurable unlocks and weights add lane changes and triples.
 * The minimum reaction window and MDR clearances keep each sequence avoidable.
 */
export class SpawnPlanner {
  private chunkCount = 0;
  private lastMdrDistance: number | null = null;
  private lastDeliveryRushCheckpoint = 0;
  private readonly lastPatternChunk = new Map<ObstaclePatternId, number>();
  private readonly patternHistory: ObstaclePatternId[] = [];
  private readonly antibioticPickupDistances: number[] = [];
  private lastAntibioticType: AntibioticType | null = null;
  /** A pickup that passed its chance roll but still needs a safe placement. */
  private antibioticApproved = false;
  private nextAntibioticDistance = 0;
  private nextAntibioticTimeSeconds = 0;
  private plannedTimeSeconds = 0;
  private requiredLeadingGap = 0;
  private collectableBlockedUntilSeconds = 0;
  private breathingWindowPending = false;

  constructor(
    private readonly balance: BalanceConfig,
    private readonly rng: RandomSource,
  ) {
    this.reset();
  }

  reset(): void {
    this.chunkCount = 0;
    this.lastMdrDistance = null;
    this.lastDeliveryRushCheckpoint = 0;
    this.lastPatternChunk.clear();
    this.patternHistory.length = 0;
    this.antibioticPickupDistances.length = 0;
    this.lastAntibioticType = null;
    this.antibioticApproved = false;
    this.requiredLeadingGap = 0;
    this.collectableBlockedUntilSeconds = 0;
    this.nextAntibioticTimeSeconds = 0;
    this.plannedTimeSeconds = 0;
    this.breathingWindowPending = false;
    this.nextAntibioticDistance = this.rollAntibioticInterval();
  }

  get antibioticCooldownSecondsRemaining(): number {
    return Math.max(0, this.nextAntibioticTimeSeconds - this.plannedTimeSeconds);
  }

  /** Gap the next planned threat must keep from the previous one (larger after an MDR). */
  get pendingLeadingGapSeconds(): number {
    return Math.max(this.requiredLeadingGap, getMinimumReactionWindowSeconds(this.balance));
  }

  /** Used after a platform section so the next planned chunk respects its clearance. */
  requireLeadingGap(seconds: number): void {
    this.requiredLeadingGap = Math.max(this.requiredLeadingGap, seconds);
  }

  /**
   * Lets a platform route place a reward antibiotic while applying the same scarcity rules
   * (distance interval, time cooldown, rolling window limit, chance and type alternation).
   */
  claimRouteAntibiotic(
    distanceMeters: number,
    runTimeSeconds: number,
    readiness: Readonly<Record<AntibioticType, boolean>>,
  ): AntibioticType | null {
    const { antibiotics } = this.balance;
    this.pruneAntibioticWindow(distanceMeters);
    const now = Math.max(this.plannedTimeSeconds, runTimeSeconds);
    if (
      distanceMeters < this.nextAntibioticDistance ||
      now < this.nextAntibioticTimeSeconds ||
      this.antibioticPickupDistances.length >= antibiotics.maxPickupsPerDistanceWindow
    ) return null;
    if (!this.antibioticApproved && this.rng() >= antibiotics.pickupChance) {
      this.nextAntibioticDistance = distanceMeters + this.rollAntibioticInterval();
      this.nextAntibioticTimeSeconds = now + antibiotics.minimumPickupCooldownSeconds;
      return null;
    }
    this.antibioticApproved = false;
    const antibiotic = this.pickAntibioticType(readiness);
    this.antibioticPickupDistances.push(distanceMeters);
    this.lastAntibioticType = antibiotic;
    this.nextAntibioticDistance = distanceMeters + this.rollAntibioticInterval();
    this.nextAntibioticTimeSeconds = now + antibiotics.minimumPickupCooldownSeconds;
    return antibiotic;
  }

  planChunk(
    distanceMeters: number,
    antibioticReadiness: Readonly<Record<AntibioticType, boolean>>,
    phase: IntensityPhase = 'active',
    runTimeSeconds = 0,
  ): PlannedChunk {
    const { spawning, mdr } = this.balance;
    const difficulty = getDifficulty(distanceMeters, this.balance);
    const minimumReaction = getMinimumReactionWindowSeconds(this.balance);
    const collectableBlockedUntil = this.collectableBlockedUntilSeconds;
    const chunkStartTimeSeconds = Math.max(this.plannedTimeSeconds, runTimeSeconds);
    const chunkIndex = this.chunkCount;
    const isFirstChunk = chunkIndex === 0;
    this.chunkCount += 1;

    const jitter = 1 + spawning.spawnIntervalJitter * (this.rng() * 2 - 1);
    const phaseMultiplier = phase === 'surge' ? spawning.surgeSpawnIntervalMultiplier : 1;
    let leadingGap = isFirstChunk
      ? spawning.firstHazardDelaySeconds
      : difficulty.spawnIntervalSeconds * jitter * phaseMultiplier;
    if (phase === 'breathing' || this.breathingWindowPending) {
      leadingGap = Math.max(leadingGap, spawning.breathingWindowDurationSeconds);
      this.breathingWindowPending = false;
    }
    leadingGap = Math.max(
      leadingGap,
      minimumReaction,
      this.requiredLeadingGap,
    );

    const spawnMdr = !isFirstChunk && this.shouldSpawnMdr(distanceMeters, difficulty);
    const items: PlannedItem[] = [];
    let patternId: PlannedPatternId = 'opening';
    let hazards: PlannedHazard[];

    if (isFirstChunk) {
      hazards = this.planPatternHazards('opening', leadingGap, difficulty);
    } else if (spawnMdr) {
      const mdrPatternId = this.selectMdrPattern(distanceMeters, difficulty);
      patternId = mdrPatternId;
      hazards = this.planPatternHazards(mdrPatternId, leadingGap, difficulty);
      this.lastMdrDistance = distanceMeters;
      this.requiredLeadingGap = mdr.clearanceSeconds;
      this.recordPattern(mdrPatternId);
    } else {
      const deliveryRush = this.isDeliveryRushDue(distanceMeters, difficulty);
      const selectedPatternId = deliveryRush
        ? 'deliveryRush'
        : chunkIndex === 1 && difficulty.highLaneUnlocked
          ? 'lowHigh'
          : this.selectPattern(distanceMeters, difficulty, phase);
      patternId = selectedPatternId;
      hazards = this.planPatternHazards(selectedPatternId, leadingGap, difficulty);
      this.requiredLeadingGap = minimumReaction;
      this.recordPattern(selectedPatternId);
    }
    items.push(...hazards);

    let leadingSlotUsed = false;
    const definition = patternId === 'opening' ? null : PATTERN_CATALOG[patternId];
    this.pruneAntibioticWindow(distanceMeters);
    const pickupDue =
      definition?.allowsAntibiotic &&
      distanceMeters >= this.nextAntibioticDistance &&
      chunkStartTimeSeconds >= this.nextAntibioticTimeSeconds;
    if (pickupDue) {
      const underWindowLimit =
        this.antibioticPickupDistances.length < this.balance.antibiotics.maxPickupsPerDistanceWindow;
      // A due pickup that is blocked by the window limit or has no safe placement stays due for
      // the next chunk; only a failed chance roll restarts the interval and cooldown.
      if (underWindowLimit) {
        if (!this.antibioticApproved) {
          if (this.rng() < this.balance.antibiotics.pickupChance) {
            this.antibioticApproved = true;
          } else {
            this.nextAntibioticDistance = distanceMeters + this.rollAntibioticInterval();
            this.nextAntibioticTimeSeconds =
              chunkStartTimeSeconds + this.balance.antibiotics.minimumPickupCooldownSeconds;
          }
        }
        if (this.antibioticApproved) {
          const antibiotic = this.planAntibiotic(
            hazards,
            leadingGap,
            antibioticReadiness,
            patternId === 'antibioticTemptation',
            collectableBlockedUntil,
          );
          if (antibiotic) {
            items.push(antibiotic);
            leadingSlotUsed = true;
            this.antibioticApproved = false;
            this.antibioticPickupDistances.push(distanceMeters);
            this.lastAntibioticType = antibiotic.antibiotic;
            const worldSpeed = getWorldSpeed(distanceMeters, this.balance);
            this.nextAntibioticDistance =
              distanceMeters +
              (antibiotic.time * worldSpeed) / this.balance.world.pixelsPerMeter +
              this.rollAntibioticInterval();
            this.nextAntibioticTimeSeconds =
              chunkStartTimeSeconds + antibiotic.time + this.balance.antibiotics.minimumPickupCooldownSeconds;
          }
        }
      }
    }

    if (
      definition?.allowsCookies &&
      (patternId === 'cookieBait' || this.rng() < this.balance.cookies.chancePerPattern)
    ) {
      items.push(
        ...this.planCookies(
          hazards,
          leadingGap,
          leadingSlotUsed,
          definition.cookieLane,
          patternId === 'cookieBait',
          collectableBlockedUntil,
        ),
      );
    }

    const duration = items.reduce((max, item) => Math.max(max, item.time), leadingGap);
    this.plannedTimeSeconds = chunkStartTimeSeconds + duration;
    this.collectableBlockedUntilSeconds = Math.max(0, collectableBlockedUntil - duration);
    if (spawnMdr) this.collectableBlockedUntilSeconds = mdr.clearanceSeconds;
    const breathingFrequency = Math.max(1, spawning.breathingWindowEveryChunks);
    this.breathingWindowPending =
      patternId === 'deliveryRush' || this.chunkCount % breathingFrequency === 0;
    return { items: items.sort((a, b) => a.time - b.time), duration, hasMdr: spawnMdr, patternId };
  }

  private shouldSpawnMdr(distanceMeters: number, difficulty: DifficultySnapshot): boolean {
    if (!difficulty.mdrUnlocked) return false;
    if (this.lastMdrDistance === null) return true;
    if (distanceMeters - this.lastMdrDistance < this.balance.mdr.minSpacingMeters) return false;
    return this.rng() < difficulty.mdrProbability;
  }

  private selectMdrPattern(distanceMeters: number, difficulty: DifficultySnapshot): ObstaclePatternId {
    const candidates = (['mdrWarningJump', 'mdrWarningCrouch'] as const)
      .filter((id) => {
        const config = this.balance.spawning.patternWeights[id];
        return (
          distanceMeters >= config.unlockDistance &&
          difficulty.level >= config.minimumDifficulty &&
          !this.isOnCooldown(id) &&
          !this.repeatsTooOften(id)
        );
      })
      .map((id) => {
        const config = this.balance.spawning.patternWeights[id];
        return { value: id, weight: lerp(config.initialWeight, config.maxWeight, difficulty.level) };
      });
    return pickWeighted(
      this.rng,
      candidates.length > 0
        ? candidates
        : (['mdrWarningJump', 'mdrWarningCrouch'] as const).map((id) => ({
            value: id,
            weight: lerp(
              this.balance.spawning.patternWeights[id].initialWeight,
              this.balance.spawning.patternWeights[id].maxWeight,
              difficulty.level,
            ),
          })),
    );
  }

  private selectPattern(
    distanceMeters: number,
    difficulty: DifficultySnapshot,
    phase: IntensityPhase,
  ): ObstaclePatternId {
    const availableLanes: HazardLane[] = ['ground'];
    if (difficulty.highLaneUnlocked) availableLanes.push('high');
    if (difficulty.skyLaneUnlocked) availableLanes.push('sky');

    const candidates = (Object.keys(PATTERN_CATALOG) as ObstaclePatternId[])
      .filter((id) => {
        const config = this.balance.spawning.patternWeights[id];
        const definition = PATTERN_CATALOG[id];
        if (definition.allowsMdr || id === 'deliveryRush') return false;
        return (
          distanceMeters >= config.unlockDistance &&
          difficulty.level >= config.minimumDifficulty &&
          !this.isOnCooldown(id) &&
          !this.repeatsTooOften(id) &&
          definition.steps.every((step) => availableLanes.includes(step.lane)) &&
          (definition.steps.length === 1 || difficulty.doublePatternsUnlocked) &&
          (definition.steps.length < 3 || difficulty.triplePatternsUnlocked)
        );
      })
      .map((id) => {
        const config = this.balance.spawning.patternWeights[id];
        const complexityMultiplier =
          phase === 'surge' && PATTERN_CATALOG[id].steps.length > 1
            ? this.balance.spawning.surgePatternWeightMultiplier
            : 1;
        return {
          value: id,
          weight: lerp(config.initialWeight, config.maxWeight, difficulty.level) * complexityMultiplier,
        };
      });

    return candidates.length > 0 ? pickWeighted(this.rng, candidates) : 'single';
  }

  private planPatternHazards(
    patternId: ObstaclePatternId | 'opening',
    leadingGap: number,
    difficulty: DifficultySnapshot,
  ): PlannedHazard[] {
    if (patternId === 'opening') {
      return [
        {
          kind: 'bacterium',
          time: leadingGap,
          bacterium: pickRandom(this.rng, TREATABLE_TYPES),
          lane: 'ground',
          trajectory: this.pickTrajectory(difficulty),
        },
      ];
    }

    const definition = PATTERN_CATALOG[patternId];
    const steps = definition.steps;
    const lanes: HazardLane[] = ['ground'];
    if (difficulty.highLaneUnlocked) lanes.push('high');
    if (difficulty.skyLaneUnlocked) lanes.push('sky');
    const minimumReaction = getMinimumReactionWindowSeconds(this.balance);
    const hazards: PlannedHazard[] = [];
    for (const [index, step] of steps.entries()) {
      let time = leadingGap;
      if (index > 0) {
        const previous = steps[index - 1]!;
        const involvesMdr = step.bacterium === 'mdr' || previous.bacterium === 'mdr';
        const mdrGap = Math.max(
          this.balance.mdr.clearanceSeconds,
          minimumReaction +
            (this.balance.collision.invulnerabilityMs + this.balance.collision.protectedRecoveryMs) / 1000,
        );
        const baseGap =
          lerp(
            this.balance.spawning.initialPatternGapSeconds,
            minimumReaction,
            difficulty.level,
          ) +
          (this.rng() * 2 - 1) * this.balance.spawning.patternGapJitterSeconds;
        const gap = involvesMdr
          ? mdrGap
          : Math.max(minimumReaction, baseGap * this.balance.spawning.patternWeights[patternId].spacingMultiplier);
        time = hazards[index - 1]!.time + gap;
      }
      const bacterium = step.bacterium ?? pickRandom(this.rng, TREATABLE_TYPES);
      hazards.push({
        kind: 'bacterium',
        time,
        bacterium,
        lane: patternId === 'single' ? pickRandom(this.rng, lanes) : step.lane,
        trajectory: bacterium === 'mdr' ? 'straight' : this.pickTrajectory(difficulty),
      });
    }
    return hazards;
  }

  private isOnCooldown(id: ObstaclePatternId): boolean {
    const lastChunk = this.lastPatternChunk.get(id);
    return lastChunk !== undefined && this.chunkCount - lastChunk < this.balance.spawning.patternWeights[id].cooldownChunks;
  }

  private repeatsTooOften(id: ObstaclePatternId): boolean {
    return this.patternHistory.length >= 2 && this.patternHistory.slice(-2).every((recent) => recent === id);
  }

  private recordPattern(id: ObstaclePatternId): void {
    this.lastPatternChunk.set(id, this.chunkCount);
    this.patternHistory.push(id);
    if (this.patternHistory.length > 6) this.patternHistory.shift();
  }

  private isDeliveryRushDue(distanceMeters: number, difficulty: DifficultySnapshot): boolean {
    const interval = this.balance.deliveries.intervalMeters;
    const checkpoint = (Math.floor(distanceMeters / interval) + 1) * interval;
    const config = this.balance.spawning.patternWeights.deliveryRush;
    if (
      checkpoint === this.lastDeliveryRushCheckpoint ||
      distanceMeters < checkpoint - this.balance.spawning.deliveryRushLeadMeters ||
      distanceMeters < config.unlockDistance ||
      difficulty.level < config.minimumDifficulty ||
      this.isOnCooldown('deliveryRush') ||
      this.rng() >= lerp(config.initialWeight, config.maxWeight, difficulty.level)
    ) {
      return false;
    }
    this.lastDeliveryRushCheckpoint = checkpoint;
    return true;
  }

  private pickTrajectory(difficulty: DifficultySnapshot): Trajectory {
    const weights = this.balance.spawning.trajectoryWeights;
    return pickWeighted(this.rng, [
      { value: 'straight' as const, weight: weights.straight },
      { value: 'bob' as const, weight: weights.bob },
      { value: 'lob' as const, weight: difficulty.lobUnlocked ? weights.lob : 0 },
    ]);
  }

  private planAntibiotic(
    hazards: readonly PlannedHazard[],
    leadingGap: number,
    readiness: Readonly<Record<AntibioticType, boolean>>,
    preferRisky: boolean,
    blockedUntilSeconds: number,
  ): PlannedAntibiotic | null {
    const antibiotic = this.pickAntibioticType(readiness);
    const groundHazard = hazards.find((hazard) => hazard.lane === 'ground');
    const highHazard = hazards.find((hazard) => hazard.lane === 'high');
    const candidates: PlannedAntibiotic[] = [];
    if (preferRisky && hazards.length > 0) {
      candidates.push({
        kind: 'antibiotic',
        time: hazards[hazards.length - 1]!.time + this.balance.antibiotics.postPatternPickupDelaySeconds,
        lane: 'run',
        antibiotic,
      });
    }
    if (
      groundHazard &&
      (preferRisky || this.rng() < this.balance.antibiotics.riskPlacementChance)
    ) {
      candidates.push({
        kind: 'antibiotic',
        time: groundHazard.time - this.balance.antibiotics.riskOffsetSeconds,
        lane: 'jump',
        antibiotic,
      });
    }
    if (
      highHazard &&
      (preferRisky || this.rng() < this.balance.antibiotics.riskPlacementChance)
    ) {
      candidates.push({
        kind: 'antibiotic',
        time: highHazard.time - this.balance.antibiotics.riskOffsetSeconds,
        lane: 'crouch',
        antibiotic,
      });
    }
    candidates.push({ kind: 'antibiotic', time: leadingGap / 2, lane: 'run', antibiotic });
    if (leadingGap >= this.balance.antibiotics.jumpPickupMinGapSeconds) {
      candidates.push({ kind: 'antibiotic', time: leadingGap / 2, lane: 'jump', antibiotic });
    }

    return candidates.find(
      (candidate) =>
        candidate.time >= Math.max(this.balance.spawning.collectableClearanceSeconds, blockedUntilSeconds) &&
        hazards.every((hazard) =>
          !collectableConflictsWithHazard(candidate, hazard, this.collectableClearanceFor(hazard)),
        ),
    ) ?? null;
  }

  private planCookies(
    hazards: readonly PlannedHazard[],
    leadingGap: number,
    leadingSlotUsed: boolean,
    preferredLane: CollectableLane,
    forcedRisk: boolean,
    blockedUntilSeconds: number,
  ): PlannedCookie[] {
    const groundHazards = hazards.filter((hazard) => hazard.lane === 'ground');
    const highHazards = hazards.filter((hazard) => hazard.lane === 'high');
    const rowLength = randomInt(this.rng, 1, Math.max(1, this.balance.cookies.maxRowLength));
    const useArc =
      groundHazards.length > 0 &&
      (forcedRisk || leadingSlotUsed || this.rng() < this.balance.cookies.jumpArcChance);

    let candidates: PlannedCookie[];
    if (useArc) {
      const target = pickRandom(this.rng, groundHazards);
      const riskOffset =
        forcedRisk || this.rng() < this.balance.cookies.riskPlacementChance
          ? this.balance.cookies.riskOffsetSeconds
          : 0;
      candidates = this.makeRow(target.time - riskOffset, rowLength, 'jump');
    } else if (forcedRisk && highHazards.length > 0) {
      const target = pickRandom(this.rng, highHazards);
      candidates = this.makeRow(
        target.time - this.balance.cookies.riskOffsetSeconds,
        rowLength,
        'crouch',
      );
    } else if (!leadingSlotUsed) {
      candidates = this.makeRow(leadingGap / 2, rowLength, preferredLane);
    } else {
      return [];
    }

    // Time 0 is the previous chunk's last hazard; its lane is unknown here, so treat it as
    // conflicting with every collectable lane.
    const clearance = this.balance.spawning.collectableClearanceSeconds;
    return candidates.filter(
      (cookie) =>
        cookie.time >= Math.max(clearance, blockedUntilSeconds) - EPSILON &&
        hazards.every((hazard) =>
          !collectableConflictsWithHazard(cookie, hazard, this.collectableClearanceFor(hazard)),
        ),
    );
  }

  private collectableClearanceFor(hazard: PlannedHazard): number {
    return hazard.bacterium === 'mdr'
      ? Math.max(this.balance.spawning.collectableClearanceSeconds, this.balance.mdr.clearanceSeconds)
      : this.balance.spawning.collectableClearanceSeconds;
  }

  private makeRow(centerTime: number, length: number, lane: CollectableLane): PlannedCookie[] {
    const cookies: PlannedCookie[] = [];
    for (let index = 0; index < length; index += 1) {
      const offset = (index - (length - 1) / 2) * this.balance.cookies.rowSpacingSeconds;
      cookies.push({ kind: 'cookie', time: centerTime + offset, lane });
    }
    return cookies;
  }

  private pickAntibioticType(readiness: Readonly<Record<AntibioticType, boolean>>): AntibioticType {
    const alternatives = ANTIBIOTIC_TYPES.filter((type) => type !== this.lastAntibioticType);
    const pool = alternatives.length > 0 ? alternatives : ANTIBIOTIC_TYPES;
    const missing = pool.filter((type) => !readiness[type]);
    return missing.length > 0 && this.rng() < this.balance.antibiotics.preferMissingChance
      ? pickRandom(this.rng, missing)
      : pickRandom(this.rng, pool);
  }

  private pruneAntibioticWindow(distanceMeters: number): void {
    while (
      this.antibioticPickupDistances.length > 0 &&
      distanceMeters - (this.antibioticPickupDistances[0] ?? 0) >= this.balance.antibiotics.distanceWindowMeters
    ) this.antibioticPickupDistances.shift();
  }

  private rollAntibioticInterval(): number {
    const { pickupIntervalMinMeters, pickupIntervalMaxMeters } = this.balance.antibiotics;
    return randomRange(this.rng, pickupIntervalMinMeters, pickupIntervalMaxMeters);
  }
}

/**
 * A collectable conflicts with a nearby hazard if collecting it would force Santa into
 * the hazard: floor items vs. ground hazards, jump-height items vs. high/sky hazards,
 * and anything near an MDR bacterium.
 */
export function collectableConflictsWithHazard(
  collectable: PlannedCollectable,
  hazard: PlannedHazard,
  clearanceSeconds: number,
): boolean {
  if (Math.abs(collectable.time - hazard.time) >= clearanceSeconds - EPSILON) return false;
  if (hazard.bacterium === 'mdr') return true;
  return collectable.lane === 'jump'
    ? hazard.lane !== 'ground'
    : hazard.lane === 'ground';
}

export interface TimelineViolation {
  readonly time: number;
  readonly reason: string;
}

/**
 * Validates a sequence of items expressed in absolute time. Used by tests to prove that
 * chained chunks never create unavoidable situations.
 */
export function findTimelineViolations(items: readonly PlannedItem[], balance: BalanceConfig): TimelineViolation[] {
  const violations: TimelineViolation[] = [];
  const hazards = items.filter(isHazard).sort((a, b) => a.time - b.time);
  const collectables = items.filter((item): item is PlannedCollectable => !isHazard(item));

  for (let index = 1; index < hazards.length; index += 1) {
    const previous = hazards[index - 1]!;
    const current = hazards[index]!;
    const gap = current.time - previous.time;
    const involvesMdr = previous.bacterium === 'mdr' || current.bacterium === 'mdr';
    const required = involvesMdr
      ? Math.max(
          balance.mdr.clearanceSeconds,
          getMinimumReactionWindowSeconds(balance) +
            (balance.collision.invulnerabilityMs + balance.collision.protectedRecoveryMs) / 1000,
        )
      : getMinimumReactionWindowSeconds(balance);
    if (gap < required - EPSILON) {
      violations.push({ time: current.time, reason: `Hazard gap ${gap.toFixed(3)}s < ${required}s` });
    }
    if (current.bacterium === 'mdr' && current.lane === 'sky') {
      violations.push({ time: current.time, reason: 'MDR in sky lane' });
    }
  }

  for (const collectable of collectables) {
    for (const hazard of hazards) {
      const clearance =
        hazard.bacterium === 'mdr'
          ? Math.max(balance.spawning.collectableClearanceSeconds, balance.mdr.clearanceSeconds)
          : balance.spawning.collectableClearanceSeconds;
      if (collectableConflictsWithHazard(collectable, hazard, clearance)) {
        violations.push({ time: collectable.time, reason: `${collectable.kind} conflicts with ${hazard.lane} hazard` });
      }
    }
  }
  return violations;
}
