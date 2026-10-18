import { describe, it, expect } from 'vitest';
import { posicion, desfase } from './posicion';

describe('posicion', () => {
  it('reproduciendo calcula desde inicio', () => expect(posicion({ inicioMs: 10_000, pausaS: null }, 75_500)).toBe(65.5));
  it('en pausa devuelve pausaS', () => {
    expect(posicion({ inicioMs: 10_000, pausaS: 42.25 }, 999_999)).toBe(42.25);
    expect(posicion({ inicioMs: 10_000, pausaS: 0 }, 999_999)).toBe(0); // 0 es una pausa válida
  });
  it('antes del inicio da 0', () => expect(posicion({ inicioMs: 10_000, pausaS: null }, 8_500)).toBe(0));
});

describe('desfase', () => {
  it('desfase NTP', () => {
    expect(desfase(1_000, 1_000, 1_000)).toBe(0); // relojes iguales, sin latencia
    expect(desfase(5_100, 1_000, 1_200)).toBe(4_000); // servidor 4 s adelante, 200 ms de ida y vuelta
    expect(desfase(1_050, 3_000, 3_100)).toBe(-2_000); // servidor 2 s atrás
  });
});
