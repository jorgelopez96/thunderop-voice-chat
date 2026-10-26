import { afterEach, describe, expect, it, vi } from 'vitest';
import { mostrar, pedirPermiso } from './notifNavegador';

afterEach(() => vi.unstubAllGlobals());

describe('notificaciones del navegador', () => {
  it('mostrar nunca pide permiso (sin gesto del usuario los navegadores lo rechazan)', () => {
    const pedir = vi.fn();
    vi.stubGlobal('Notification', Object.assign(vi.fn(), { permission: 'default', requestPermission: pedir }));
    mostrar('t', 'x');
    expect(pedir).not.toHaveBeenCalled();
    expect(Notification).not.toHaveBeenCalled();
  });

  it('si el navegador no deja crearla (Chrome de Android) no tira error', () => {
    vi.stubGlobal('Notification', Object.assign(function () { throw new TypeError('Illegal constructor'); }, { permission: 'granted' }));
    expect(() => mostrar('t', 'x')).not.toThrow();
  });

  it('pedirPermiso devuelve lo que contesta el usuario, o sin-soporte', async () => {
    vi.stubGlobal('Notification', { permission: 'default', requestPermission: () => Promise.resolve('denied') });
    expect(await pedirPermiso()).toBe('denied');
    vi.stubGlobal('Notification', undefined);
    expect(await pedirPermiso()).toBe('sin-soporte');
  });
});
