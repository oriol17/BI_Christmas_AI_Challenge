import type { HazardLane, RequiredAction, TorpedoLane } from '../types/game';

const TORPEDO_ACTION: Readonly<Record<TorpedoLane, RequiredAction>> = {
  low: 'jump',
  mid: 'crouch',
  high: 'stay',
};

const BACTERIUM_ACTION: Readonly<Record<HazardLane, RequiredAction>> = {
  ground: 'jump',
  high: 'crouch',
  sky: 'stay',
};

const TORPEDO_LANES: readonly TorpedoLane[] = ['low', 'mid', 'high'];

export interface IncomingBacteriumThreat {
  readonly arrivalSeconds: number;
  readonly lane: HazardLane;
}

export function getSafeTorpedoLanes(
  threats: readonly IncomingBacteriumThreat[],
  torpedoImpactSeconds: number,
  reactionWindowSeconds: number,
): TorpedoLane[] {
  return TORPEDO_LANES.filter((torpedoLane) =>
    threats.every((threat) =>
      Math.abs(threat.arrivalSeconds - torpedoImpactSeconds) > reactionWindowSeconds ||
      BACTERIUM_ACTION[threat.lane] === TORPEDO_ACTION[torpedoLane],
    ),
  );
}
