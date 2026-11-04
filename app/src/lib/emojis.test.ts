import { describe, it, expect, vi, beforeEach } from 'vitest';
import { leerCategoria, buscar, conTono, sinTono, agregarReciente, leerRecientes, guardarRecientes, leerTono, mover, normalizar, TONOS, MAX_RECIENTES } from './emojis';
import { CATEGORIAS } from './emojisDatos';

const todas = CATEGORIAS.map(leerCategoria);
const lista = todas.flat();
const de = (e: string) => lista.find((x) => x.e === e)!;

describe('datos generados', () => {
  it('trae las 9 categorías con todos los emojis y sin tonos sueltos', () => {
    expect(todas).toHaveLength(9);
    expect(lista.length).toBeGreaterThan(1850);
    expect(new Set(lista.map((x) => x.e)).size).toBe(lista.length);
    expect(lista.some((x) => /[\u{1F3FB}-\u{1F3FF}]/u.test(x.e))).toBe(false);
    expect(todas[8].some((x) => x.e === '🇦🇷')).toBe(true);
  });
  it('lee nombre en español, tono y versión', () => {
    expect(de('😀')).toMatchObject({ nombre: 'cara sonriendo', tono: false, version: '' });
    expect(de('👋').tono).toBe(true);
    expect(de('🥲').version).toBe('13.0');
  });
  it('los que había antes siguen estando', () => {
    for (const e of '😂 🤣 🫡 🤙 ✌️ ❤️ 🔥 💯 🐐 💩'.split(' ')) expect(de(e)).toBeTruthy();
  });
  it('ninguno pasa el tope de 16 del servidor para reaccionar, ni con tono', () => {
    for (const x of lista) expect(conTono(x.e, x.tono ? TONOS[5] : '').length).toBeLessThanOrEqual(16);
  });
});

describe('conTono', () => {
  it('pone el tono a cada persona y saca el FE0F', () => {
    expect(conTono('👋', '🏽')).toBe('👋🏽');
    expect(conTono('🕵️‍♀️', '🏻')).toBe('🕵🏻‍♀️');
    expect(conTono('👩‍❤️‍👨', '🏿')).toBe('👩🏿‍❤️‍👨🏿');
    expect(conTono('👋', '')).toBe('👋');
    expect(sinTono(conTono('🕵️‍♀️', '🏾'))).toBe(sinTono('🕵️‍♀️'));
  });
});

describe('buscar', () => {
  it('encuentra en español, sin tildes ni mayúsculas, por comienzo de palabra', () => {
    expect(buscar(lista, 'Corazón').map((x) => x.e)).toContain('❤️');
    expect(buscar(lista, 'argen').map((x) => x.e)).toContain('🇦🇷');
    expect(buscar(lista, 'gato').map((x) => x.e)).toContain('🐈');
    expect(buscar(lista, 'ato').map((x) => x.e)).not.toContain('🐈');
  });
  it('todas las palabras tienen que estar, y primero las del nombre', () => {
    const r = buscar(lista, 'cara risa');
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((x) => x.t.includes(' cara') && x.t.includes(' risa'))).toBe(true);
    const i = r.findIndex((x) => !x.n.includes(' risa'));
    expect(i === -1 || r.slice(i).every((x) => !x.n.includes(' risa') || !x.n.includes(' cara'))).toBe(true);
  });
  it('vacío o sin letras no da nada', () => {
    expect(buscar(lista, '   ')).toEqual([]);
    expect(buscar(lista, 'zzzqqq')).toEqual([]);
  });
  it('normalizar', () => expect(normalizar('  ¡Pingüino, Ñandú!  ')).toBe('pinguino nandu'));
});

describe('recientes y tono', () => {
  let m: Map<string, string>;
  beforeEach(() => {
    m = new Map();
    vi.stubGlobal('localStorage', { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } });
  });
  it('el elegido va primero, sin repetir y con tope', () => {
    expect(agregarReciente(['😀', '🔥'], '🔥')).toEqual(['🔥', '😀']);
    const muchos = Array.from({ length: 40 }, (_, i) => String(i));
    expect(agregarReciente(muchos, '😀')).toHaveLength(MAX_RECIENTES);
  });
  it('se guardan y se leen; lo roto da vacío', () => {
    guardarRecientes(['🔥', '😀']);
    expect(leerRecientes()).toEqual(['🔥', '😀']);
    m.set('dm.emojis.recientes', '{roto');
    expect(leerRecientes()).toEqual([]);
    m.set('dm.emojis.recientes', '{"a":1}');
    expect(leerRecientes()).toEqual([]);
  });
  it('tono fuera de rango vuelve al predeterminado', () => {
    expect(leerTono()).toBe(0);
    m.set('dm.emojis.tono', '3');
    expect(leerTono()).toBe(3);
    m.set('dm.emojis.tono', '9');
    expect(leerTono()).toBe(0);
  });
});

describe('mover', () => {
  // Dos secciones: 5 emojis (fila de 4 + 1) y 6, en 4 columnas.
  const l = [5, 6];
  it('izquierda/derecha cruzan de sección', () => {
    expect(mover(l, [0, 4], 'ArrowRight', 4)).toEqual([1, 0]);
    expect(mover(l, [1, 0], 'ArrowLeft', 4)).toEqual([0, 4]);
    expect(mover(l, [0, 0], 'ArrowLeft', 4)).toEqual([0, 0]);
    expect(mover(l, [1, 5], 'ArrowRight', 4)).toEqual([1, 5]);
  });
  it('abajo baja una fila, cae al último si la fila está incompleta y sigue en la sección de abajo', () => {
    expect(mover(l, [0, 0], 'ArrowDown', 4)).toEqual([0, 4]);
    expect(mover(l, [0, 2], 'ArrowDown', 4)).toEqual([0, 4]);
    expect(mover(l, [0, 4], 'ArrowDown', 4)).toEqual([1, 0]);
    expect(mover(l, [1, 3], 'ArrowDown', 4)).toEqual([1, 5]);
  });
  it('arriba sube y pasa a la última fila de la sección de arriba', () => {
    expect(mover(l, [1, 5], 'ArrowUp', 4)).toEqual([1, 1]);
    expect(mover(l, [1, 1], 'ArrowUp', 4)).toEqual([0, 4]);
    expect(mover(l, [1, 0], 'ArrowUp', 4)).toEqual([0, 4]);
    expect(mover(l, [0, 3], 'ArrowUp', 4)).toEqual([0, 3]);
  });
});
