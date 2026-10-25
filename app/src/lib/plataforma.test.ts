import { afterEach, describe, expect, it, vi } from 'vitest';

// matchMedia falso: arranca en `inicial` y deja disparar el cambio a mano.
function medios(inicial: boolean) {
  let oyente: ((e: { matches: boolean }) => void) | null = null;
  const m = { matches: inicial, addEventListener: (_: string, f: (e: { matches: boolean }) => void) => (oyente = f) };
  vi.stubGlobal('matchMedia', () => m);
  return (matches: boolean) => { m.matches = matches; oyente?.({ matches }); };
}

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

describe('plataforma', () => {
  it('pantalla.movil sigue al media query de 768 px', async () => {
    const cambiar = medios(false);
    const { pantalla } = await import('./plataforma.svelte');
    expect(pantalla.movil).toBe(false);
    cambiar(true);
    expect(pantalla.movil).toBe(true);
  });

  it('puedeTransmitir depende de getDisplayMedia fuera del escritorio', async () => {
    medios(false);
    vi.stubGlobal('navigator', { mediaDevices: {} });
    const p = await import('./plataforma.svelte');
    expect(p.esEscritorio).toBe(false);
    expect(p.puedeTransmitir()).toBe(false);
    vi.stubGlobal('navigator', { mediaDevices: { getDisplayMedia: () => {} } });
    expect(p.puedeTransmitir()).toBe(true);
  });
});
