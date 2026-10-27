import type { BacteriumType, CollectableLane, HazardLane } from '../types/game';

/** Logical game resolution. Phaser scales this to fit the browser while preserving aspect ratio. */
export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

/**
 * Screen-space geometry shared by gameplay and art. Lane heights were derived from the
 * player's jump arc and hitboxes so that every lane has a clear, single correct response:
 * - ground lane: hits standing/crouching Santa, cleared by a jump
 * - high lane:   hits standing Santa, passes over a crouching Santa
 * - sky lane:    passes over standing Santa, hits a jumping Santa
 */
export const LAYOUT = {
  groundY: 600,
  playerX: 230,
  /** Items are scheduled beyond this x so they always scroll in from off-screen. */
  spawnEdgeX: 1360,
  /** Entities left of this x are recycled. */
  despawnX: -140,
  /** Starting height for lobbed bacteria (level with the Grumpus's hover platform). */
  lobStartY: 230,
  /** x position at which lobbed bacteria have settled into their lane. */
  lobSettleX: 900,
} as const;

export const PLAYER_FRAME = { width: 96, height: 112 } as const;

export const PLAYER_BODY = {
  standing: { width: 40, height: 92 },
  crouching: { width: 50, height: 46 },
} as const;

export const HAZARD_LANE_Y: Readonly<Record<HazardLane, number>> = {
  ground: 570,
  high: 512,
  sky: 415,
};

/** MDR bacteria are larger, so their lane centres are adjusted to keep the same clearances. */
export const MDR_LANE_Y: Readonly<Record<HazardLane, number>> = {
  ground: 562,
  high: 500,
  sky: 415,
};

export const HAZARD_HITBOX_RADIUS: Readonly<Record<BacteriumType, number>> = {
  gramPositive: 20,
  gramNegative: 19,
  mdr: 26,
};

export const COLLECTABLE_LANE_Y: Readonly<Record<CollectableLane, number>> = {
  run: 566,
  jump: 392,
};

export const COLLECTABLE_HITBOX_RADIUS = 18;

export function hazardLaneY(type: BacteriumType, lane: HazardLane): number {
  return type === 'mdr' ? MDR_LANE_Y[lane] : HAZARD_LANE_Y[lane];
}

/** Render ordering. */
export const DEPTH = {
  backgroundFar: 0,
  backgroundWall: 5,
  backgroundEquipment: 8,
  backgroundBenches: 10,
  grumpus: 15,
  floor: 18,
  deliveryStation: 22,
  collectables: 40,
  player: 50,
  hazards: 55,
  effects: 70,
  warnings: 80,
  hud: 100,
  toast: 110,
  overlay: 200,
} as const;
