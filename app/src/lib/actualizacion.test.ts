import { describe, it, expect } from 'vitest';
import { progresoDe } from './actualizacion.svelte';

describe('progresoDe', () => {
  it('fracción acotada; sin total → 0', () => {
    expect(progresoDe(50, 100)).toBe(0.5);
    expect(progresoDe(10, undefined)).toBe(0);
    expect(progresoDe(150, 100)).toBe(1);
  });
});
