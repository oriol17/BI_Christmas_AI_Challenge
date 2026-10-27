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

/** Collectables either sit on the floor (run through) or float at jump height. */
export type CollectableLane = 'run' | 'jump';

/** Visual movement style. All trajectories settle into their lane well before reaching Santa. */
export type Trajectory = 'straight' | 'bob' | 'lob';

export type RequiredAction = 'jump' | 'crouch' | 'stay';

export type DefeatCause = BacteriumType;

export type AntibioticCounts = Record<AntibioticType, number>;
