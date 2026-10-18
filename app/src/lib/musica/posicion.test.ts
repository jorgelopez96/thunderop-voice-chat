import { describe, it, expect } from 'vitest';
import { posicion, desfase, muestra, mejor } from './posicion';

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

describe('mejor muestra', () => {
  const buena = muestra(5_100, 1_000, 1_200); // rtt 200, desfase 4000, en 1200
  it('muestra mide rtt y desfase', () => expect(buena).toEqual({ desfase: 4_000, rtt: 200, en: 1_200 }));
  it('la primera siempre entra', () => expect(mejor(null, buena, 1_200)).toBe(buena));
  it('gana la de menor ida y vuelta', () => {
    const mejorRtt = muestra(6_050, 2_000, 2_100);
    expect(mejor(buena, mejorRtt, 2_100)).toBe(mejorRtt);
  });
  it('una peor no pisa a una buena reciente', () => {
    const lenta = muestra(9_000, 3_000, 5_500); // 2,5 s de ida y vuelta (p. ej. agregar con oEmbed)
    expect(mejor(buena, lenta, 5_500)).toBe(buena);
  });
  it('una peor sí pisa a una vencida', () => {
    const lenta = muestra(400_000, 396_000, 396_500);
    expect(mejor(buena, lenta, 396_500)).toBe(lenta);
  });
});
