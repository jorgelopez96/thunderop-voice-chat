import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { leerPrefs, guardarPrefs } from './prefs';
import { volumen } from './voz.svelte';

const DEFAULTS = { supresion: false, volumenes: {}, calidad: '1080p60', gpu: true };

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
    expect(leerPrefs()).toEqual({ ...DEFAULTS, entrada: 'mic1', supresion: true, volumenes: { a: 0.5, b: 2 } });
  });

  it('calidad y gpu tienen defaults', () => {
    expect(leerPrefs()).toMatchObject({ calidad: '1080p60', gpu: true });
  });

  it('calidad inválida cae al default', () => {
    localStorage.setItem('dm.voz', JSON.stringify({ calidad: '4k' }));
    expect(leerPrefs().calidad).toBe('1080p60');
  });

  it('gpu false se respeta', () => {
    localStorage.setItem('dm.voz', JSON.stringify({ gpu: false }));
    expect(leerPrefs().gpu).toBe(false);
  });

  it('localStorage que tira error no rompe', () => {
    const roto = () => { throw new Error('bloqueado'); };
    vi.stubGlobal('localStorage', { getItem: roto, setItem: roto });
    expect(leerPrefs()).toEqual(DEFAULTS);
    expect(() => guardarPrefs({ supresion: true })).not.toThrow();
  });

  it('volumen se acota a 0..2 e ignora valores no finitos', () => {
    volumen('a', 5); volumen('b', -1); volumen('c', 1.5);
    volumen('a', NaN); volumen('d', Infinity);
    expect(leerPrefs().volumenes).toEqual({ a: 2, b: 0, c: 1.5 });
  });
});
