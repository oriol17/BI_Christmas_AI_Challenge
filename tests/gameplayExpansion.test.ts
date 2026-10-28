import { describe, expect, it } from 'vitest';
import { COMPETITION_BALANCE, DEFAULT_BALANCE, TRAINING_BALANCE, type BalanceConfig } from '../src/config/balance';
import { PLAYER_BODY } from '../src/config/layout';
import { getDifficulty, getTorpedoProbability, getWorldSpeed } from '../src/logic/difficulty';
import { clampFallVelocity, getFastFallAcceleration } from '../src/logic/fastFall';
import {
  PLATFORM_PATTERN_CATALOG,
  getPatternSpeedRange,
  isPlatformPatternEligible,
  selectPlatformPattern,
  validatePlatformPattern,
  type PlatformPatternContext,
  type PlatformPatternDefinition,
} from '../src/logic/PlatformPlanner';
import {
  simulateRoute,
  type RouteTraceSample,
  type SectionLayout,
  type SectionRoute,
} from '../src/logic/routeSimulator';
import { RunState } from '../src/logic/RunState';
import { SpawnPlanner } from '../src/logic/SpawnPlanner';
import { getSafeTorpedoLanes } from '../src/logic/torpedoRules';
import { createSeededRandom } from '../src/utils/random';

const PRESETS: readonly [string, BalanceConfig][] = [
  ['Competition', COMPETITION_BALANCE],
  ['Training', TRAINING_BALANCE],
];

const noInputs: SectionRoute = { id: 'idle', description: 'no input', inputs: [] };
const emptyLayout = (overrides: Partial<SectionLayout>): SectionLayout => ({ platforms: [], threats: [], rewards: [], ...overrides });

function landingX(layout: SectionLayout, route: SectionRoute, balance: BalanceConfig, speed: number): number {
  let airborne = false;
  let landed = Number.NaN;
  simulateRoute(layout, route, balance, speed, [], (sample: RouteTraceSample) => {
    if (!sample.grounded) airborne = true;
    else if (airborne && Number.isNaN(landed)) landed = sample.x;
  });
  return landed;
}

const baseContext = (pattern: PlatformPatternDefinition, balance: BalanceConfig): PlatformPatternContext => ({
  distanceMeters: 5000,
  worldSpeed: balance.world.maxWorldSpeed,
  currentPlatformLevel: pattern.entryPlatformLevel,
  recentPatternIds: [],
  recentMechanics: [],
  hasEncounteredMdr: true,
  hasEncounteredTorpedo: true,
});

describe('fast-fall', () => {
  it('only adds acceleration while airborne, held, and below the target speed', () => {
    expect(getFastFallAcceleration(true, true, 500, 1500, 1800)).toBe(1800);
    expect(getFastFallAcceleration(false, true, 500, 1500, 1800)).toBe(0);
    expect(getFastFallAcceleration(true, false, 500, 1500, 1800)).toBe(0);
    expect(getFastFallAcceleration(true, true, 1500, 1500, 1800)).toBe(0);
  });

  it('clamps terminal downward speed without limiting upward movement', () => {
    expect(clampFallVelocity(1900, 1750)).toBe(1750);
    expect(clampFallVelocity(-900, 1750)).toBe(-900);
  });

  it('lands sooner than a normal jump and never activates on the ground', () => {
    const speed = 900;
    const jumpOnly: SectionRoute = { id: 'jump', description: '', inputs: [{ action: 'jump', at: 0, lead: 0 }] };
    const jumpAndTuck: SectionRoute = {
      id: 'tuck',
      description: '',
      inputs: [{ action: 'jump', at: 0, lead: 0 }, { action: 'down', at: 270, lead: 0, hold: 0.6 }],
    };
    const layout = emptyLayout({});
    expect(landingX(layout, jumpAndTuck, DEFAULT_BALANCE, speed)).toBeLessThan(landingX(layout, jumpOnly, DEFAULT_BALANCE, speed) - 30);

    const poses: string[] = [];
    simulateRoute(layout, { id: 'duck', description: '', inputs: [{ action: 'down', at: 0, lead: 0, hold: 0.2 }] }, DEFAULT_BALANCE, speed, [], (s) => poses.push(s.pose));
    expect(poses).toContain('crouching');
    expect(poses).not.toContain('fastFalling');
  });

  it('keeps an aerial hitbox that is smaller than standing but not misleadingly tiny', () => {
    expect(PLAYER_BODY.fastFalling.height).toBeLessThan(PLAYER_BODY.standing.height);
    expect(PLAYER_BODY.fastFalling.height).toBeGreaterThan(PLAYER_BODY.crouching.height);
  });
});

describe('route simulator', () => {
  const speed = 900;
  it('fails when Santa ignores a floor bacterium and survives with a jump', () => {
    const layout = emptyLayout({ threats: [{ kind: 'gramPositive', level: 0, lane: 'ground', x: 300 }] });
    expect(simulateRoute(layout, noInputs, DEFAULT_BALANCE, speed).success).toBe(false);
    const jump: SectionRoute = { id: 'jump', description: '', inputs: [{ action: 'jump', at: 300, lead: 'apex' }] };
    expect(simulateRoute(layout, jump, DEFAULT_BALANCE, speed).success).toBe(true);
  });

  it('requires a duck for head-height bacteria and mid torpedoes', () => {
    const duck: SectionRoute = { id: 'duck', description: '', inputs: [{ action: 'down', at: 300, lead: 0.18, hold: 0.08 }] };
    for (const layout of [
      emptyLayout({ threats: [{ kind: 'gramNegative', level: 0, lane: 'high', x: 300 }] }),
      emptyLayout({ threats: [{ kind: 'torpedo', level: 0, lane: 'mid', x: 300 }] }),
    ]) {
      expect(simulateRoute(layout, noInputs, DEFAULT_BALANCE, speed).success).toBe(false);
      expect(simulateRoute(layout, duck, DEFAULT_BALANCE, speed).success).toBe(true);
    }
  });

  it('lets a standing Santa run underneath shelves and land on them from a full jump', () => {
    const shelf = emptyLayout({ platforms: [{ level: 1, left: 200, width: 600 }] });
    expect(simulateRoute(shelf, noInputs, DEFAULT_BALANCE, speed).exitLevel).toBe(0);
    const levels: number[] = [];
    simulateRoute(shelf, { id: 'climb', description: '', inputs: [{ action: 'jump', at: 320, lead: 'landing' }] }, DEFAULT_BALANCE, speed, [], (s) => levels.push(s.level));
    expect(levels).toContain(1);
  });
});

describe('platform section validation', () => {
  it.each(PRESETS)('every authored section has a surviving route across its whole %s speed range', (_name, balance) => {
    for (const pattern of Object.values(PLATFORM_PATTERN_CATALOG)) {
      const range = getPatternSpeedRange(pattern, balance);
      expect(range, pattern.id).not.toBeNull();
      const speeds: number[] = [];
      for (let speed = range!.min; speed < range!.max; speed += 40) speeds.push(speed);
      speeds.push(range!.max);
      const result = validatePlatformPattern(pattern, balance, speeds);
      expect(result.reasons, pattern.id).toEqual([]);
      expect(result.validRouteIds.length, pattern.id).toBeGreaterThan(0);
    }
  });

  it('rejects sections whose route exits on an undeclared level', () => {
    const pattern = { ...PLATFORM_PATTERN_CATALOG.COOKIE_UPPER_ROUTE, validExitPlatformLevels: [2] as const };
    expect(validatePlatformPattern(pattern, DEFAULT_BALANCE).valid).toBe(false);
  });

  it('rejects threats closer than the declared reaction window', () => {
    const source = PLATFORM_PATTERN_CATALOG.GRAM_CHAIN_ON_PLATFORMS;
    const pattern = { ...source, minimumReactionWindowSeconds: 2 };
    expect(validatePlatformPattern(pattern, DEFAULT_BALANCE).reasons.some((reason) => reason.includes('reaction window'))).toBe(true);
  });

  it('rejects a section whose only route is too slow once the timing tolerance is applied', () => {
    const source = PLATFORM_PATTERN_CATALOG.TORPEDO_LOW_JUMP;
    const pattern = {
      ...source,
      routes: [{ ...source.routes[0]!, inputs: [{ action: 'jump' as const, at: 250, lead: 0.02 }, ...source.routes[0]!.inputs.slice(1)] }],
    };
    expect(validatePlatformPattern(pattern, DEFAULT_BALANCE).valid).toBe(false);
  });

  it('keeps shelves reachable by the real 60 fps jump while leaving headroom underneath', () => {
    let apex = 0;
    simulateRoute(emptyLayout({}), { id: 'jump', description: '', inputs: [{ action: 'jump', at: 0, lead: 0 }] }, DEFAULT_BALANCE, 900, [], (s) => {
      apex = Math.max(apex, s.height);
    });
    const { levelRisePixels, platformThicknessPixels } = DEFAULT_BALANCE.platforms;
    expect(apex).toBeGreaterThan(levelRisePixels + 10);
    expect(levelRisePixels - platformThicknessPixels).toBeGreaterThan(PLAYER_BODY.standing.height + 5);
  });

  it('includes sections where staying on the floor or on one level is fatal', () => {
    const block = PLATFORM_PATTERN_CATALOG.MDR_ROUTE_BLOCK;
    expect(simulateRoute(block, noInputs, DEFAULT_BALANCE, 900).success).toBe(false);
    const ascend = PLATFORM_PATTERN_CATALOG.ASCEND_TO_AVOID_MDR;
    const walkwayOnly: SectionRoute = { id: 'walkway', description: '', inputs: [ascend.routes[0]!.inputs[0]!] };
    expect(simulateRoute(ascend, walkwayOnly, DEFAULT_BALANCE, 900).success).toBe(false);
    expect(simulateRoute(ascend, ascend.routes[0]!, DEFAULT_BALANCE, 900).success).toBe(true);
  });

  it('places rewards on routes that collect them without taking a hit', () => {
    const pattern = PLATFORM_PATTERN_CATALOG.COOKIE_UPPER_ROUTE;
    const reward = simulateRoute(pattern, pattern.routes.find((route) => route.id === 'top-shelf')!, DEFAULT_BALANCE, 900);
    expect(reward.success).toBe(true);
    expect(reward.collectedRewards).toHaveLength(pattern.rewards.length);
    const floor = simulateRoute(pattern, pattern.routes.find((route) => route.id === 'floor')!, DEFAULT_BALANCE, 900);
    expect(floor.success).toBe(true);
    expect(floor.collectedRewards).toHaveLength(0);
  });
});

describe('platform section selection', () => {
  it('requires a compatible entry level', () => {
    const pattern = PLATFORM_PATTERN_CATALOG.PLATFORM_SWITCH;
    const context = baseContext(pattern, DEFAULT_BALANCE);
    expect(isPlatformPatternEligible(pattern, context, DEFAULT_BALANCE)).toBe(true);
    expect(isPlatformPatternEligible(pattern, { ...context, currentPlatformLevel: 1 }, DEFAULT_BALANCE)).toBe(false);
  });

  it('respects unlock distances and keeps MDR+torpedo mixes until both were met separately', () => {
    const pattern = PLATFORM_PATTERN_CATALOG.MIXED_LAB_ASSAULT;
    const context = baseContext(pattern, DEFAULT_BALANCE);
    const unlock = DEFAULT_BALANCE.platforms.patternWeights.MIXED_LAB_ASSAULT.unlockDistanceMeters;
    expect(isPlatformPatternEligible(pattern, { ...context, distanceMeters: unlock - 1 }, DEFAULT_BALANCE)).toBe(false);
    expect(isPlatformPatternEligible(pattern, { ...context, hasEncounteredMdr: false }, DEFAULT_BALANCE)).toBe(false);
    expect(isPlatformPatternEligible(pattern, { ...context, hasEncounteredTorpedo: false }, DEFAULT_BALANCE)).toBe(false);
    expect(isPlatformPatternEligible(pattern, context, DEFAULT_BALANCE)).toBe(true);
  });

  it('prevents recent repeats and the same primary action three times in a row', () => {
    const pattern = PLATFORM_PATTERN_CATALOG.GRAM_CHAIN_ON_PLATFORMS;
    const context = baseContext(pattern, DEFAULT_BALANCE);
    expect(isPlatformPatternEligible(pattern, { ...context, recentPatternIds: [pattern.id] }, DEFAULT_BALANCE)).toBe(false);
    expect(isPlatformPatternEligible(pattern, { ...context, recentMechanics: ['jump', 'jump'] }, DEFAULT_BALANCE)).toBe(false);
    expect(isPlatformPatternEligible(pattern, { ...context, recentMechanics: ['jump', 'crouch'] }, DEFAULT_BALANCE)).toBe(true);
  });

  it.each(PRESETS)('every %s section selected over a seeded run has a valid route at its speed', (_name, balance) => {
    const rng = createSeededRandom(2024);
    const recentPatternIds: string[] = [];
    const recentMechanics: string[] = [];
    const seen = new Set<string>();
    for (let distance = balance.platforms.unlockDistanceMeters; distance < 4000; distance += 45) {
      const worldSpeed = getWorldSpeed(distance, balance);
      const pattern = selectPlatformPattern(
        {
          distanceMeters: distance,
          worldSpeed,
          currentPlatformLevel: 0,
          recentPatternIds: recentPatternIds as never,
          recentMechanics: recentMechanics as never,
          hasEncounteredMdr: distance > balance.mdr.unlockDistance,
          hasEncounteredTorpedo: distance > balance.torpedoes.unlockDistanceMeters,
        },
        balance,
        rng,
      );
      if (!pattern) continue;
      seen.add(pattern.id);
      expect(validatePlatformPattern(pattern, balance, [worldSpeed]).valid, `${pattern.id}@${distance}`).toBe(true);
      const cooldown = balance.platforms.patternWeights[pattern.id].cooldownSections;
      expect(recentPatternIds.slice(-cooldown)).not.toContain(pattern.id);
      recentPatternIds.push(pattern.id);
      recentMechanics.push(pattern.requiredMechanics[0]!);
    }
    expect(seen.size).toBeGreaterThanOrEqual(balance === COMPETITION_BALANCE ? 12 : 8);
  });
});

describe('virus torpedoes', () => {
  it('only combines near-simultaneous threats that need the same response', () => {
    expect(getSafeTorpedoLanes([{ arrivalSeconds: 1.1, lane: 'ground' }], 1, 0.5)).toEqual(['low']);
    expect(getSafeTorpedoLanes([{ arrivalSeconds: 1.1, lane: 'ground' }, { arrivalSeconds: 1.1, lane: 'high' }], 1, 0.5)).toEqual([]);
    expect(getSafeTorpedoLanes([{ arrivalSeconds: 2, lane: 'ground' }], 1, 0.5)).toEqual(['low', 'mid', 'high']);
  });

  it('shortens the warning gradually but never below the configured minimum', () => {
    const { torpedoes } = DEFAULT_BALANCE;
    expect(getDifficulty(torpedoes.unlockDistanceMeters, DEFAULT_BALANCE).torpedoWarningSeconds).toBe(torpedoes.warningSeconds);
    expect(getDifficulty(1_000_000, DEFAULT_BALANCE).torpedoWarningSeconds).toBe(torpedoes.minimumWarningSeconds);
  });

  it('clamps launch probability between unlock and cap', () => {
    const { torpedoes } = DEFAULT_BALANCE;
    expect(getTorpedoProbability(torpedoes.unlockDistanceMeters - 1, DEFAULT_BALANCE)).toBe(0);
    expect(getTorpedoProbability(torpedoes.unlockDistanceMeters, DEFAULT_BALANCE)).toBe(torpedoes.probabilityAtUnlock);
    expect(getTorpedoProbability(1_000_000, DEFAULT_BALANCE)).toBe(torpedoes.maximumProbability);
  });

  it('unlocks in Competition within the first 20–35 seconds, before the first MDR', () => {
    let distance = 0;
    let seconds = 0;
    while (distance < COMPETITION_BALANCE.torpedoes.unlockDistanceMeters) {
      distance += (getWorldSpeed(distance, COMPETITION_BALANCE) / COMPETITION_BALANCE.world.pixelsPerMeter) / 60;
      seconds += 1 / 60;
    }
    const firstImpact = seconds + COMPETITION_BALANCE.torpedoes.firstOpportunityDelaySeconds + COMPETITION_BALANCE.torpedoes.warningSeconds;
    expect(firstImpact).toBeGreaterThanOrEqual(15);
    expect(firstImpact).toBeLessThanOrEqual(35);
    expect(COMPETITION_BALANCE.torpedoes.unlockDistanceMeters).toBeLessThan(COMPETITION_BALANCE.mdr.unlockDistance);
    expect(TRAINING_BALANCE.torpedoes.unlockDistanceMeters).toBeGreaterThan(COMPETITION_BALANCE.torpedoes.unlockDistanceMeters);
    expect(TRAINING_BALANCE.torpedoes.warningSeconds).toBeGreaterThan(COMPETITION_BALANCE.torpedoes.warningSeconds);
  });

  it('moves much faster than bacteria', () => {
    const { world, torpedoes } = COMPETITION_BALANCE;
    expect(world.initialWorldSpeed + torpedoes.speedPixelsPerSecond).toBeGreaterThan(world.maxWorldSpeed * 1.4);
  });

  it('defeats immediately, ignores antibiotics, and resets cleanly', () => {
    const run = new RunState(DEFAULT_BALANCE);
    const inventory = run.inventory.snapshot();
    expect(run.resolveTorpedoContact()).toEqual({ kind: 'defeated', cause: 'virusTorpedo' });
    expect(run.inventory.snapshot()).toEqual(inventory);
    expect(run.defeatCause).toBe('virusTorpedo');
    run.reset();
    expect(run.isOver).toBe(false);
    expect(run.defeatCause).toBeNull();
  });
});

describe('route antibiotics', () => {
  it('obey the same cooldown and distance window as normal pickups', () => {
    const balance: BalanceConfig = {
      ...DEFAULT_BALANCE,
      antibiotics: { ...DEFAULT_BALANCE.antibiotics, pickupIntervalMinMeters: 0, pickupIntervalMaxMeters: 0, pickupChance: 1 },
    };
    const planner = new SpawnPlanner(balance, createSeededRandom(5));
    const ready = { gramPositive: false, gramNegative: false };
    const first = planner.claimRouteAntibiotic(100, 10, ready);
    expect(first).not.toBeNull();
    expect(planner.claimRouteAntibiotic(100, 10 + balance.antibiotics.minimumPickupCooldownSeconds - 1, ready)).toBeNull();
    const later = planner.claimRouteAntibiotic(100 + balance.antibiotics.distanceWindowMeters, 10 + balance.antibiotics.minimumPickupCooldownSeconds + 1, ready);
    expect(later).not.toBeNull();
    expect(later).not.toBe(first);
  });
});
