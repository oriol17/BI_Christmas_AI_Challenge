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
import { getDifficulty, type DifficultySnapshot } from './difficulty';

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
export type PlannedPatternId = ObstaclePatternId | 'opening' | 'mdrSequence';

/**
 * A group of items scheduled relative to the previous chunk's last hazard (time 0).
 * `duration` is the time of the chunk's last hazard, so chunks can be chained.
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

const MDR_LANES: readonly HazardLane[] = ['ground', 'high'];
const TREATABLE_TYPES: readonly TreatableBacteriumType[] = ['gramPositive', 'gramNegative'];
const EPSILON = 1e-6;

interface PatternStep {
  readonly lane: HazardLane;
  readonly bacterium: TreatableBacteriumType | null;
}

const PATTERN_STEPS: Readonly<Record<ObstaclePatternId, readonly PatternStep[]>> = {
  single: [{ lane: 'ground', bacterium: null }],
  jumpThenCrouch: [
    { lane: 'ground', bacterium: 'gramPositive' },
    { lane: 'high', bacterium: 'gramNegative' },
  ],
  crouchThenJump: [
    { lane: 'high', bacterium: 'gramNegative' },
    { lane: 'ground', bacterium: 'gramPositive' },
  ],
  jumpThenStay: [
    { lane: 'ground', bacterium: 'gramPositive' },
    { lane: 'sky', bacterium: 'gramNegative' },
  ],
  stayThenCrouch: [
    { lane: 'sky', bacterium: 'gramPositive' },
    { lane: 'high', bacterium: 'gramNegative' },
  ],
  jumpCrouchJump: [
    { lane: 'ground', bacterium: 'gramPositive' },
    { lane: 'high', bacterium: 'gramNegative' },
    { lane: 'ground', bacterium: 'gramPositive' },
  ],
  crouchJumpCrouch: [
    { lane: 'high', bacterium: 'gramNegative' },
    { lane: 'ground', bacterium: 'gramPositive' },
    { lane: 'high', bacterium: 'gramNegative' },
  ],
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
  private nextAntibioticDistance = 0;
  private requiredLeadingGap = 0;
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
    this.requiredLeadingGap = 0;
    this.breathingWindowPending = false;
    this.nextAntibioticDistance = this.rollAntibioticInterval();
  }

  planChunk(distanceMeters: number, antibioticReadiness: Readonly<Record<AntibioticType, boolean>>): PlannedChunk {
    const { spawning, mdr } = this.balance;
    const difficulty = getDifficulty(distanceMeters, this.balance);
    const chunkIndex = this.chunkCount;
    const isFirstChunk = chunkIndex === 0;
    this.chunkCount += 1;

    const jitter = 1 + spawning.spawnIntervalJitter * (this.rng() * 2 - 1);
    let leadingGap = isFirstChunk
      ? spawning.firstHazardDelaySeconds
      : difficulty.spawnIntervalSeconds * jitter;
    if (this.breathingWindowPending) {
      leadingGap = Math.max(leadingGap, spawning.breathingWindowDurationSeconds);
      this.breathingWindowPending = false;
    }
    leadingGap = Math.max(
      leadingGap,
      spawning.minimumReactionWindowSeconds,
      this.requiredLeadingGap,
    );

    const spawnMdr = !isFirstChunk && this.shouldSpawnMdr(distanceMeters, difficulty);
    const items: PlannedItem[] = [];
    let hazards: PlannedHazard[];
    let patternId: PlannedPatternId;

    if (spawnMdr) {
      const mdrTime = leadingGap + Math.max(mdr.clearanceSeconds, spawning.minimumReactionWindowSeconds);
      hazards = [
        {
          kind: 'bacterium',
          time: leadingGap,
          bacterium: pickRandom(this.rng, TREATABLE_TYPES),
          lane: pickRandom(this.rng, MDR_LANES),
          trajectory: this.pickTrajectory(difficulty),
        },
        {
          kind: 'bacterium',
          time: mdrTime,
          bacterium: 'mdr',
          lane: pickRandom(this.rng, MDR_LANES),
          trajectory: 'straight',
        },
      ];
      this.lastMdrDistance = distanceMeters;
      this.requiredLeadingGap = mdr.clearanceSeconds;
      patternId = 'mdrSequence';
    } else {
      let selectedPatternId: ObstaclePatternId | 'opening';
      if (isFirstChunk) {
        selectedPatternId = 'opening';
      } else if (
        chunkIndex === 1 &&
        distanceMeters >= spawning.patternWeights.jumpThenCrouch.unlockDistance &&
        difficulty.highLaneUnlocked &&
        difficulty.doublePatternsUnlocked
      ) {
        selectedPatternId = 'jumpThenCrouch';
      } else {
        selectedPatternId = this.selectPattern(distanceMeters, difficulty);
      }
      patternId = selectedPatternId;
      hazards = this.planTreatableHazards(selectedPatternId, leadingGap, difficulty);
      this.requiredLeadingGap = spawning.minimumReactionWindowSeconds;
    }
    items.push(...hazards);

    let leadingSlotUsed = false;
    if (distanceMeters >= this.nextAntibioticDistance) {
      const antibiotic = this.planAntibiotic(hazards, leadingGap, antibioticReadiness);
      if (antibiotic) {
        items.push(antibiotic);
        leadingSlotUsed = true;
      }
      this.nextAntibioticDistance = distanceMeters + this.rollAntibioticInterval();
    }

    if (!spawnMdr && !isFirstChunk && this.rng() < this.balance.cookies.chancePerPattern) {
      items.push(...this.planCookies(hazards, leadingGap, leadingSlotUsed));
    }

    const duration = hazards.reduce((max, hazard) => Math.max(max, hazard.time), leadingGap);
    const breathingFrequency = Math.max(1, spawning.breathingWindowEveryChunks);
    this.breathingWindowPending = this.chunkCount % breathingFrequency === 0;
    return { items: items.sort((a, b) => a.time - b.time), duration, hasMdr: spawnMdr, patternId };
  }

  private shouldSpawnMdr(distanceMeters: number, difficulty: DifficultySnapshot): boolean {
    if (!difficulty.mdrUnlocked) return false;
    if (this.lastMdrDistance === null) return true;
    if (distanceMeters - this.lastMdrDistance < this.balance.mdr.minSpacingMeters) return false;
    return this.rng() < difficulty.mdrProbability;
  }

  private selectPattern(distanceMeters: number, difficulty: DifficultySnapshot): ObstaclePatternId {
    const availableLanes: HazardLane[] = ['ground'];
    if (difficulty.highLaneUnlocked) availableLanes.push('high');
    if (difficulty.skyLaneUnlocked) availableLanes.push('sky');

    const candidates = (Object.keys(PATTERN_STEPS) as ObstaclePatternId[])
      .filter((id) => {
        const config = this.balance.spawning.patternWeights[id];
        const steps = PATTERN_STEPS[id];
        return (
          distanceMeters >= config.unlockDistance &&
          steps.every((step) => availableLanes.includes(step.lane)) &&
          (steps.length === 1 || difficulty.doublePatternsUnlocked) &&
          (steps.length < 3 || difficulty.triplePatternsUnlocked)
        );
      })
      .map((id) => {
        const config = this.balance.spawning.patternWeights[id];
        return { value: id, weight: lerp(config.initialWeight, config.maxWeight, difficulty.level) };
      });

    return pickWeighted(this.rng, candidates);
  }

  private planTreatableHazards(
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

    const steps = PATTERN_STEPS[patternId];
    const lanes: HazardLane[] = ['ground'];
    if (difficulty.highLaneUnlocked) lanes.push('high');
    if (difficulty.skyLaneUnlocked) lanes.push('sky');
    const gap = Math.max(
      this.balance.spawning.minimumReactionWindowSeconds,
      lerp(this.balance.spawning.initialPatternGapSeconds, this.balance.spawning.minimumReactionWindowSeconds, difficulty.level) +
        (this.rng() * 2 - 1) * this.balance.spawning.patternGapJitterSeconds,
    );

    return steps.map((step, index) => ({
      kind: 'bacterium',
      time: leadingGap + index * gap,
      bacterium: step.bacterium ?? pickRandom(this.rng, TREATABLE_TYPES),
      lane: patternId === 'single' ? pickRandom(this.rng, lanes) : step.lane,
      trajectory: this.pickTrajectory(difficulty),
    }));
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
  ): PlannedAntibiotic | null {
    const missing = ANTIBIOTIC_TYPES.filter((type) => !readiness[type]);
    const antibiotic =
      missing.length > 0 && this.rng() < this.balance.antibiotics.preferMissingChance
        ? pickRandom(this.rng, missing)
        : pickRandom(this.rng, ANTIBIOTIC_TYPES);
    const groundHazard = hazards.find((hazard) => hazard.lane === 'ground');
    const candidates: PlannedAntibiotic[] = [];
    if (groundHazard && this.rng() < this.balance.antibiotics.riskPlacementChance) {
      candidates.push({
        kind: 'antibiotic',
        time: groundHazard.time - this.balance.antibiotics.riskOffsetSeconds,
        lane: 'jump',
        antibiotic,
      });
    }
    candidates.push({ kind: 'antibiotic', time: leadingGap / 2, lane: 'run', antibiotic });
    if (leadingGap >= this.balance.antibiotics.jumpPickupMinGapSeconds) {
      candidates.push({ kind: 'antibiotic', time: leadingGap / 2, lane: 'jump', antibiotic });
    }

    return candidates.find(
      (candidate) =>
        candidate.time >= this.balance.spawning.collectableClearanceSeconds &&
        hazards.every((hazard) =>
          !collectableConflictsWithHazard(candidate, hazard, this.balance.spawning.collectableClearanceSeconds),
        ),
    ) ?? null;
  }

  private planCookies(hazards: readonly PlannedHazard[], leadingGap: number, leadingSlotUsed: boolean): PlannedCookie[] {
    const groundHazards = hazards.filter((hazard) => hazard.lane === 'ground');
    const rowLength = randomInt(this.rng, 1, Math.max(1, this.balance.cookies.maxRowLength));
    const useArc =
      groundHazards.length > 0 && (leadingSlotUsed || this.rng() < this.balance.cookies.jumpArcChance);

    let candidates: PlannedCookie[];
    if (useArc) {
      const target = pickRandom(this.rng, groundHazards);
      const riskOffset =
        this.rng() < this.balance.cookies.riskPlacementChance ? this.balance.cookies.riskOffsetSeconds : 0;
      candidates = this.makeRow(target.time - riskOffset, rowLength, 'jump');
    } else if (!leadingSlotUsed) {
      candidates = this.makeRow(leadingGap / 2, rowLength, 'run');
    } else {
      return [];
    }

    // Time 0 is the previous chunk's last hazard; its lane is unknown here, so treat it as
    // conflicting with every collectable lane.
    const clearance = this.balance.spawning.collectableClearanceSeconds;
    return candidates.filter(
      (cookie) =>
        cookie.time >= clearance - EPSILON &&
        hazards.every((hazard) => !collectableConflictsWithHazard(cookie, hazard, clearance)),
    );
  }

  private makeRow(centerTime: number, length: number, lane: CollectableLane): PlannedCookie[] {
    const cookies: PlannedCookie[] = [];
    for (let index = 0; index < length; index += 1) {
      const offset = (index - (length - 1) / 2) * this.balance.cookies.rowSpacingSeconds;
      cookies.push({ kind: 'cookie', time: centerTime + offset, lane });
    }
    return cookies;
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
  if (collectable.lane === 'run') return hazard.lane === 'ground';
  return hazard.lane !== 'ground';
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
    const required = involvesMdr ? balance.mdr.clearanceSeconds : balance.spawning.minimumReactionWindowSeconds;
    if (gap < required - EPSILON) {
      violations.push({ time: current.time, reason: `Hazard gap ${gap.toFixed(3)}s < ${required}s` });
    }
    if (current.bacterium === 'mdr' && current.lane === 'sky') {
      violations.push({ time: current.time, reason: 'MDR in sky lane' });
    }
  }

  for (const collectable of collectables) {
    for (const hazard of hazards) {
      if (collectableConflictsWithHazard(collectable, hazard, balance.spawning.collectableClearanceSeconds)) {
        violations.push({ time: collectable.time, reason: `${collectable.kind} conflicts with ${hazard.lane} hazard` });
      }
    }
  }
  return violations;
}
