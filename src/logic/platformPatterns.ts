import type { PlatformPatternId } from '../config/balance';
import type { PlatformLevel, TorpedoLane } from '../types/game';
import type {
  InputLead,
  RouteInput,
  SectionLayout,
  SectionPlatform,
  SectionReward,
  SectionRoute,
  SectionThreat,
} from './routeSimulator';

export type PlatformMechanic = 'jump' | 'fastFall' | 'crouch' | 'platformSwitch' | 'routeChoice';

/**
 * An authored platform section. Shelves, threats and rewards share one pixel coordinate system
 * (x = 0 at the section start), so they stay aligned at every world speed. Each section lists
 * explicit input routes that are replayed by the route simulator before it can be spawned.
 */
export interface PlatformPatternDefinition extends SectionLayout {
  readonly id: PlatformPatternId;
  /** The first entry is the section's primary action, used to avoid repeating one action. */
  readonly requiredMechanics: readonly PlatformMechanic[];
  readonly minimumDifficulty: number;
  readonly entryPlatformLevel: PlatformLevel;
  readonly validExitPlatformLevels: readonly PlatformLevel[];
  /** Shortest authored time between two consecutive threats at the fastest valid speed. */
  readonly minimumReactionWindowSeconds: number;
  /** Minimum torpedo warning for this section; the live warning is never shorter than the preset's. */
  readonly torpedoWarningTimingSeconds: number;
  readonly pickupEligibility: 'none' | 'cookie' | 'risky-antibiotic';
  readonly mdrEligibility: boolean;
  readonly minimumWorldSpeed: number;
  readonly maximumWorldSpeed: number;
  readonly cooldownSections: number;
  readonly selectionWeight: number;
  /** Explicit input routes; at least one must survive the simulator at the current speed. */
  readonly routes: readonly SectionRoute[];
}

const shelf = (level: Exclude<PlatformLevel, 0>, left: number, width: number): SectionPlatform => ({ level, left, width });
const bug = (
  kind: 'gramPositive' | 'gramNegative' | 'mdr',
  level: PlatformLevel,
  lane: 'ground' | 'high',
  x: number,
): SectionThreat => ({ kind, level, lane, x });
const torpedo = (level: PlatformLevel, lane: TorpedoLane, x: number): SectionThreat => ({ kind: 'torpedo', level, lane, x });
const cookie = (level: PlatformLevel, x: number, lane: 'run' | 'jump' = 'run'): SectionReward => ({ kind: 'cookie', level, lane, x });
const medicine = (level: PlatformLevel, x: number): SectionReward => ({ kind: 'antibiotic', level, lane: 'run', x });
/** Jump timed so the apex is over `at` (or `lead` seconds before reaching it). */
const jump = (at: number, lead: InputLead = 'apex'): RouteInput => ({ action: 'jump', at, lead });
/** Jump timed to land on the next shelf level at `at`. */
const climb = (at: number): RouteInput => ({ action: 'jump', at, lead: 'landing' });
/** Grounded crouch tap before a head-height threat at `at` (the crouch lasts crouchDurationMs after release). */
const duck = (at: number, hold = 0.08, lead = 0.18): RouteInput => ({ action: 'down', at, lead, hold });
/** Airborne Down from `at`: fast-fall, then crouch on landing while still held. */
const tuck = (at: number, hold = 0.5): RouteInput => ({ action: 'down', at, lead: 0, hold });
const route = (id: string, description: string, inputs: readonly RouteInput[]): SectionRoute => ({ id, description, inputs });

const BASE = {
  entryPlatformLevel: 0 as PlatformLevel,
  validExitPlatformLevels: [0] as readonly PlatformLevel[],
  minimumWorldSpeed: 380,
  maximumWorldSpeed: 900,
};

export const PLATFORM_PATTERN_CATALOG: Readonly<Record<PlatformPatternId, PlatformPatternDefinition>> = {
  JUMP_THEN_FAST_FALL: {
    ...BASE,
    id: 'JUMP_THEN_FAST_FALL',
    requiredMechanics: ['fastFall', 'jump', 'crouch'],
    minimumDifficulty: 0,
    platforms: [shelf(1, 1100, 600)],
    threats: [bug('gramPositive', 0, 'ground', 200), bug('gramNegative', 0, 'high', 560)],
    rewards: [cookie(1, 1250), cookie(1, 1350), cookie(1, 1450)],
    minimumReactionWindowSeconds: 0.35,
    torpedoWarningTimingSeconds: 0,
    pickupEligibility: 'cookie',
    mdrEligibility: false,
    cooldownSections: 2,
    selectionWeight: 1.5,
    routes: [
      route('floor-tuck', 'Jump the Gram+, hold ↓ to fast-fall and land already ducking under the Gram−.', [
        jump(200),
        tuck(230, 0.6),
      ]),
      route('shelf-cookies', 'Same tuck, then climb to the shelf for the cookie row.', [
        jump(200),
        tuck(230, 0.6),
        climb(1180),
      ]),
    ],
  },
  PLATFORM_SWITCH: {
    ...BASE,
    id: 'PLATFORM_SWITCH',
    requiredMechanics: ['platformSwitch', 'jump', 'crouch'],
    minimumDifficulty: 0.05,
    platforms: [shelf(1, 250, 690), shelf(2, 1040, 560)],
    threats: [
      bug('gramNegative', 1, 'high', 560),
      bug('gramNegative', 0, 'high', 700),
      bug('gramPositive', 0, 'ground', 1300),
    ],
    rewards: [cookie(2, 1250), cookie(2, 1350), cookie(2, 1450)],
    // The two Gram− threats are on different levels, so only one is on any given route.
    minimumReactionWindowSeconds: 0.15,
    torpedoWarningTimingSeconds: 0,
    pickupEligibility: 'cookie',
    mdrEligibility: false,
    cooldownSections: 3,
    selectionWeight: 1.2,
    routes: [
      route('floor', 'Duck the head-height Gram− under the walkway, then jump the Gram+.', [duck(700), jump(1300)]),
      route('upper', 'Climb to the walkway, duck its Gram−, then climb to the top shelf for cookies.', [
        climb(340),
        duck(560),
        climb(1160),
      ]),
    ],
  },
  TORPEDO_LOW_JUMP: {
    ...BASE,
    id: 'TORPEDO_LOW_JUMP',
    requiredMechanics: ['jump', 'platformSwitch', 'crouch'],
    minimumDifficulty: 0.1,
    platforms: [shelf(1, 700, 750)],
    threats: [torpedo(0, 'low', 250), bug('gramPositive', 0, 'ground', 900), bug('gramNegative', 1, 'high', 1280)],
    rewards: [],
    minimumReactionWindowSeconds: 0.4,
    torpedoWarningTimingSeconds: 1.05,
    pickupEligibility: 'none',
    mdrEligibility: false,
    cooldownSections: 3,
    selectionWeight: 1.2,
    routes: [
      route('jump-climb-duck', 'Jump the low torpedo, jump the Gram+ onto the walkway, duck the walkway Gram−.', [
        jump(250),
        jump(900),
        duck(1280),
      ]),
    ],
  },
  TORPEDO_MID_CROUCH: {
    ...BASE,
    id: 'TORPEDO_MID_CROUCH',
    requiredMechanics: ['crouch', 'jump', 'platformSwitch'],
    minimumDifficulty: 0.12,
    platforms: [shelf(1, 650, 720)],
    threats: [torpedo(0, 'mid', 280), bug('gramPositive', 0, 'ground', 850), bug('gramNegative', 1, 'high', 1230)],
    rewards: [],
    minimumReactionWindowSeconds: 0.4,
    torpedoWarningTimingSeconds: 1.05,
    pickupEligibility: 'none',
    mdrEligibility: false,
    cooldownSections: 3,
    selectionWeight: 1,
    routes: [
      route('duck-climb-duck', 'Duck the mid torpedo, jump the Gram+ onto the walkway, duck again.', [
        duck(280, 0.1, 0.2),
        jump(850),
        duck(1230),
      ]),
    ],
  },
  TORPEDO_PLATFORM_ESCAPE: {
    ...BASE,
    id: 'TORPEDO_PLATFORM_ESCAPE',
    requiredMechanics: ['fastFall', 'jump', 'platformSwitch'],
    minimumDifficulty: 0.2,
    platforms: [shelf(1, 60, 420)],
    threats: [bug('gramPositive', 0, 'ground', 300), torpedo(1, 'low', 760)],
    rewards: [],
    minimumReactionWindowSeconds: 0.4,
    torpedoWarningTimingSeconds: 1.05,
    pickupEligibility: 'none',
    mdrEligibility: false,
    cooldownSections: 4,
    selectionWeight: 0.9,
    routes: [
      route('escape-down', 'Jumping the Gram+ lands on the walkway; run off its edge and fast-fall below the walkway torpedo.', [
        jump(300),
        tuck(500, 0.3),
      ]),
    ],
  },
  MDR_ROUTE_BLOCK: {
    ...BASE,
    id: 'MDR_ROUTE_BLOCK',
    requiredMechanics: ['platformSwitch', 'crouch'],
    minimumDifficulty: 0.1,
    platforms: [shelf(1, 250, 900)],
    threats: [bug('mdr', 0, 'ground', 750), bug('gramNegative', 1, 'high', 1000)],
    rewards: [],
    minimumReactionWindowSeconds: 0.25,
    torpedoWarningTimingSeconds: 0,
    pickupEligibility: 'none',
    mdrEligibility: true,
    cooldownSections: 4,
    selectionWeight: 0.95,
    routes: [route('over-mdr', 'Climb above the floor MDR, then duck the Gram− on the walkway.', [climb(320), duck(1000)])],
  },
  GRAM_CHAIN_ON_PLATFORMS: {
    ...BASE,
    id: 'GRAM_CHAIN_ON_PLATFORMS',
    requiredMechanics: ['jump', 'crouch', 'platformSwitch'],
    minimumDifficulty: 0.08,
    platforms: [shelf(1, 200, 800)],
    threats: [
      bug('gramPositive', 0, 'ground', 420),
      bug('gramNegative', 1, 'high', 860),
      bug('gramPositive', 0, 'ground', 1560),
    ],
    rewards: [],
    minimumReactionWindowSeconds: 0.3,
    torpedoWarningTimingSeconds: 0,
    pickupEligibility: 'none',
    mdrEligibility: false,
    cooldownSections: 3,
    selectionWeight: 1.25,
    routes: [
      route('chain', 'Jump onto the walkway over the Gram+, duck the Gram−, drop off and jump the last Gram+.', [
        jump(420),
        duck(860),
        jump(1560),
      ]),
    ],
  },
  ANTIBIOTIC_RISK_ROUTE: {
    ...BASE,
    id: 'ANTIBIOTIC_RISK_ROUTE',
    requiredMechanics: ['routeChoice', 'platformSwitch', 'crouch'],
    minimumDifficulty: 0.1,
    platforms: [shelf(1, 300, 800)],
    threats: [
      bug('gramNegative', 1, 'high', 820),
      bug('gramPositive', 0, 'ground', 1650),
      bug('gramNegative', 0, 'high', 2300),
    ],
    rewards: [medicine(1, 520)],
    minimumReactionWindowSeconds: 0.5,
    torpedoWarningTimingSeconds: 0,
    pickupEligibility: 'risky-antibiotic',
    mdrEligibility: false,
    cooldownSections: 5,
    selectionWeight: 0.7,
    routes: [
      route('floor', 'Ignore the medicine: jump the Gram+ and duck the Gram− on the floor.', [jump(1650), duck(2300)]),
      route('medicine', 'Climb for the antibiotic, duck the walkway Gram−, drop and handle the floor pair.', [
        climb(380),
        duck(820),
        jump(1650),
        duck(2300),
      ]),
    ],
  },
  COOKIE_UPPER_ROUTE: {
    ...BASE,
    id: 'COOKIE_UPPER_ROUTE',
    requiredMechanics: ['routeChoice', 'jump'],
    minimumDifficulty: 0.03,
    platforms: [shelf(1, 150, 570), shelf(2, 820, 520)],
    threats: [bug('gramPositive', 0, 'ground', 900), bug('gramNegative', 0, 'high', 2000)],
    rewards: [cookie(2, 950), cookie(2, 1050), cookie(2, 1150), cookie(2, 1250)],
    minimumReactionWindowSeconds: 0.5,
    torpedoWarningTimingSeconds: 0,
    pickupEligibility: 'cookie',
    mdrEligibility: false,
    cooldownSections: 3,
    selectionWeight: 0.9,
    routes: [
      route('floor', 'Safe floor route: jump the Gram+, duck the Gram−, no reward.', [jump(900), duck(2000)]),
      route('top-shelf', 'Climb twice to the top shelf for four cookies.', [climb(220), climb(890), duck(2000)]),
    ],
  },
  DESCEND_BEFORE_TORPEDO: {
    ...BASE,
    id: 'DESCEND_BEFORE_TORPEDO',
    requiredMechanics: ['fastFall', 'platformSwitch', 'jump'],
    minimumDifficulty: 0.2,
    platforms: [shelf(1, 80, 520), shelf(2, 660, 560)],
    threats: [bug('gramPositive', 0, 'ground', 360), bug('gramNegative', 0, 'high', 1000), torpedo(1, 'low', 1520)],
    rewards: [cookie(2, 880), cookie(2, 980), cookie(2, 1080)],
    minimumReactionWindowSeconds: 0.35,
    torpedoWarningTimingSeconds: 1.05,
    pickupEligibility: 'cookie',
    mdrEligibility: false,
    cooldownSections: 4,
    selectionWeight: 0.85,
    routes: [
      route('climb-and-dive', 'Climb twice for cookies, then fast-fall off the top shelf beneath the walkway torpedo.', [
        climb(140),
        climb(760),
        tuck(1240, 0.5),
      ]),
      route('floor', 'Jump the Gram+, drop off the walkway and duck the floor Gram−.', [jump(360), duck(1000)]),
    ],
  },
  ASCEND_TO_AVOID_MDR: {
    ...BASE,
    id: 'ASCEND_TO_AVOID_MDR',
    requiredMechanics: ['platformSwitch', 'jump'],
    minimumDifficulty: 0.15,
    platforms: [shelf(1, 150, 1150), shelf(2, 960, 600)],
    threats: [bug('mdr', 0, 'ground', 1200), bug('mdr', 1, 'ground', 1200)],
    rewards: [cookie(2, 1400)],
    minimumReactionWindowSeconds: 0,
    torpedoWarningTimingSeconds: 0,
    pickupEligibility: 'cookie',
    mdrEligibility: true,
    cooldownSections: 5,
    selectionWeight: 0.75,
    routes: [
      route('top-shelf', 'MDR blocks both lower levels: climb to the walkway, then to the top shelf.', [climb(230), climb(1100)]),
    ],
  },
  CROSS_LEVEL_DOUBLE_THREAT: {
    ...BASE,
    id: 'CROSS_LEVEL_DOUBLE_THREAT',
    requiredMechanics: ['crouch', 'jump', 'platformSwitch'],
    minimumDifficulty: 0.25,
    platforms: [shelf(1, 250, 760)],
    threats: [bug('gramPositive', 0, 'ground', 420), torpedo(1, 'mid', 780), bug('gramNegative', 0, 'high', 1600)],
    rewards: [],
    minimumReactionWindowSeconds: 0.35,
    torpedoWarningTimingSeconds: 1.05,
    pickupEligibility: 'none',
    mdrEligibility: false,
    cooldownSections: 6,
    selectionWeight: 0.6,
    routes: [
      route('shelf-duck', 'Jump onto the walkway over the Gram+, duck the walkway torpedo, drop and duck the Gram−.', [
        jump(420),
        duck(780, 0.1, 0.2),
        duck(1600),
      ]),
    ],
  },
  DELIVERY_GAUNTLET: {
    ...BASE,
    id: 'DELIVERY_GAUNTLET',
    requiredMechanics: ['jump', 'crouch', 'fastFall', 'platformSwitch'],
    minimumDifficulty: 0.25,
    platforms: [shelf(1, 100, 760), shelf(2, 940, 500)],
    threats: [
      bug('gramPositive', 0, 'ground', 250),
      bug('gramNegative', 1, 'high', 560),
      torpedo(0, 'low', 2050),
      bug('gramNegative', 0, 'high', 2550),
    ],
    rewards: [cookie(2, 1150), cookie(2, 1250)],
    minimumReactionWindowSeconds: 0.3,
    torpedoWarningTimingSeconds: 1.05,
    pickupEligibility: 'cookie',
    mdrEligibility: false,
    cooldownSections: 7,
    selectionWeight: 0.6,
    routes: [
      route('gauntlet', 'Jump onto the walkway, duck, climb for cookies, fast-fall, jump the low torpedo, duck.', [
        jump(250),
        duck(560),
        climb(1080),
        tuck(1510, 0.2),
        jump(2050),
        duck(2550),
      ]),
    ],
  },
  MIXED_LAB_ASSAULT: {
    ...BASE,
    id: 'MIXED_LAB_ASSAULT',
    requiredMechanics: ['platformSwitch', 'crouch', 'jump', 'fastFall'],
    minimumDifficulty: 0.4,
    platforms: [shelf(1, 200, 900)],
    threats: [
      bug('mdr', 0, 'ground', 600),
      torpedo(1, 'mid', 900),
      bug('gramPositive', 0, 'ground', 1680),
      bug('gramNegative', 0, 'high', 2330),
    ],
    rewards: [],
    minimumReactionWindowSeconds: 0.3,
    torpedoWarningTimingSeconds: 1.1,
    pickupEligibility: 'none',
    mdrEligibility: true,
    cooldownSections: 8,
    selectionWeight: 0.5,
    routes: [
      route('assault', 'Climb over the floor MDR, duck the walkway torpedo, drop, jump the Gram+, duck the Gram−.', [
        climb(270),
        duck(900, 0.1, 0.2),
        jump(1680),
        duck(2330),
      ]),
    ],
  },
};
