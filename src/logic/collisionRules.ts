import type { AntibioticType, BacteriumType, DefeatCause } from '../types/game';
import type { AntibioticInventory } from './AntibioticInventory';

export type ContactOutcome =
  | { readonly kind: 'ignored' }
  | { readonly kind: 'protected'; readonly antibiotic: AntibioticType }
  | { readonly kind: 'defeated'; readonly cause: DefeatCause };

/**
 * Pure collision rule between Santa and a bacterium.
 *
 * - MDR bacteria are always lethal, regardless of inventory or invulnerability.
 * - During post-protection invulnerability, treatable bacteria are ignored so a single
 *   event cannot drain both slots or kill Santa immediately.
 * - Otherwise the matching antibiotic is consumed, or the run ends.
 *
 * The inventory is mutated only when the outcome is `protected`.
 */
export function resolveBacteriumContact(
  bacterium: BacteriumType,
  inventory: AntibioticInventory,
  isInvulnerable: boolean,
): ContactOutcome {
  if (bacterium === 'mdr') {
    return { kind: 'defeated', cause: 'mdr' };
  }
  if (isInvulnerable) {
    return { kind: 'ignored' };
  }
  if (inventory.consume(bacterium)) {
    return { kind: 'protected', antibiotic: bacterium };
  }
  return { kind: 'defeated', cause: bacterium };
}

export function resolveTorpedoContact(): ContactOutcome {
  return { kind: 'defeated', cause: 'virusTorpedo' };
}

export interface DefeatMessage {
  readonly title: string;
  readonly description: string;
}

export const DEFEAT_MESSAGES: Readonly<Record<DefeatCause, DefeatMessage>> = {
  gramPositive: {
    title: 'Gram-positive infection!',
    description: 'Santa developed pneumonia because no effective Gram-positive antibiotic was available.',
  },
  gramNegative: {
    title: 'Gram-negative infection!',
    description: 'Santa developed pneumonia because no effective Gram-negative antibiotic was available.',
  },
  mdr: {
    title: 'Multidrug-resistant superbug!',
    description: 'No effective antibiotic was available. MDR bacteria must be avoided.',
  },
  virusTorpedo: {
    title: 'Virus torpedo impact!',
    description: 'Antibiotics do not work against viruses. This threat had to be avoided.',
  },
};
