import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mantener } from './mantener';

function armar() {
  const h: Record<string, (e: Partial<PointerEvent> & { preventDefault?: () => void }) => void> = {};
  const nodo = { addEventListener: (t: string, f: (e: Partial<PointerEvent>) => void) => (h[t] = f), removeEventListener: () => {} } as unknown as HTMLElement;
  const llamado = vi.fn();
  mantener(nodo, llamado);
  const toque = (x: number, y: number) => h.pointerdown({ clientX: x, clientY: y, pointerType: 'touch' });
  return { h, llamado, toque };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('mantener apretado', () => {
  it('a los 500 ms quieto llama con la posición del dedo', () => {
    const { llamado, toque } = armar();
    toque(100, 200);
    vi.advanceTimersByTime(499);
    expect(llamado).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(llamado).toHaveBeenCalledWith(100, 200);
  });

  it('soltar antes de tiempo no llama', () => {
    const { h, llamado, toque } = armar();
    toque(100, 200);
    vi.advanceTimersByTime(300);
    h.pointerup({ clientX: 100, clientY: 200 });
    vi.advanceTimersByTime(500);
    expect(llamado).not.toHaveBeenCalled();
  });

  it('arrastrar (scroll) no llama', () => {
    const { h, llamado, toque } = armar();
    toque(100, 200);
    h.pointermove({ clientX: 100, clientY: 230 });
    vi.advanceTimersByTime(600);
    expect(llamado).not.toHaveBeenCalled();
  });

  it('con mouse no hace nada (en la PC está el clic derecho y el pasar el mouse)', () => {
    const { h, llamado } = armar();
    h.pointerdown({ clientX: 1, clientY: 1, pointerType: 'mouse' });
    vi.advanceTimersByTime(600);
    expect(llamado).not.toHaveBeenCalled();
  });
});
