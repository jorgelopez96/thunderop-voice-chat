import { describe, expect, it } from 'vitest';
import { ColaPcm, aMuestras } from './colaPcm';

const f = (...n: number[]) => new Float32Array(n);
const sacar = (c: ColaPcm, n: number) => { const d = new Float32Array(n); c.sacar(d); return [...d]; };

describe('ColaPcm', () => {
  it('saca lo que entró en orden', () => {
    const c = new ColaPcm(8);
    c.meter(f(1, 2)); c.meter(f(3, 4));
    expect(c.largo).toBe(4);
    expect(sacar(c, 3)).toEqual([1, 2, 3]);
    expect(c.largo).toBe(1);
  });
  it('rellena con ceros si falta', () => {
    const c = new ColaPcm(8);
    c.meter(f(1, 2));
    expect(sacar(c, 4)).toEqual([1, 2, 0, 0]);
    expect(c.largo).toBe(0);
  });
  it('al pasarse del máximo descarta lo más viejo', () => {
    const c = new ColaPcm(4);
    c.meter(f(1, 2, 3)); c.meter(f(4, 5, 6));
    expect(sacar(c, 4)).toEqual([3, 4, 5, 6]);
  });
  it('lote más grande que el máximo conserva solo el final', () => {
    const c = new ColaPcm(3);
    c.meter(f(1, 2, 3, 4, 5));
    expect(c.largo).toBe(3);
    expect(sacar(c, 3)).toEqual([3, 4, 5]);
  });
});

describe('aMuestras', () => {
  it('toma el ArrayBuffer tal cual', () => {
    const b = f(0.5, -1).buffer;
    expect([...aMuestras(b)!]).toEqual([0.5, -1]);
  });
  it('convierte el number[] de bytes que manda la IPC por postMessage', () => {
    expect([...aMuestras([...new Uint8Array(f(0.25, 2).buffer)])!]).toEqual([0.25, 2]);
  });
  it('descarta lo que no son muestras sin tirar error', () => {
    expect(aMuestras([1, 2, 3])).toBeNull();
    expect(aMuestras('x')).toBeNull();
    expect(aMuestras(null)).toBeNull();
  });
});
