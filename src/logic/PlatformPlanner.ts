import type { BalanceConfig, PlatformPatternId } from '../config/balance';
import { PLAYER_BODY } from '../config/layout';
import type { PlatformLevel } from '../types/game';
import type { RandomSource } from '../utils/random';
import { getDifficulty } from './difficulty';
import {
  PLATFORM_PATTERN_CATALOG,
  type PlatformMechanic,
  type PlatformPatternDefinition,
} from './platformPatterns';
import { resolveLeadSeconds, sectionLength, simulateRoute, type SectionRoute } from './routeSimulator';

export { PLATFORM_PATTERN_CATALOG, sectionLength };
export type { PlatformMechanic, PlatformPatternDefinition };

export interface PlatformRouteValidation {
  readonly valid: boolean;
  readonly reasons: readonly string[];
  /** Routes that survived at every checked speed with timing tolerance. */
  readonly validRouteIds: readonly string[];
  /** Diagnostic notes for declared routes that fail at some speed (not fatal if another route survives). */
  readonly routeNotes: readonly string[];
  readonly speedsChecked: readonly number[];
}

/** Speeds at which this pattern is offered under the given preset, or null if none. */
export function getPatternSpeedRange(
  pattern: PlatformPatternDefinition,
  balance: BalanceConfig,
): { readonly min: number; readonly max: number } | null {
  const weights = balance.platforms.patternWeights[pattern.id];
  const min = Math.max(pattern.minimumWorldSpeed, weights.minimumWorldSpeed, balance.world.initialWorldSpeed);
  const max = Math.min(pattern.maximumWorldSpeed, weights.maximumWorldSpeed, balance.world.maxWorldSpeed);
  return min <= max ? { min, max } : null;
}

function staticReasons(pattern: PlatformPatternDefinition, balance: BalanceConfig, maxSpeed: number): string[] {
  const reasons: string[] = [];
  const { player, platforms } = balance;
  const jumpApex = player.jumpVelocity ** 2 / (2 * player.gravity);
  if (platforms.levelRisePixels > jumpApex - platforms.minimumJumpClearancePixels) {
    reasons.push('Level rise is too close to Santa’s jump height.');
  }
  if (platforms.levelRisePixels - platforms.platformThicknessPixels < PLAYER_BODY.standing.height + platforms.headroomPixels) {
    reasons.push('Shelves are too low for Santa to run underneath.');
  }
  if (pattern.platforms.length === 0) reasons.push('Pattern has no platform geometry.');
  if (pattern.routes.length === 0) reasons.push('Pattern declares no valid action route.');
  let previousLevel: PlatformLevel = pattern.entryPlatformLevel;
  let previousRight = Number.NEGATIVE_INFINITY;
  for (const platform of pattern.platforms) {
    if (platform.width < platforms.minimumPlatformWidthPixels) reasons.push('Platform is narrower than its configured minimum.');
    if (platform.left < previousRight - platform.width) reasons.push('Platforms must be listed left to right.');
    if (platform.level - previousLevel > 1) reasons.push('A platform is more than one level above the previous route level.');
    const gap = platform.left - previousRight;
    if (Number.isFinite(gap) && gap > platforms.maximumPlatformGapPixels) reasons.push('Platform gap exceeds the configured maximum.');
    previousLevel = platform.level;
    previousRight = platform.left + platform.width;
  }
  const threats = [...pattern.threats].sort((a, b) => a.x - b.x);
  if (threats.some((threat) => threat.x < 0)) reasons.push('Threat placed before the section start.');
  for (let index = 1; index < threats.length; index += 1) {
    const gapSeconds = (threats[index]!.x - threats[index - 1]!.x) / maxSpeed;
    if (gapSeconds + 1e-6 < pattern.minimumReactionWindowSeconds) {
      reasons.push(`Threats ${index - 1}/${index} are closer than the declared reaction window.`);
    }
  }
  const hasTorpedo = pattern.threats.some((threat) => threat.kind === 'torpedo');
  // The live warning is max(pattern value, preset difficulty warning), so it never drops below the preset minimum.
  if (hasTorpedo && pattern.torpedoWarningTimingSeconds <= 0) {
    reasons.push('Torpedo pattern declares no warning time.');
  }
  if (pattern.mdrEligibility !== pattern.threats.some((threat) => threat.kind === 'mdr')) {
    reasons.push('mdrEligibility does not match the threat list.');
  }
  const rewardKinds = new Set(pattern.rewards.map((reward) => reward.kind));
  if (
    (pattern.pickupEligibility === 'none' && rewardKinds.size > 0) ||
    (pattern.pickupEligibility === 'cookie' && rewardKinds.has('antibiotic')) ||
    (pattern.pickupEligibility === 'risky-antibiotic' && !rewardKinds.has('antibiotic'))
  ) {
    reasons.push('Rewards do not match the declared pickup eligibility.');
  }
  return reasons;
}

function inputSpacingViolation(candidate: SectionRoute, balance: BalanceConfig, speed: number): boolean {
  const times = candidate.inputs
    .map((input) => input.at / speed - resolveLeadSeconds(input.lead, balance))
    .sort((a, b) => a - b);
  for (let index = 1; index < times.length; index += 1) {
    if (times[index]! - times[index - 1]! < balance.platforms.minimumInputSpacingSeconds - 1e-6) return true;
  }
  return false;
}

function timingVariants(inputCount: number, tolerance: number): number[][] {
  const variants: number[][] = [new Array<number>(inputCount).fill(0)];
  if (tolerance <= 0) return variants;
  variants.push(new Array<number>(inputCount).fill(tolerance), new Array<number>(inputCount).fill(-tolerance));
  for (let index = 0; index < inputCount; index += 1) {
    for (const shift of [tolerance, -tolerance]) {
      const variant = new Array<number>(inputCount).fill(0);
      variant[index] = shift;
      variants.push(variant);
    }
  }
  return variants;
}

/**
 * Checks geometry and then replays every declared route with the real movement rules at each
 * speed, including early/late input timing. A pattern is valid when, at every checked speed,
 * at least one route survives every timing variant and exits on a declared level, and every
 * reward is collected by a surviving route (rewards must never require taking a hit).
 */
export function validatePlatformPattern(
  pattern: PlatformPatternDefinition,
  balance: BalanceConfig,
  speeds?: readonly number[],
): PlatformRouteValidation {
  const range = getPatternSpeedRange(pattern, balance);
  if (!range) {
    return { valid: false, reasons: ['Pattern speed range does not overlap this preset.'], validRouteIds: [], routeNotes: [], speedsChecked: [] };
  }
  const checked = (speeds ?? [range.min, (range.min + range.max) / 2, range.max]).filter(
    (speed) => speed >= range.min - 1e-6 && speed <= range.max + 1e-6,
  );
  if (checked.length === 0) {
    return { valid: false, reasons: ['Requested speed is outside the pattern speed range.'], validRouteIds: [], routeNotes: [], speedsChecked: [] };
  }
  const reasons = staticReasons(pattern, balance, Math.max(...checked));
  const routeNotes: string[] = [];
  const failedRoutes = new Set<string>();
  const tolerance = balance.platforms.routeTimingToleranceSeconds;
  for (const speed of checked) {
    const survivors: SectionRoute[] = [];
    for (const candidate of pattern.routes) {
      let survived = true;
      if (inputSpacingViolation(candidate, balance, speed)) {
        routeNotes.push(`Route ${candidate.id} needs two inputs faster than the minimum input spacing at ${Math.round(speed)} px/s.`);
        failedRoutes.add(candidate.id);
        continue;
      }
      for (const shifts of timingVariants(candidate.inputs.length, tolerance)) {
        const result = simulateRoute(pattern, candidate, balance, speed, shifts);
        if (!result.success || !pattern.validExitPlatformLevels.includes(result.exitLevel)) {
          routeNotes.push(
            `Route ${candidate.id} fails at ${Math.round(speed)} px/s (shifts ${shifts.map((s) => s.toFixed(2)).join(',')}): ${
              result.failure ?? `exits on level ${result.exitLevel}`
            }`,
          );
          failedRoutes.add(candidate.id);
          survived = false;
          break;
        }
      }
      if (survived) survivors.push(candidate);
    }
    if (survivors.length === 0) reasons.push(`No route survives at ${Math.round(speed)} px/s.`);
    pattern.rewards.forEach((reward, index) => {
      const collected = survivors.some((candidate) =>
        simulateRoute(pattern, candidate, balance, speed).collectedRewards.includes(index),
      );
      if (!collected) reasons.push(`Reward ${index} (${reward.kind}) is not collected by a surviving route at ${Math.round(speed)} px/s.`);
    });
  }
  const validRouteIds = pattern.routes.filter((candidate) => !failedRoutes.has(candidate.id)).map((candidate) => candidate.id);
  return { valid: reasons.length === 0, reasons, validRouteIds, routeNotes, speedsChecked: checked };
}

const validationCache = new WeakMap<BalanceConfig, Map<string, boolean>>();

/**
 * Cached runtime check: the pattern must have a surviving route at every speed it may be played
 * at, from the current speed up to the estimated speed when Santa leaves the section.
 */
export function isPatternValidForSpeeds(
  pattern: PlatformPatternDefinition,
  balance: BalanceConfig,
  minimumSpeed: number,
  maximumSpeed: number,
): boolean {
  const range = getPatternSpeedRange(pattern, balance);
  const low = Math.floor(minimumSpeed / 10) * 10;
  const high = Math.ceil(Math.max(minimumSpeed, maximumSpeed) / 10) * 10;
  if (!range || low < range.min - 10 || high > range.max + 10) return false;
  const key = `${pattern.id}@${low}-${high}`;
  let cache = validationCache.get(balance);
  if (!cache) {
    cache = new Map();
    validationCache.set(balance, cache);
  }
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  const clamp = (speed: number): number => Math.min(range.max, Math.max(range.min, speed));
  const speeds = [...new Set([clamp(low), clamp((low + high) / 2), clamp(high)])];
  const valid = validatePlatformPattern(pattern, balance, speeds).valid;
  cache.set(key, valid);
  return valid;
}

export interface PlatformPatternContext {
  readonly distanceMeters: number;
  readonly worldSpeed: number;
  /** Highest speed the section may be played at (speed keeps rising until the cap). */
  readonly maximumWorldSpeed?: number;
  readonly currentPlatformLevel: PlatformLevel;
  readonly recentPatternIds: readonly PlatformPatternId[];
  readonly recentMechanics: readonly PlatformMechanic[];
  readonly hasEncounteredMdr: boolean;
  readonly hasEncounteredTorpedo: boolean;
}

export function patternHasMdr(pattern: PlatformPatternDefinition): boolean {
  return pattern.threats.some((threat) => threat.kind === 'mdr');
}

export function patternHasTorpedo(pattern: PlatformPatternDefinition): boolean {
  return pattern.threats.some((threat) => threat.kind === 'torpedo');
}

export function isPlatformPatternEligible(
  pattern: PlatformPatternDefinition,
  context: PlatformPatternContext,
  balance: BalanceConfig,
): boolean {
  const weights = balance.platforms.patternWeights[pattern.id];
  if (
    weights.selectionWeight <= 0 ||
    context.distanceMeters < weights.unlockDistanceMeters ||
    context.distanceMeters < balance.platforms.unlockDistanceMeters ||
    getDifficulty(context.distanceMeters, balance).level < Math.max(weights.minimumDifficulty, pattern.minimumDifficulty) ||
    pattern.entryPlatformLevel !== context.currentPlatformLevel
  ) return false;
  const hasMdr = patternHasMdr(pattern);
  const hasTorpedo = patternHasTorpedo(pattern);
  if (hasMdr && !context.hasEncounteredMdr) return false;
  if (hasTorpedo && !context.hasEncounteredTorpedo) return false;
  if (hasMdr && hasTorpedo && context.distanceMeters < balance.torpedoes.mixedPatternUnlockDistanceMeters) return false;
  if (context.recentPatternIds.slice(-weights.cooldownSections).includes(pattern.id)) return false;
  const primary = pattern.requiredMechanics[0];
  const lastTwo = context.recentMechanics.slice(-2);
  if (lastTwo.length === 2 && lastTwo.every((mechanic) => mechanic === primary)) return false;
  return isPatternValidForSpeeds(pattern, balance, context.worldSpeed, context.maximumWorldSpeed ?? context.worldSpeed);
}

export function selectPlatformPattern(
  context: PlatformPatternContext,
  balance: BalanceConfig,
  rng: RandomSource,
): PlatformPatternDefinition | null {
  const candidates = Object.values(PLATFORM_PATTERN_CATALOG)
    .filter((pattern) => isPlatformPatternEligible(pattern, context, balance))
    .map((pattern) => ({ pattern, weight: balance.platforms.patternWeights[pattern.id].selectionWeight }));
  const total = candidates.reduce((sum, candidate) => sum + candidate.weight, 0);
  if (total <= 0) return null;
  let choice = rng() * total;
  for (const candidate of candidates) {
    choice -= candidate.weight;
    if (choice <= 0) return candidate.pattern;
  }
  return candidates[candidates.length - 1]?.pattern ?? null;
}

