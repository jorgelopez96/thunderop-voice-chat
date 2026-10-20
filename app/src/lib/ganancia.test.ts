import { describe, it, expect } from 'vitest';
import { dbALineal } from './ganancia';

describe('dbALineal', () => {
  it('0 dB = 1, ±20 dB = ×10 / ×0.1, acotado', () => {
    expect(dbALineal(0)).toBe(1);
    expect(dbALineal(20)).toBeCloseTo(10);
    expect(dbALineal(-20)).toBeCloseTo(0.1);
    expect(dbALineal(40)).toBeCloseTo(10);
  });
});
