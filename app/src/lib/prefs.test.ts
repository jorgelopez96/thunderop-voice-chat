import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { leerPrefs, guardarPrefs } from './prefs';
import { volumen } from './voz.svelte';

const DEFAULTS = { supresion: true, volumenes: {}, calidad: '1080p60', gpu: true, vistaPrevia: true, volBotonera: 0.8, volMusica: 50, gananciaDb: 0, sonidoMensajes: true, notificaciones: true, verVarias: 1 };

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

  it('reenciende la supresión una vez', () => {
    localStorage.setItem('dm.voz', JSON.stringify({ supresion: false }));
    expect(leerPrefs().supresion).toBe(true);
    guardarPrefs({ supresion: false });
    expect(leerPrefs().supresion).toBe(false);
  });

  it('ganancia fuera de rango vuelve a 0', () => {
    for (const g of [50, -21, 'x']) {
      localStorage.setItem('dm.voz', JSON.stringify({ v: 2, gananciaDb: g }));
      expect(leerPrefs().gananciaDb).toBe(0);
    }
    guardarPrefs({ gananciaDb: -6 });
    expect(leerPrefs().gananciaDb).toBe(-6);
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

  it('vistaPrevia: default true y false se respeta', () => {
    expect(leerPrefs().vistaPrevia).toBe(true);
    localStorage.setItem('dm.voz', JSON.stringify({ vistaPrevia: false }));
    expect(leerPrefs().vistaPrevia).toBe(false);
  });

  it('volBotonera (0-1) y volMusica (0-100): defaults, valores válidos e inválidos', () => {
    localStorage.setItem('dm.voz', JSON.stringify({ volBotonera: 0.3, volMusica: 70 }));
    expect(leerPrefs()).toMatchObject({ volBotonera: 0.3, volMusica: 70 });
    for (const malo of [{ volBotonera: 2, volMusica: 101 }, { volBotonera: -1, volMusica: -5 }, { volBotonera: '1', volMusica: null }]) {
      localStorage.setItem('dm.voz', JSON.stringify(malo));
      expect(leerPrefs()).toMatchObject({ volBotonera: 0.8, volMusica: 50 });
    }
    localStorage.setItem('dm.voz', JSON.stringify({ volBotonera: 0, volMusica: 0 }));
    expect(leerPrefs()).toMatchObject({ volBotonera: 0, volMusica: 0 });
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

  it('los volúmenes guardados antes de la versión 3 se pasan a la mitad (200% viejo = 100% nuevo)', () => {
    localStorage.setItem('dm.voz', JSON.stringify({ v: 2, supresion: false, volumenes: { a: 2, b: 1 } }));
    expect(leerPrefs()).toMatchObject({ supresion: false, volumenes: { a: 1, b: 0.5 } });
  });
});
