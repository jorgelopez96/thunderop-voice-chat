import { describe, it, expect } from 'vitest';
import { contarNoLeidos } from './privados.svelte';

describe('contarNoLeidos', () => {
  const ms = [
    { author: 'ana', created: '2026-10-20 10:00:00.000Z' },
    { author: 'yo', created: '2026-10-20 10:01:00.000Z' },
    { author: 'ana', created: '2026-10-20 10:02:00.000Z' },
  ];
  it('solo los del otro posteriores a lo leído', () => {
    expect(contarNoLeidos(ms, 'yo', '2026-10-20 10:00:00.000Z')).toBe(1);
    expect(contarNoLeidos(ms, 'yo', '2026-10-20 10:02:00.000Z')).toBe(0);
  });
  it('sin nada leído cuenta todos los del otro', () => {
    expect(contarNoLeidos(ms, 'yo', undefined)).toBe(2);
  });
});
