import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../src/config/balance';
import { getWorldSpeed } from '../src/logic/difficulty';
import {
  findTimelineViolations,
  isHazard,
  SpawnPlanner,
  type PlannedItem,
} from '../src/logic/SpawnPlanner';
import type { AntibioticType } from '../src/types/game';
import { createSeededRandom } from '../src/utils/random';

interface SimulatedRun {
  readonly timeline: PlannedItem[];
  readonly firstMdrDistance: number | null;
  readonly mdrCount: number;
  readonly hazardCount: number;
  readonly antibioticTypesWhenMissing: AntibioticType[];
}

/** Chains planner chunks along an approximate distance axis, like the in-game director does. */
function simulateRun(seed: number, maxDistance: number, readiness: Record<AntibioticType, boolean>): SimulatedRun {
  const planner = new SpawnPlanner(DEFAULT_BALANCE, createSeededRandom(seed));
  const timeline: PlannedItem[] = [];
  let time = 0;
  let distance = 0;
  let firstMdrDistance: number | null = null;
  let mdrCount = 0;
  let hazardCount = 0;
  const antibioticTypesWhenMissing: AntibioticType[] = [];

  while (distance < maxDistance) {
    const chunk = planner.planChunk(distance, readiness);
    for (const item of chunk.items) {
      timeline.push({ ...item, time: time + item.time });
      if (isHazard(item)) {
        hazardCount += 1;
        if (item.bacterium === 'mdr') {
          mdrCount += 1;
          firstMdrDistance ??= distance;
        }
      } else if (item.kind === 'antibiotic') {
        antibioticTypesWhenMissing.push(item.antibiotic);
      }
    }
    time += chunk.duration;
    const speed = getWorldSpeed(distance, DEFAULT_BALANCE);
    distance += (chunk.duration * speed) / DEFAULT_BALANCE.world.pixelsPerMeter;
  }
  return { timeline, firstMdrDistance, mdrCount, hazardCount, antibioticTypesWhenMissing };
}

describe('SpawnPlanner fairness', () => {
  it('never produces unavoidable hazard sequences or trapped collectables', () => {
    for (let seed = 1; seed <= 60; seed += 1) {
      const run = simulateRun(seed, 6000, { gramPositive: true, gramNegative: false });
      expect(findTimelineViolations(run.timeline, DEFAULT_BALANCE)).toEqual([]);
    }
  });

  it('introduces the first MDR at the configured distance and keeps it uncommon', () => {
    let totalMdr = 0;
    let totalHazards = 0;
    for (let seed = 1; seed <= 40; seed += 1) {
      const run = simulateRun(seed, 8000, { gramPositive: true, gramNegative: true });
      if (run.firstMdrDistance !== null) {
        expect(run.firstMdrDistance).toBeGreaterThanOrEqual(DEFAULT_BALANCE.mdr.unlockDistance);
      }
      totalMdr += run.mdrCount;
      totalHazards += run.hazardCount;
    }
    expect(totalMdr).toBeGreaterThan(0);
    expect(totalMdr / totalHazards).toBeLessThan(0.12);
  });

  it('introduces both jump and crouch in a deliberate early pattern', () => {
    const planner = new SpawnPlanner(DEFAULT_BALANCE, createSeededRandom(17));
    const opening = planner.planChunk(0, { gramPositive: true, gramNegative: true });
    const earlyPattern = planner.planChunk(20, { gramPositive: true, gramNegative: true });
    const openingHazards = opening.items.filter(isHazard);
    const earlyHazards = earlyPattern.items.filter(isHazard);

    expect(opening.patternId).toBe('opening');
    expect(openingHazards.map((hazard) => hazard.lane)).toEqual(['ground']);
    expect(earlyPattern.patternId).toBe('jumpThenCrouch');
    expect(earlyHazards.map((hazard) => [hazard.lane, hazard.bacterium])).toEqual([
      ['ground', 'gramPositive'],
      ['high', 'gramNegative'],
    ]);
    expect(earlyHazards[1]!.time - earlyHazards[0]!.time).toBeGreaterThanOrEqual(
      DEFAULT_BALANCE.spawning.minimumReactionWindowSeconds,
    );
  });

  it('unlocks reusable mixed-action and triple patterns with distance', () => {
    const planner = new SpawnPlanner(DEFAULT_BALANCE, createSeededRandom(29));
    const seen = new Set<string>();
    for (let index = 0; index < 120; index += 1) {
      seen.add(planner.planChunk(5000, { gramPositive: true, gramNegative: true }).patternId);
    }

    expect(seen).toContain('jumpThenStay');
    expect(seen).toContain('stayThenCrouch');
    expect(seen).toContain('jumpCrouchJump');
    expect(seen).toContain('crouchJumpCrouch');
  });

  it('inserts a configured breathing window after a short sequence of patterns', () => {
    const planner = new SpawnPlanner(DEFAULT_BALANCE, createSeededRandom(31));
    for (let index = 0; index < DEFAULT_BALANCE.spawning.breathingWindowEveryChunks; index += 1) {
      planner.planChunk(20, { gramPositive: true, gramNegative: true });
    }
    const breathingChunk = planner.planChunk(20, { gramPositive: true, gramNegative: true });
    const firstHazard = breathingChunk.items.find(isHazard);

    expect(firstHazard?.time).toBeGreaterThanOrEqual(
      DEFAULT_BALANCE.spawning.breathingWindowDurationSeconds,
    );
  });

  it('pairs an early MDR warning with a preceding dodgeable bacterium', () => {
    const planner = new SpawnPlanner(DEFAULT_BALANCE, createSeededRandom(18));
    planner.planChunk(0, { gramPositive: true, gramNegative: true });
    const mdrChunk = planner.planChunk(DEFAULT_BALANCE.mdr.unlockDistance, {
      gramPositive: true,
      gramNegative: true,
    });
    const hazards = mdrChunk.items.filter(isHazard);

    expect(mdrChunk.patternId).toBe('mdrSequence');
    expect(hazards.map((hazard) => hazard.bacterium)).toContain('mdr');
    expect(hazards[0]!.bacterium).not.toBe('mdr');
    expect(hazards[1]!.time - hazards[0]!.time).toBeGreaterThanOrEqual(
      DEFAULT_BALANCE.mdr.clearanceSeconds,
    );
    expect(hazards.every((hazard) => hazard.lane !== 'sky')).toBe(true);
  });

  it('only uses ground lane hazards before the head-height lane unlocks', () => {
    const planner = new SpawnPlanner(DEFAULT_BALANCE, createSeededRandom(7));
    for (let index = 0; index < 50; index += 1) {
      const chunk = planner.planChunk(DEFAULT_BALANCE.spawning.unlocks.highLane - 1, {
        gramPositive: true,
        gramNegative: true,
      });
      for (const item of chunk.items) {
        if (isHazard(item)) {
          expect(item.lane).toBe('ground');
          expect(item.bacterium).not.toBe('mdr');
        }
      }
    }
  });

  it('gives a generous delay before the very first bacterium', () => {
    const planner = new SpawnPlanner(DEFAULT_BALANCE, createSeededRandom(3));
    const chunk = planner.planChunk(0, { gramPositive: true, gramNegative: true });
    const firstHazard = chunk.items.find(isHazard);
    expect(firstHazard?.time).toBeGreaterThanOrEqual(DEFAULT_BALANCE.spawning.firstHazardDelaySeconds);
  });

  it('prefers restocking the empty antibiotic slot', () => {
    const run = simulateRun(11, 20000, { gramPositive: true, gramNegative: false });
    const negative = run.antibioticTypesWhenMissing.filter((type) => type === 'gramNegative').length;
    expect(run.antibioticTypesWhenMissing.length).toBeGreaterThan(10);
    expect(negative / run.antibioticTypesWhenMissing.length).toBeGreaterThan(0.75);
  });

  it('is deterministic for a given seed', () => {
    const a = simulateRun(99, 3000, { gramPositive: true, gramNegative: true }).timeline;
    const b = simulateRun(99, 3000, { gramPositive: true, gramNegative: true }).timeline;
    expect(a).toEqual(b);
  });
});

describe('findTimelineViolations', () => {
  it('detects hazards that are too close together', () => {
    const violations = findTimelineViolations(
      [
        { kind: 'bacterium', time: 1, bacterium: 'gramPositive', lane: 'ground', trajectory: 'straight' },
        { kind: 'bacterium', time: 1.1, bacterium: 'gramNegative', lane: 'high', trajectory: 'straight' },
      ],
      DEFAULT_BALANCE,
    );
    expect(violations.length).toBe(1);
  });

  it('detects a cookie that can only be collected by touching a bacterium', () => {
    const violations = findTimelineViolations(
      [
        { kind: 'bacterium', time: 1, bacterium: 'gramPositive', lane: 'ground', trajectory: 'straight' },
        { kind: 'cookie', time: 1.05, lane: 'run' },
      ],
      DEFAULT_BALANCE,
    );
    expect(violations.length).toBe(1);
  });

  it('accepts a cookie arc above a ground bacterium', () => {
    const violations = findTimelineViolations(
      [
        { kind: 'bacterium', time: 1, bacterium: 'gramPositive', lane: 'ground', trajectory: 'straight' },
        { kind: 'cookie', time: 1, lane: 'jump' },
      ],
      DEFAULT_BALANCE,
    );
    expect(violations).toEqual([]);
  });
});
