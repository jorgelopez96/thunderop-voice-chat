import { afterEach, describe, expect, it, vi } from 'vitest';
import { deslizar } from './deslizar';

// Nodo falso: guarda los manejadores para dispararlos a mano.
function armar() {
  const h: Record<string, (e: Partial<PointerEvent>) => void> = {};
  const nodo = { addEventListener: (t: string, f: (e: Partial<PointerEvent>) => void) => (h[t] = f), removeEventListener: () => {} } as unknown as HTMLElement;
  const izq = vi.fn(), der = vi.fn();
  deslizar(nodo, { alAbrirIzq: izq, alAbrirDer: der });
  const gesto = (x0: number, y0: number, x1: number, y1: number) => {
    h.pointerdown({ clientX: x0, clientY: y0, pointerType: 'touch' });
    h.pointermove({ clientX: x1, clientY: y1, pointerType: 'touch' });
    h.pointerup?.({ clientX: x1, clientY: y1, pointerType: 'touch' });
  };
  return { gesto, izq, der };
}

afterEach(() => vi.unstubAllGlobals());

describe('deslizar desde el borde', () => {
  it('desde el borde izquierdo hacia la derecha abre el cajón izquierdo', () => {
    vi.stubGlobal('innerWidth', 390);
    const { gesto, izq, der } = armar();
    gesto(10, 300, 90, 305);
    expect(izq).toHaveBeenCalledOnce();
    expect(der).not.toHaveBeenCalled();
  });

  it('desde el borde derecho hacia la izquierda abre el cajón derecho', () => {
    vi.stubGlobal('innerWidth', 390);
    const { gesto, der } = armar();
    gesto(380, 300, 300, 300);
    expect(der).toHaveBeenCalledOnce();
  });

  it('lejos del borde no hace nada', () => {
    vi.stubGlobal('innerWidth', 390);
    const { gesto, izq, der } = armar();
    gesto(200, 300, 300, 300);
    expect(izq).not.toHaveBeenCalled();
    expect(der).not.toHaveBeenCalled();
  });

  it('un arrastre vertical (scroll) no abre nada', () => {
    vi.stubGlobal('innerWidth', 390);
    const { gesto, izq } = armar();
    gesto(10, 300, 30, 400);
    expect(izq).not.toHaveBeenCalled();
  });
});
