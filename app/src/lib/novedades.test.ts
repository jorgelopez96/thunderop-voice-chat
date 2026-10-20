import { describe, it, expect } from 'vitest';
import conf from '../../src-tauri/tauri.conf.json';
import { NOVEDADES } from './novedades';

const num = (v: string) => v.split('.').map(Number);
const mayor = (a: string, b: string) => { const [x, y] = [num(a), num(b)]; for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]; return false; };

describe('NOVEDADES', () => {
  it('la primera es la versión de la app', () => {
    expect(NOVEDADES[0].version).toBe(conf.version);
  });
  it('de más nueva a más vieja, cada una con cambios', () => {
    for (let i = 1; i < NOVEDADES.length; i++) expect(mayor(NOVEDADES[i - 1].version, NOVEDADES[i].version)).toBe(true);
    for (const n of NOVEDADES) expect(n.cambios.length).toBeGreaterThan(0);
  });
});
