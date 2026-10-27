import { describe, it, expect } from 'vitest';
import { sinRepetidos } from './voz.svelte';

const d = (deviceId: string, groupId: string) => ({ deviceId, groupId });

describe('sinRepetidos', () => {
  it('deja el predeterminado y saca Comunicaciones y el mismo dispositivo con su nombre', () => {
    const lista = [d('default', 'g1'), d('communications', 'g2'), d('abc', 'g1'), d('xyz', 'g2')];
    expect(sinRepetidos(lista).map((x) => x.deviceId)).toEqual(['default', 'xyz']);
  });
  it('sin predeterminado deja todos los que tienen id propio', () => {
    expect(sinRepetidos([d('abc', 'g1'), d('xyz', 'g2')]).map((x) => x.deviceId)).toEqual(['abc', 'xyz']);
  });
});
