import type { BalanceConfig } from '../config/balance';
import type { AntibioticType, BacteriumType, DefeatCause } from '../types/game';
import { AntibioticInventory, type RestockResult } from './AntibioticInventory';
import { resolveBacteriumContact, type ContactOutcome } from './collisionRules';
import { calculateScore, countCheckpointsCrossed } from './scoring';

export interface AdvanceResult {
  /** Presents delivered during this step (normally 0 or 1). */
  readonly deliveries: number;
}

/** Pure, Phaser-independent model of a single run. */
export class RunState {
  readonly inventory: AntibioticInventory;
  private distance = 0;
  private cookieCount = 0;
  private presentCount = 0;
  private defeat: DefeatCause | null = null;

  constructor(private readonly balance: BalanceConfig) {
    this.inventory = new AntibioticInventory(balance.antibiotics.capacity, balance.antibiotics.startingInventory);
  }

  get distanceMeters(): number {
    return this.distance;
  }

  get cookies(): number {
    return this.cookieCount;
  }

  get presents(): number {
    return this.presentCount;
  }

  get defeatCause(): DefeatCause | null {
    return this.defeat;
  }

  get isOver(): boolean {
    return this.defeat !== null;
  }

  get score(): number {
    return calculateScore(
      { distanceMeters: this.distance, cookies: this.cookieCount, presents: this.presentCount },
      this.balance,
    );
  }

  advance(meters: number): AdvanceResult {
    if (this.isOver || meters <= 0) return { deliveries: 0 };
    const previous = this.distance;
    this.distance += meters;
    const deliveries = countCheckpointsCrossed(previous, this.distance, this.balance.deliveries.intervalMeters);
    this.presentCount += deliveries;
    return { deliveries };
  }

  collectCookie(): number {
    if (this.isOver) return 0;
    this.cookieCount += 1;
    return this.balance.cookies.score;
  }

  collectAntibiotic(type: AntibioticType): RestockResult {
    return this.inventory.restock(type);
  }

  resolveContact(bacterium: BacteriumType, isInvulnerable: boolean): ContactOutcome {
    if (this.isOver) return { kind: 'ignored' };
    const outcome = resolveBacteriumContact(bacterium, this.inventory, isInvulnerable);
    if (outcome.kind === 'defeated') this.defeat = outcome.cause;
    return outcome;
  }

  reset(): void {
    this.distance = 0;
    this.cookieCount = 0;
    this.presentCount = 0;
    this.defeat = null;
    this.inventory.reset();
  }
}
