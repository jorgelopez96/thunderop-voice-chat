import { describe, it, expect } from 'vitest';
import { dbALineal, dbDePorcentaje, porcentajeDeDb } from './ganancia';

describe('dbALineal', () => {
  it('0 dB = 1, ±20 dB = ×10 / ×0.1, acotado', () => {
    expect(dbALineal(0)).toBe(1);
    expect(dbALineal(20)).toBeCloseTo(10);
    expect(dbALineal(-20)).toBeCloseTo(0.1);
    expect(dbALineal(40)).toBeCloseTo(10);
  });
  it('porcentaje de la barrita: 0% = −20 dB, 50% = 0 dB, 100% = +20 dB, ida y vuelta', () => {
    expect(dbDePorcentaje(0)).toBe(-20);
    expect(dbDePorcentaje(50)).toBe(0);
    expect(dbDePorcentaje(100)).toBe(20);
    expect(porcentajeDeDb(dbDePorcentaje(37))).toBe(37);
    expect(porcentajeDeDb(-6)).toBe(35);
  });
});
