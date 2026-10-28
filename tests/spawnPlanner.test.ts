import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, TRAINING_BALANCE, type BalanceConfig } from '../src/config/balance';
import { getWorldSpeed } from '../src/logic/difficulty';
import {
  findTimelineViolations,
  isHazard,
  SpawnPlanner,
  type PlannedHazard,
  type PlannedItem,
} from '../src/logic/SpawnPlanner';
import { simulateRoute, type RouteInput } from '../src/logic/routeSimulator';
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
function simulateRun(
  seed: number,
  maxDistance: number,
  readiness: Record<AntibioticType, boolean>,
  balance: BalanceConfig = DEFAULT_BALANCE,
): SimulatedRun {
  const planner = new SpawnPlanner(balance, createSeededRandom(seed));
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
    const speed = getWorldSpeed(distance, balance);
    distance += (chunk.duration * speed) / balance.world.pixelsPerMeter;
  }
  return { timeline, firstMdrDistance, mdrCount, hazardCount, antibioticTypesWhenMissing };
}

describe('SpawnPlanner fairness', () => {
  it('replays seeded Competition timelines through the movement simulator without a hit', () => {
    const speed = DEFAULT_BALANCE.world.maxWorldSpeed;
    for (let seed = 1; seed <= 12; seed += 1) {
      const planner = new SpawnPlanner(DEFAULT_BALANCE, createSeededRandom(seed));
      const hazards: PlannedHazard[] = [];
      let time = 0;
      for (let index = 0; index < 40; index += 1) {
        const chunk = planner.planChunk(1000 + index * 40, { gramPositive: true, gramNegative: true }, 'surge');
        for (const item of chunk.items) if (isHazard(item)) hazards.push({ ...item, time: time + item.time });
        time += chunk.duration;
      }
      const threats = hazards.map((hazard) => ({ kind: hazard.bacterium, level: 0 as const, lane: hazard.lane, x: hazard.time * speed }));
      const inputs: RouteInput[] = threats.flatMap((threat): RouteInput[] =>
        threat.lane === 'ground'
          ? [{ action: 'jump', at: threat.x, lead: 'apex' }]
          : threat.lane === 'high'
            ? [{ action: 'down', at: threat.x, lead: 0.18, hold: 0.08 }]
            : [],
      );
      const route = { id: 'reflex', description: 'jump ground, duck high, stay for sky', inputs };
      for (const shift of [0, 0.04, -0.04]) {
        const result = simulateRoute(
          { platforms: [], threats, rewards: [] },
          route,
          DEFAULT_BALANCE,
          speed,
          inputs.map(() => shift),
        );
        expect(result.failure, `seed ${seed} shift ${shift}`).toBeNull();
      }
    }
  });

  it('never produces unavoidable hazard sequences or trapped collectables', () => {
    for (let seed = 1; seed <= 60; seed += 1) {
      const run = simulateRun(seed, 6000, { gramPositive: true, gramNegative: false });
      const violations = findTimelineViolations(run.timeline, DEFAULT_BALANCE);
      expect(violations).toEqual([]);
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
    expect(earlyPattern.patternId).toBe('lowHigh');
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

    expect(seen).toContain('gramSwitch');
    expect(seen).toContain('cookieBait');
    expect(seen).toContain('falseRhythm');
    expect(seen).toContain('mixedHeightChain');
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

    expect(['mdrWarningJump', 'mdrWarningCrouch']).toContain(mdrChunk.patternId);
    expect(hazards.map((hazard) => hazard.bacterium)).toContain('mdr');
    expect(hazards[0]!.bacterium).not.toBe('mdr');
    expect(hazards[1]!.time - hazards[0]!.time).toBeGreaterThanOrEqual(
      DEFAULT_BALANCE.mdr.clearanceSeconds,
    );
    expect(hazards.every((hazard) => hazard.lane !== 'sky')).toBe(true);
  });

  it('places an antibiotic reward after its deliberate temptation pattern', () => {
    const balance = {
      ...DEFAULT_BALANCE,
      antibiotics: {
        ...DEFAULT_BALANCE.antibiotics,
        pickupIntervalMinMeters: 0,
        pickupIntervalMaxMeters: 0,
        minimumPickupCooldownSeconds: 0,
      },
    };
    const planner = new SpawnPlanner(balance, createSeededRandom(321));
    let rewardFound = false;
    for (let index = 0; index < 300; index += 1) {
      const chunk = planner.planChunk(5000 + index * 100, { gramPositive: true, gramNegative: true });
      if (chunk.patternId !== 'antibioticTemptation') continue;
      const pickup = chunk.items.find((item) => item.kind === 'antibiotic');
      if (!pickup) continue;
      const lastHazardTime = Math.max(...chunk.items.filter(isHazard).map((hazard) => hazard.time));
      expect(pickup.lane).toBe('run');
      expect(pickup.time).toBeGreaterThan(lastHazardTime);
      rewardFound = true;
      break;
    }
    expect(rewardFound).toBe(true);
  });

  it('enforces antibiotic pickup cooldown in planned run time', () => {
    const cooldownSeconds = 4;
    const balance = {
      ...DEFAULT_BALANCE,
      antibiotics: {
        ...DEFAULT_BALANCE.antibiotics,
        pickupIntervalMinMeters: 0,
        pickupIntervalMaxMeters: 0,
        minimumPickupCooldownSeconds: cooldownSeconds,
      },
    };
    const planner = new SpawnPlanner(balance, createSeededRandom(488));
    const pickupTimes: number[] = [];
    let plannedTime = 0;
    for (let index = 0; index < 120; index += 1) {
      const chunk = planner.planChunk(5000 + plannedTime * 50, { gramPositive: true, gramNegative: true });
      for (const item of chunk.items) {
        if (item.kind === 'antibiotic') pickupTimes.push(plannedTime + item.time);
      }
      plannedTime += chunk.duration;
    }
    expect(pickupTimes.length).toBeGreaterThan(2);
    for (let index = 1; index < pickupTimes.length; index += 1) {
      expect(pickupTimes[index]! - pickupTimes[index - 1]!).toBeGreaterThanOrEqual(cooldownSeconds);
    }
  });

  it('schedules a short multi-action rush before a present delivery', () => {
    const balance = {
      ...DEFAULT_BALANCE,
      mdr: { ...DEFAULT_BALANCE.mdr, minSpacingMeters: 1000 },
    };
    const planner = new SpawnPlanner(balance, () => 0);
    planner.planChunk(0, { gramPositive: true, gramNegative: true });
    planner.planChunk(balance.mdr.unlockDistance, { gramPositive: true, gramNegative: true });
    const rush = planner.planChunk(
      balance.deliveries.intervalMeters - balance.spawning.deliveryRushLeadMeters,
      { gramPositive: true, gramNegative: true },
    );
    expect(rush.patternId).toBe('deliveryRush');
    expect(rush.items.filter(isHazard)).toHaveLength(3);
  });

  it('tightens spawn spacing during surge phases without crossing the reaction floor', () => {
    // Competition already plays at the physics floor, so the surge effect is checked in Training.
    const readiness = { gramPositive: true, gramNegative: true };
    const active = new SpawnPlanner(TRAINING_BALANCE, createSeededRandom(51));
    const surge = new SpawnPlanner(TRAINING_BALANCE, createSeededRandom(51));
    active.planChunk(0, readiness);
    surge.planChunk(0, readiness);
    const activeChunk = active.planChunk(30, readiness, 'active');
    const surgeChunk = surge.planChunk(30, readiness, 'surge');
    const activeFirst = activeChunk.items.find(isHazard)!.time;
    const surgeFirst = surgeChunk.items.find(isHazard)!.time;
    expect(surgeFirst).toBeGreaterThanOrEqual(TRAINING_BALANCE.spawning.minimumReactionWindowSeconds);
    expect(surgeFirst).toBeLessThan(activeFirst);
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

  it('does not make refills strongly dependent on the empty slot', () => {
    const run = simulateRun(11, 20000, { gramPositive: true, gramNegative: false });
    const negative = run.antibioticTypesWhenMissing.filter((type) => type === 'gramNegative').length;
    expect(run.antibioticTypesWhenMissing.length).toBeGreaterThan(10);
    expect(negative / run.antibioticTypesWhenMissing.length).toBeGreaterThan(0.35);
    expect(negative / run.antibioticTypesWhenMissing.length).toBeLessThan(0.75);
  });

  it('keeps Competition antibiotic refills scarcer than Training over a long run', () => {
    let competitionPickups = 0;
    let trainingPickups = 0;
    for (let seed = 1; seed <= 12; seed += 1) {
      competitionPickups += simulateRun(
        seed,
        8000,
        { gramPositive: true, gramNegative: true },
        DEFAULT_BALANCE,
      ).antibioticTypesWhenMissing.length;
      trainingPickups += simulateRun(
        seed,
        8000,
        { gramPositive: true, gramNegative: true },
        TRAINING_BALANCE,
      ).antibioticTypesWhenMissing.length;
    }
    expect(trainingPickups).toBeGreaterThan(competitionPickups);
  });

  it('limits repeated identical patterns with cooldown and history', () => {
    const planner = new SpawnPlanner(DEFAULT_BALANCE, createSeededRandom(117));
    const sequence = Array.from({ length: 60 }, () =>
      planner.planChunk(5000, { gramPositive: true, gramNegative: true }).patternId,
    );
    for (let index = 2; index < sequence.length; index += 1) {
      expect(sequence[index] === sequence[index - 1] && sequence[index - 1] === sequence[index - 2]).toBe(false);
    }
  });

  it('spawns an early jump-then-crouch tutorial pattern and MDR by its configured unlock', () => {
    const planner = new SpawnPlanner(DEFAULT_BALANCE, createSeededRandom(22));
    planner.planChunk(0, { gramPositive: true, gramNegative: true });
    const pair = planner.planChunk(DEFAULT_BALANCE.spawning.unlocks.highLane, {
      gramPositive: true,
      gramNegative: true,
    });
    expect(pair.patternId).toBe('lowHigh');
    expect(pair.items.filter(isHazard).map((hazard) => hazard.lane)).toEqual(['ground', 'high']);
    const mdr = planner.planChunk(DEFAULT_BALANCE.mdr.unlockDistance, {
      gramPositive: true,
      gramNegative: true,
    });
    expect(mdr.hasMdr).toBe(true);
    expect(mdr.items.filter(isHazard).some((hazard) => hazard.bacterium === 'mdr')).toBe(true);
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
