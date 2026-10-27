import type { AntibioticCounts, AntibioticType } from '../types/game';
import { ANTIBIOTIC_TYPES } from '../types/game';

export type RestockResult = 'restocked' | 'already-stocked';

/**
 * Santa's antibiotic pouch. Each antibiotic type has its own slot with a fixed capacity
 * (one dose per type by default). Counts can never exceed capacity or drop below zero.
 */
export class AntibioticInventory {
  private readonly counts: AntibioticCounts;

  constructor(
    private readonly capacity: Readonly<AntibioticCounts>,
    private readonly initial: Readonly<AntibioticCounts>,
  ) {
    for (const type of ANTIBIOTIC_TYPES) {
      if (capacity[type] < 0 || !Number.isInteger(capacity[type])) {
        throw new Error(`Invalid antibiotic capacity for ${type}`);
      }
    }
    this.counts = { gramPositive: 0, gramNegative: 0 };
    this.reset();
  }

  reset(): void {
    for (const type of ANTIBIOTIC_TYPES) {
      this.counts[type] = Math.min(this.capacity[type], Math.max(0, Math.floor(this.initial[type])));
    }
  }

  has(type: AntibioticType): boolean {
    return this.counts[type] > 0;
  }

  count(type: AntibioticType): number {
    return this.counts[type];
  }

  isFull(type: AntibioticType): boolean {
    return this.counts[type] >= this.capacity[type];
  }

  /** Adds one dose if there is room. A full slot is left unchanged. */
  restock(type: AntibioticType): RestockResult {
    if (this.isFull(type)) return 'already-stocked';
    this.counts[type] += 1;
    return 'restocked';
  }

  /** Uses one dose. Returns false when the slot is empty. */
  consume(type: AntibioticType): boolean {
    if (!this.has(type)) return false;
    this.counts[type] -= 1;
    return true;
  }

  snapshot(): Readonly<AntibioticCounts> {
    return { ...this.counts };
  }

  readiness(): Record<AntibioticType, boolean> {
    return { gramPositive: this.has('gramPositive'), gramNegative: this.has('gramNegative') };
  }
}
