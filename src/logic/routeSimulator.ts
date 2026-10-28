import type { BalanceConfig } from '../config/balance';
import {
  COLLECTABLE_HITBOX_RADIUS,
  COLLECTABLE_LANE_Y,
  HAZARD_HITBOX_RADIUS,
  LAYOUT,
  PLAYER_BODY,
  TORPEDO_LANE_HEIGHT,
  hazardLaneY,
} from '../config/layout';
import type { BacteriumType, HazardLane, PlatformLevel, TorpedoLane } from '../types/game';

/** Raised shelf in section coordinates (x grows to the right; 0 is the section start). */
export interface SectionPlatform {
  readonly level: Exclude<PlatformLevel, 0>;
  readonly left: number;
  readonly width: number;
}

export type SectionThreat =
  | {
      readonly kind: BacteriumType;
      readonly level: PlatformLevel;
      /** Authored sections use ground/high; `sky` exists so planner timelines can be replayed too. */
      readonly lane: HazardLane;
      readonly x: number;
    }
  | {
      readonly kind: 'torpedo';
      readonly level: PlatformLevel;
      readonly lane: TorpedoLane;
      /** Section x at which the torpedo reaches Santa's position. */
      readonly x: number;
    };

export interface SectionReward {
  readonly kind: 'cookie' | 'antibiotic';
  readonly level: PlatformLevel;
  readonly lane: 'run' | 'jump';
  readonly x: number;
}

/**
 * When an input happens: `at` is a section x, and the input fires `lead` seconds before Santa
 * reaches it. `apex` and `landing` derive the lead from the preset's jump physics, so one
 * authored route stays valid for different gravity/jump presets.
 */
export type InputLead = number | 'apex' | 'landing';

export interface RouteInput {
  readonly action: 'jump' | 'down';
  readonly at: number;
  readonly lead?: InputLead;
  /** How long Down is held (seconds). Held Down is a fast-fall in the air and a crouch on the ground. */
  readonly hold?: number;
}

export interface SectionRoute {
  readonly id: string;
  readonly description: string;
  readonly inputs: readonly RouteInput[];
}

export interface SectionLayout {
  readonly platforms: readonly SectionPlatform[];
  readonly threats: readonly SectionThreat[];
  readonly rewards: readonly SectionReward[];
}

export interface RouteSimulationResult {
  readonly success: boolean;
  readonly failure: string | null;
  readonly exitLevel: PlatformLevel;
  readonly collectedRewards: readonly number[];
}

const STEP_SECONDS = 1 / 60;
/** Arcade's separation bias: a falling body lands if it was at most this far below the top. */
const LANDING_BIAS_PIXELS = 4;

export function sectionLength(layout: SectionLayout): number {
  let end = 0;
  for (const platform of layout.platforms) end = Math.max(end, platform.left + platform.width);
  for (const threat of layout.threats) end = Math.max(end, threat.x + 60);
  for (const reward of layout.rewards) end = Math.max(end, reward.x + COLLECTABLE_HITBOX_RADIUS);
  return end;
}

export function surfaceHeight(level: PlatformLevel, balance: BalanceConfig): number {
  return level * balance.platforms.levelRisePixels;
}

/** Centre height above the floor of a scripted threat. */
export function threatCenterHeight(threat: SectionThreat, balance: BalanceConfig): number {
  const surface = surfaceHeight(threat.level, balance);
  return threat.kind === 'torpedo'
    ? surface + TORPEDO_LANE_HEIGHT[threat.lane]
    : surface + LAYOUT.groundY - hazardLaneY(threat.kind, threat.lane);
}

export function rewardCenterHeight(reward: SectionReward, balance: BalanceConfig): number {
  return surfaceHeight(reward.level, balance) + LAYOUT.groundY - COLLECTABLE_LANE_Y[reward.lane];
}

export function resolveLeadSeconds(lead: InputLead | undefined, balance: BalanceConfig): number {
  const { gravity, jumpVelocity } = balance.player;
  if (lead === undefined) return 0;
  if (lead === 'apex') return jumpVelocity / gravity;
  if (lead === 'landing') {
    const rise = balance.platforms.levelRisePixels;
    const discriminant = jumpVelocity ** 2 - 2 * gravity * rise;
    return discriminant < 0 ? Number.POSITIVE_INFINITY : (jumpVelocity + Math.sqrt(discriminant)) / gravity;
  }
  return lead;
}

function circleIntersectsRect(
  cx: number,
  cy: number,
  radius: number,
  left: number,
  right: number,
  bottom: number,
  top: number,
): boolean {
  const nearestX = Math.max(left, Math.min(cx, right));
  const nearestY = Math.max(bottom, Math.min(cy, top));
  return (cx - nearestX) ** 2 + (cy - nearestY) ** 2 < radius ** 2;
}

export interface RouteTraceSample {
  readonly time: number;
  readonly x: number;
  readonly height: number;
  readonly velocityY: number;
  readonly grounded: boolean;
  readonly level: PlatformLevel;
  readonly pose: 'standing' | 'crouching' | 'fastFalling';
}

/**
 * Replays a route through a section with the same rules as the Player controller and Arcade
 * collisions: buffered/coyote jumps, bounded crouch, fast-fall acceleration and terminal speed,
 * one-way shelves, per-pose hitboxes, circular bacteria and rectangular torpedoes.
 * `timingShifts[i]` delays (positive) or advances (negative) input `i` to model imprecise timing.
 * `trace` receives every simulated step (used by tests and debugging tools).
 */
export function simulateRoute(
  layout: SectionLayout,
  route: SectionRoute,
  balance: BalanceConfig,
  worldSpeed: number,
  timingShifts: readonly number[] = [],
  trace?: (sample: RouteTraceSample) => void,
): RouteSimulationResult {
  const { player, torpedoes } = balance;
  const length = sectionLength(layout);
  const startX = -worldSpeed * 1.2;
  const triggers = route.inputs.map((input, index) => ({
    input,
    time: (input.at - startX) / worldSpeed - resolveLeadSeconds(input.lead, balance) + (timingShifts[index] ?? 0),
  }));
  const torpedoTracks = layout.threats.map((threat) => ({
    threat,
    impactTime: (threat.x - startX) / worldSpeed,
  }));
  const collected = new Set<number>();

  let time = 0;
  let height = 0;
  let velocityY = 0;
  let grounded = true;
  let surfaceLevel: PlatformLevel = 0;
  let crouching = false;
  let crouchRemaining = 0;
  let crouchHeld = 0;
  let crouchCooldown = 0;
  let mustReleaseCrouch = false;
  let coyote = player.coyoteTimeMs / 1000;
  let jumpBuffer = 0;
  const maxTime = (length - startX) / worldSpeed + 2;

  const endCrouch = (): void => {
    if (!crouching) return;
    crouching = false;
    crouchRemaining = 0;
    crouchHeld = 0;
    crouchCooldown = player.crouchCooldownMs / 1000;
  };

  while (time < maxTime) {
    const previousTime = time;
    time += STEP_SECONDS;
    const x = startX + worldSpeed * time;
    const jumpPressed = triggers.some(
      (trigger) => trigger.input.action === 'jump' && trigger.time > previousTime && trigger.time <= time,
    );
    const downHeld = triggers.some(
      (trigger) =>
        trigger.input.action === 'down' &&
        trigger.time <= time &&
        time < trigger.time + Math.max(STEP_SECONDS, trigger.input.hold ?? 0.3),
    );

    crouchCooldown = Math.max(0, crouchCooldown - STEP_SECONDS);
    if (!downHeld) mustReleaseCrouch = false;
    coyote = grounded ? player.coyoteTimeMs / 1000 : Math.max(0, coyote - STEP_SECONDS);
    jumpBuffer = jumpPressed ? player.jumpBufferMs / 1000 : Math.max(0, jumpBuffer - STEP_SECONDS);

    if (downHeld && grounded) {
      if (!crouching && crouchCooldown <= 0 && !mustReleaseCrouch) {
        crouching = true;
        crouchHeld = 0;
      }
      if (crouching) {
        crouchHeld += STEP_SECONDS;
        crouchRemaining = player.crouchDurationMs / 1000;
      }
    }
    let fastFalling = !grounded && downHeld;
    if (crouching) {
      if (!downHeld) crouchRemaining -= STEP_SECONDS;
      if (crouchHeld >= player.maxCrouchHoldMs / 1000) {
        mustReleaseCrouch = true;
        endCrouch();
      } else if (crouchRemaining <= 0 && !downHeld) {
        endCrouch();
      }
    }
    if (jumpBuffer > 0 && coyote > 0) {
      endCrouch();
      velocityY = player.jumpVelocity;
      coyote = 0;
      jumpBuffer = 0;
    }

    const extra = fastFalling && -velocityY < player.fastFallVelocity ? player.fastFallAcceleration : 0;
    velocityY -= (player.gravity + extra) * STEP_SECONDS;
    velocityY = Math.max(velocityY, -player.maximumFallSpeed);
    const previousHeight = height;
    height += velocityY * STEP_SECONDS;

    const shape = fastFalling ? PLAYER_BODY.fastFalling : crouching ? PLAYER_BODY.crouching : PLAYER_BODY.standing;
    const left = x - shape.width / 2;
    const right = x + shape.width / 2;
    grounded = false;
    if (height <= 0) {
      height = 0;
      velocityY = Math.max(0, velocityY);
      grounded = true;
      surfaceLevel = 0;
    } else if (velocityY <= 0) {
      for (const platform of layout.platforms) {
        const top = surfaceHeight(platform.level, balance);
        const overlaps = right > platform.left && left < platform.left + platform.width;
        if (overlaps && previousHeight >= top - LANDING_BIAS_PIXELS && height <= top) {
          height = top;
          velocityY = 0;
          grounded = true;
          surfaceLevel = platform.level;
          break;
        }
      }
    }
    if (grounded) fastFalling = false;

    const bodyShape = fastFalling ? PLAYER_BODY.fastFalling : crouching ? PLAYER_BODY.crouching : PLAYER_BODY.standing;
    const bodyLeft = x - bodyShape.width / 2;
    const bodyRight = x + bodyShape.width / 2;
    const bodyTop = height + bodyShape.height;
    trace?.({
      time,
      x,
      height,
      velocityY,
      grounded,
      level: surfaceLevel,
      pose: fastFalling ? 'fastFalling' : crouching ? 'crouching' : 'standing',
    });

    for (const track of torpedoTracks) {
      const { threat } = track;
      const centerY = threatCenterHeight(threat, balance);
      if (threat.kind === 'torpedo') {
        const torpedoX = threat.x + torpedoes.speedPixelsPerSecond * (track.impactTime - time);
        const halfWidth = torpedoes.hitboxWidthPixels / 2;
        const halfHeight = torpedoes.hitboxHeightPixels / 2;
        if (
          torpedoX + halfWidth > bodyLeft &&
          torpedoX - halfWidth < bodyRight &&
          centerY + halfHeight > height &&
          centerY - halfHeight < bodyTop
        ) {
          return { success: false, failure: `virus torpedo (${threat.lane}, L${threat.level}) at x=${threat.x}`, exitLevel: surfaceLevel, collectedRewards: [...collected] };
        }
      } else if (
        circleIntersectsRect(threat.x, centerY, HAZARD_HITBOX_RADIUS[threat.kind], bodyLeft, bodyRight, height, bodyTop)
      ) {
        return { success: false, failure: `${threat.kind} (${threat.lane}, L${threat.level}) at x=${threat.x}`, exitLevel: surfaceLevel, collectedRewards: [...collected] };
      }
    }
    layout.rewards.forEach((reward, index) => {
      // Rewards bob by ±4 px, so collection is checked against a slightly smaller radius.
      if (circleIntersectsRect(reward.x, rewardCenterHeight(reward, balance), COLLECTABLE_HITBOX_RADIUS - 4, bodyLeft, bodyRight, height, bodyTop)) {
        collected.add(index);
      }
    });

    if (x > length + 40 && grounded && triggers.every((trigger) => trigger.time <= time)) break;
  }

  return { success: true, failure: null, exitLevel: surfaceLevel, collectedRewards: [...collected] };
}
