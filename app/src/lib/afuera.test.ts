import { describe, expect, it, vi } from 'vitest';
import { cerrarAfuera } from './afuera';

// Un <dialog> de mentira: solo eventos y close().
function armar() {
  const h: Record<string, (e: { target: unknown }) => void> = {};
  const d = { addEventListener: (t: string, f: (e: { target: unknown }) => void) => (h[t] = f), removeEventListener: () => {}, close: vi.fn() };
  cerrarAfuera(d as unknown as HTMLDialogElement);
  const adentro = {};
  return { h, d, adentro };
}

describe('cerrar el modal tocando afuera', () => {
  it('apretar y soltar afuera lo cierra', () => {
    const { h, d } = armar();
    h.pointerdown({ target: d });
    h.click({ target: d });
    expect(d.close).toHaveBeenCalledOnce();
  });
  it('seleccionar texto adentro y soltar afuera no lo cierra', () => {
    const { h, d, adentro } = armar();
    h.pointerdown({ target: adentro });
    h.click({ target: d }); // el navegador manda el clic al ancestro común: el dialog
    expect(d.close).not.toHaveBeenCalled();
  });
  it('apretar afuera y soltar adentro tampoco', () => {
    const { h, d, adentro } = armar();
    h.pointerdown({ target: d });
    h.click({ target: adentro });
    expect(d.close).not.toHaveBeenCalled();
  });
});
