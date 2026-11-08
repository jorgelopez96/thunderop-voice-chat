import { describe, it, expect } from 'vitest';
import { sinRepetidos, conNombres } from './voz.svelte';

const n = (deviceId: string, groupId: string, label: string) => ({ deviceId, groupId, label });

describe('conNombres', () => {
  it('le pone al Predeterminado el nombre del dispositivo real, sin el código USB (lo que lista Edge en Windows)', () => {
    const lista = [n('default', 'g1', 'Predeterminado - Micrófono (Yeti Orb) (046d:0ad5)'), n('communications', 'g1', 'Comunicaciones - Micrófono (Yeti Orb) (046d:0ad5)'),
      n('abc', 'g2', 'Micrófono (Logitech PRO X Wireless Gaming Headset) (046d:0aba)'), n('def', 'g1', 'Micrófono (Yeti Orb) (046d:0ad5)')];
    expect(conNombres(lista).map((x) => x.label)).toEqual(['Predeterminado · Micrófono (Yeti Orb)', 'Micrófono (Logitech PRO X Wireless Gaming Headset)']);
  });
  it('sin el real usa lo que viene después del guion, y sin nada queda Predeterminado', () => {
    expect(conNombres([n('default', 'g1', 'Default - Altavoces (USB)')])[0].label).toBe('Predeterminado · Altavoces (USB)');
    expect(conNombres([n('default', 'g1', '')])[0].label).toBe('Predeterminado');
  });
});

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
