import { describe, expect, it } from 'vitest';
import { duracion } from './hora.svelte';

describe('duracion', () => {
  it('minutos y segundos, y horas cuando pasa de una', () => {
    expect(duracion(0)).toBe('0:00');
    expect(duracion(7_000)).toBe('0:07');
    expect(duracion(307_000)).toBe('5:07');
    expect(duracion(3_907_000)).toBe('1:05:07');
  });
  it('un reloj adelantado no da negativo', () => expect(duracion(-5_000)).toBe('0:00'));
});
