import type { AntibioticType, BacteriumType } from '../types/game';

/**
 * Every texture used by the game. Procedural placeholders are generated under these keys
 * at boot unless an image with the same key was already loaded from
 * `public/assets/asset-manifest.json`, which is how final artwork replaces placeholders.
 */
export const TEXTURES = {
  santa: {
    run: ['santa-run-0', 'santa-run-1', 'santa-run-2', 'santa-run-3'],
    jump: 'santa-jump',
    fall: 'santa-fall',
    crouch: 'santa-crouch',
    fastFall: 'santa-fast-fall',
    hit: 'santa-hit',
    defeat: 'santa-defeat',
  },
  grumpus: {
    idle: 'grumpus-idle',
    throw: 'grumpus-throw',
    warn: 'grumpus-warn',
    platform: 'grumpus-platform',
  },
  bacteria: {
    gramPositive: 'bacterium-gram-positive',
    gramNegative: 'bacterium-gram-negative',
    mdr: 'bacterium-mdr',
  } satisfies Record<BacteriumType, string>,
  antibiotics: {
    gramPositive: 'antibiotic-gram-positive',
    gramNegative: 'antibiotic-gram-negative',
  } satisfies Record<AntibioticType, string>,
  cookie: 'cookie-gingerbread',
  present: 'present-box',
  environment: {
    night: 'env-night',
    snow: 'env-snow',
    wall: 'env-wall',
    equipment: 'env-equipment',
    benches: 'env-benches',
    floor: 'env-floor',
    deliveryStation: 'env-delivery-station',
    building: 'env-lab-building',
    moon: 'env-moon',
    platform: 'env-lab-platform',
  },
  hazards: {
    virusTorpedo: 'hazard-virus-torpedo',
  },
  particles: {
    dot: 'particle-dot',
    star: 'particle-star',
    confetti: 'particle-confetti',
    ring: 'particle-ring',
    crumb: 'particle-crumb',
  },
  ui: {
    warning: 'ui-warning',
    shield: 'ui-shield',
    soundOn: 'ui-sound-on',
    soundOff: 'ui-sound-off',
  },
} as const;

/** Animation keys. Built from sprite sheets when provided, otherwise from procedural frames. */
export const ANIMATIONS = {
  santaRun: 'santa-run',
} as const;
