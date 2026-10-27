import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../src/config/balance';
import { AntibioticInventory } from '../src/logic/AntibioticInventory';
import { DEFEAT_MESSAGES, resolveBacteriumContact } from '../src/logic/collisionRules';

const createInventory = (gramPositive = 1, gramNegative = 1) =>
  new AntibioticInventory({ gramPositive: 1, gramNegative: 1 }, { gramPositive, gramNegative });

describe('AntibioticInventory', () => {
  it('starts with one dose of each antibiotic by default', () => {
    const inventory = new AntibioticInventory(
      DEFAULT_BALANCE.antibiotics.capacity,
      DEFAULT_BALANCE.antibiotics.startingInventory,
    );
    expect(inventory.snapshot()).toEqual({ gramPositive: 1, gramNegative: 1 });
  });

  it('never exceeds capacity when restocking', () => {
    const inventory = createInventory();
    expect(inventory.restock('gramPositive')).toBe('already-stocked');
    expect(inventory.restock('gramPositive')).toBe('already-stocked');
    expect(inventory.count('gramPositive')).toBe(1);
  });

  it('restocks only the corresponding empty slot', () => {
    const inventory = createInventory(0, 0);
    expect(inventory.restock('gramNegative')).toBe('restocked');
    expect(inventory.snapshot()).toEqual({ gramPositive: 0, gramNegative: 1 });
    expect(inventory.restock('gramNegative')).toBe('already-stocked');
    expect(inventory.snapshot()).toEqual({ gramPositive: 0, gramNegative: 1 });
  });

  it('clamps an initial inventory above capacity', () => {
    const inventory = new AntibioticInventory({ gramPositive: 1, gramNegative: 1 }, { gramPositive: 5, gramNegative: 3 });
    expect(inventory.snapshot()).toEqual({ gramPositive: 1, gramNegative: 1 });
  });

  it('consumes only when a dose is available', () => {
    const inventory = createInventory(1, 0);
    expect(inventory.consume('gramNegative')).toBe(false);
    expect(inventory.consume('gramPositive')).toBe(true);
    expect(inventory.consume('gramPositive')).toBe(false);
    expect(inventory.snapshot()).toEqual({ gramPositive: 0, gramNegative: 0 });
  });

  it('reset restores the starting inventory', () => {
    const inventory = createInventory();
    inventory.consume('gramPositive');
    inventory.consume('gramNegative');
    inventory.reset();
    expect(inventory.readiness()).toEqual({ gramPositive: true, gramNegative: true });
  });
});

describe('resolveBacteriumContact', () => {
  it('consumes the matching Gram-positive antibiotic and protects Santa', () => {
    const inventory = createInventory();
    const outcome = resolveBacteriumContact('gramPositive', inventory, false);
    expect(outcome).toEqual({ kind: 'protected', antibiotic: 'gramPositive' });
    expect(inventory.snapshot()).toEqual({ gramPositive: 0, gramNegative: 1 });
  });

  it('consumes the matching Gram-negative antibiotic and protects Santa', () => {
    const inventory = createInventory();
    const outcome = resolveBacteriumContact('gramNegative', inventory, false);
    expect(outcome).toEqual({ kind: 'protected', antibiotic: 'gramNegative' });
    expect(inventory.snapshot()).toEqual({ gramPositive: 1, gramNegative: 0 });
  });

  it('defeats Santa when the matching antibiotic is missing, even if the other is ready', () => {
    const inventory = createInventory(0, 1);
    expect(resolveBacteriumContact('gramPositive', inventory, false)).toEqual({ kind: 'defeated', cause: 'gramPositive' });
    expect(inventory.snapshot()).toEqual({ gramPositive: 0, gramNegative: 1 });

    const other = createInventory(1, 0);
    expect(resolveBacteriumContact('gramNegative', other, false)).toEqual({ kind: 'defeated', cause: 'gramNegative' });
    expect(other.snapshot()).toEqual({ gramPositive: 1, gramNegative: 0 });
  });

  it('MDR always defeats Santa, regardless of inventory or invulnerability', () => {
    for (const [gramPositive, gramNegative] of [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ] as const) {
      for (const invulnerable of [false, true]) {
        const inventory = createInventory(gramPositive, gramNegative);
        expect(resolveBacteriumContact('mdr', inventory, invulnerable)).toEqual({ kind: 'defeated', cause: 'mdr' });
        expect(inventory.snapshot()).toEqual({ gramPositive, gramNegative });
      }
    }
  });

  it('ignores treatable bacteria during invulnerability without consuming antibiotics', () => {
    const inventory = createInventory();
    expect(resolveBacteriumContact('gramPositive', inventory, true)).toEqual({ kind: 'ignored' });
    expect(resolveBacteriumContact('gramNegative', createInventory(0, 0), true)).toEqual({ kind: 'ignored' });
    expect(inventory.snapshot()).toEqual({ gramPositive: 1, gramNegative: 1 });
  });

  it('provides a family-friendly message for every defeat cause', () => {
    expect(DEFEAT_MESSAGES.gramPositive.title).toBe('Gram-positive infection!');
    expect(DEFEAT_MESSAGES.gramNegative.title).toBe('Gram-negative infection!');
    expect(DEFEAT_MESSAGES.mdr.title).toBe('Multidrug-resistant superbug!');
  });
});
