import type { BalanceConfig } from '../config/balance';
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

/**
 * A group of items scheduled relative to the previous chunk's last hazard (time 0).
 * `duration` is the time of the chunk's last hazard, so chunks can be chained.
 */
export interface PlannedChunk {
  readonly items: readonly PlannedItem[];
  readonly duration: number;
  readonly hasMdr: boolean;
}

export const REQUIRED_ACTION: Readonly<Record<HazardLane, RequiredAction>> = {
  ground: 'jump',
  high: 'crouch',
  sky: 'stay',
};

const MDR_LANES: readonly HazardLane[] = ['ground', 'high'];
const TREATABLE_TYPES: readonly TreatableBacteriumType[] = ['gramPositive', 'gramNegative'];
/** Spacing of cookies inside a row (s). */
const COOKIE_ROW_SPACING_SECONDS = 0.11;
/** Jump-height pickups that are not above a ground hazard need a roomy gap. */
const MIN_GAP_FOR_JUMP_PICKUP_SECONDS = 2.0;
const EPSILON = 1e-6;

export function isHazard(item: PlannedItem): item is PlannedHazard {
  return item.kind === 'bacterium';
}

/**
 * Produces fair obstacle chunks. All rules that guarantee avoidability live here so they
 * can be verified by unit tests without Phaser:
 * - consecutive hazards are at least `minHazardGapSeconds` apart;
 * - MDR bacteria have `mdr.clearanceSeconds` of empty space before and after;
 * - collectables never overlap a hazard that would force a hit to collect them.
 */
export class SpawnPlanner {
  private chunkCount = 0;
  private lastMdrDistance: number | null = null;
  private nextAntibioticDistance = 0;
  /** Minimum leading gap the next chunk must respect (depends on what ended the previous chunk). */
  private requiredLeadingGap = 0;

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
    this.nextAntibioticDistance = this.rollAntibioticInterval();
  }

  planChunk(distanceMeters: number, antibioticReadiness: Readonly<Record<AntibioticType, boolean>>): PlannedChunk {
    const { spawning, mdr } = this.balance;
    const difficulty = getDifficulty(distanceMeters, this.balance);
    const isFirstChunk = this.chunkCount === 0;
    this.chunkCount += 1;

    const jitter = 1 + spawning.spawnIntervalJitter * (this.rng() * 2 - 1);
    let leadingGap = isFirstChunk ? spawning.firstHazardDelaySeconds : difficulty.spawnIntervalSeconds * jitter;
    leadingGap = Math.max(leadingGap, spawning.minHazardGapSeconds, this.requiredLeadingGap);

    const spawnMdr = !isFirstChunk && this.shouldSpawnMdr(distanceMeters, difficulty);
    const items: PlannedItem[] = [];
    let hazards: PlannedHazard[];

    if (spawnMdr) {
      leadingGap = Math.max(leadingGap, mdr.clearanceSeconds);
      hazards = [
        { kind: 'bacterium', time: leadingGap, bacterium: 'mdr', lane: pickRandom(this.rng, MDR_LANES), trajectory: 'straight' },
      ];
      this.lastMdrDistance = distanceMeters;
      this.requiredLeadingGap = mdr.clearanceSeconds;
    } else {
      hazards = this.planTreatableHazards(leadingGap, difficulty);
      this.requiredLeadingGap = spawning.minHazardGapSeconds;
    }
    items.push(...hazards);

    let leadingSlotUsed = false;
    if (distanceMeters >= this.nextAntibioticDistance) {
      items.push(this.planAntibiotic(leadingGap, antibioticReadiness));
      leadingSlotUsed = true;
      this.nextAntibioticDistance = distanceMeters + this.rollAntibioticInterval();
    }

    if (!spawnMdr && !isFirstChunk && this.rng() < this.balance.cookies.chancePerPattern) {
      items.push(...this.planCookies(hazards, leadingGap, leadingSlotUsed));
    }

    const duration = hazards.reduce((max, hazard) => Math.max(max, hazard.time), leadingGap);
    return { items: items.sort((a, b) => a.time - b.time), duration, hasMdr: spawnMdr };
  }

  private shouldSpawnMdr(distanceMeters: number, difficulty: DifficultySnapshot): boolean {
    if (!difficulty.mdrUnlocked) return false;
    if (this.lastMdrDistance !== null && distanceMeters - this.lastMdrDistance < this.balance.mdr.minSpacingMeters) {
      return false;
    }
    return this.rng() < difficulty.mdrProbability;
  }

  private planTreatableHazards(leadingGap: number, difficulty: DifficultySnapshot): PlannedHazard[] {
    const count = pickWeighted(this.rng, [
      { value: 1, weight: 1 },
      { value: 2, weight: difficulty.doublePatternsUnlocked ? 0.3 + 0.5 * difficulty.level : 0 },
      { value: 3, weight: difficulty.triplePatternsUnlocked ? 0.15 + 0.25 * difficulty.level : 0 },
    ]);

    const lanes: HazardLane[] = ['ground'];
    if (difficulty.highLaneUnlocked) lanes.push('high');
    if (difficulty.skyLaneUnlocked) lanes.push('sky');

    const hazards: PlannedHazard[] = [];
    let time = leadingGap;
    for (let index = 0; index < count; index += 1) {
      if (index > 0) {
        const comfort = lerp(1.45, 1.0, difficulty.level);
        time += this.balance.spawning.minHazardGapSeconds * comfort + this.rng() * 0.25;
      }
      hazards.push({
        kind: 'bacterium',
        time,
        bacterium: pickRandom(this.rng, TREATABLE_TYPES),
        lane: pickRandom(this.rng, lanes),
        trajectory: this.pickTrajectory(difficulty),
      });
    }
    return hazards;
  }

  private pickTrajectory(difficulty: DifficultySnapshot): Trajectory {
    return pickWeighted(this.rng, [
      { value: 'straight' as const, weight: 1 },
      { value: 'bob' as const, weight: 0.45 },
      { value: 'lob' as const, weight: difficulty.lobUnlocked ? 0.4 : 0 },
    ]);
  }

  private planAntibiotic(
    leadingGap: number,
    readiness: Readonly<Record<AntibioticType, boolean>>,
  ): PlannedAntibiotic {
    const missing = ANTIBIOTIC_TYPES.filter((type) => !readiness[type]);
    const antibiotic =
      missing.length > 0 && this.rng() < this.balance.antibiotics.preferMissingChance
        ? pickRandom(this.rng, missing)
        : pickRandom(this.rng, ANTIBIOTIC_TYPES);
    const lane: CollectableLane =
      leadingGap >= MIN_GAP_FOR_JUMP_PICKUP_SECONDS && this.rng() < 0.3 ? 'jump' : 'run';
    return { kind: 'antibiotic', time: leadingGap / 2, lane, antibiotic };
  }

  private planCookies(hazards: readonly PlannedHazard[], leadingGap: number, leadingSlotUsed: boolean): PlannedCookie[] {
    const groundHazards = hazards.filter((hazard) => hazard.lane === 'ground');
    const rowLength = randomInt(this.rng, 1, Math.max(1, this.balance.cookies.maxRowLength));
    const useArc = groundHazards.length > 0 && (leadingSlotUsed || this.rng() < 0.55);

    let candidates: PlannedCookie[];
    if (useArc) {
      const target = pickRandom(this.rng, groundHazards);
      candidates = this.makeRow(target.time, rowLength, 'jump');
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
      const offset = (index - (length - 1) / 2) * COOKIE_ROW_SPACING_SECONDS;
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
    const required = involvesMdr ? balance.mdr.clearanceSeconds : balance.spawning.minHazardGapSeconds;
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
