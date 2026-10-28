/** Bacterial threat categories released by the Grumpus. */
export type BacteriumType = 'gramPositive' | 'gramNegative' | 'mdr';

/** Bacteria that a carried antibiotic can neutralise. MDR is intentionally excluded. */
export type TreatableBacteriumType = Exclude<BacteriumType, 'mdr'>;

/** Antibiotics are identified by the bacterial group they counter. */
export type AntibioticType = TreatableBacteriumType;

export const ANTIBIOTIC_TYPES: readonly AntibioticType[] = ['gramPositive', 'gramNegative'];

/**
 * Vertical lanes a bacterium can travel in.
 * - ground: rolls along the floor -> jump over it
 * - high:   flies at head height  -> crouch under it
 * - sky:    flies above Santa     -> keep running (do not jump)
 */
export type HazardLane = 'ground' | 'high' | 'sky';

/** Collectables can be taken from the running, jump-arc, or crouch paths. */
export type CollectableLane = 'run' | 'jump' | 'crouch';

/** Visual movement style. All trajectories settle into their lane well before reaching Santa. */
export type Trajectory = 'straight' | 'bob' | 'lob';

export type RequiredAction = 'jump' | 'crouch' | 'stay';

export type PlatformLevel = 0 | 1 | 2;

export type TorpedoLane = 'low' | 'mid' | 'high';

export type DefeatCause = BacteriumType | 'virusTorpedo';

export type AntibioticCounts = Record<AntibioticType, number>;
