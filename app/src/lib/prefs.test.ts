import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { leerPrefs, guardarPrefs } from './prefs';

const DEFAULTS = { supresion: false, volumenes: {} };

describe('prefs de voz', () => {
  // Vitest corre en Node (sin localStorage): uno en memoria por test.
  beforeEach(() => {
    const m = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('sin nada guardado devuelve defaults', () => {
    expect(leerPrefs()).toEqual(DEFAULTS);
  });

  it('JSON roto devuelve defaults', () => {
    localStorage.setItem('dm.voz', '{roto');
    expect(leerPrefs()).toEqual(DEFAULTS);
  });

  it('guardarPrefs mezcla y conserva volúmenes previos', () => {
    guardarPrefs({ entrada: 'mic1', volumenes: { a: 0.5 } });
    guardarPrefs({ supresion: true, volumenes: { b: 2 } });
    expect(leerPrefs()).toEqual({ entrada: 'mic1', supresion: true, volumenes: { a: 0.5, b: 2 } });
  });

  it('localStorage que tira error no rompe', () => {
    const roto = () => { throw new Error('bloqueado'); };
    vi.stubGlobal('localStorage', { getItem: roto, setItem: roto });
    expect(leerPrefs()).toEqual(DEFAULTS);
    expect(() => guardarPrefs({ supresion: true })).not.toThrow();
  });
});
