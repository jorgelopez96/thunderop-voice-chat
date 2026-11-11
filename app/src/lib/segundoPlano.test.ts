import { beforeEach, describe, expect, it, vi } from 'vitest';

// Navegador de celular de mentira: wake lock, media session y la visibilidad de la página.
function armar({ wakeLock = true } = {}) {
  const oyentes: Record<string, () => void> = {};
  const doc = { visibilityState: 'visible', addEventListener: (t: string, f: () => void) => (oyentes[t] = f) };
  const trabas: { liberada: boolean; soltar: () => void }[] = [];
  const request = vi.fn(async () => {
    let alSoltar = () => {};
    const t = {
      liberada: false,
      release: async () => { t.liberada = true; alSoltar(); },
      addEventListener: (_: string, f: () => void) => (alSoltar = f),
      soltar: () => alSoltar(),
    };
    trabas.push(t);
    return t;
  });
  const acciones: Record<string, (() => void) | null> = {};
  const mediaSession = {
    metadata: null as { title: string; album?: string } | null,
    playbackState: 'none',
    setActionHandler: (n: string, f: (() => void) | null) => { if (n === 'togglemicrophone') throw new TypeError('no la conoce'); acciones[n] = f; },
  };
  vi.stubGlobal('document', doc);
  vi.stubGlobal('navigator', { mediaSession, ...(wakeLock ? { wakeLock: { request } } : {}) });
  vi.stubGlobal('MediaMetadata', class { title: string; album = ''; constructor(m: { title: string }) { this.title = m.title; } });
  return { doc, oyentes, request, trabas, acciones, mediaSession };
}

beforeEach(() => { vi.resetModules(); vi.unstubAllGlobals(); });

describe('llamada en el celular', () => {
  it('traba la pantalla al entrar y la suelta al salir', async () => {
    const n = armar();
    const sp = await import('./segundoPlano');
    sp.empezarLlamada('General', false, { colgar: () => {}, alternarMic: () => {}, ponerMic: () => {} });
    await vi.waitFor(() => expect(n.request).toHaveBeenCalledWith('screen'));
    sp.terminarLlamada();
    await vi.waitFor(() => expect(n.trabas[0].liberada).toBe(true));
  });

  it('al volver de segundo plano la pide de nuevo, solo si sigue en llamada', async () => {
    const n = armar();
    const sp = await import('./segundoPlano');
    sp.empezarLlamada('General', false, { colgar: () => {}, alternarMic: () => {}, ponerMic: () => {} });
    await vi.waitFor(() => expect(n.request).toHaveBeenCalledTimes(1));
    n.doc.visibilityState = 'hidden';
    n.trabas[0].soltar(); // el sistema la suelta al ocultarse
    n.oyentes.visibilitychange();
    expect(n.request).toHaveBeenCalledTimes(1); // oculta: no se pide
    n.doc.visibilityState = 'visible';
    n.oyentes.visibilitychange();
    await vi.waitFor(() => expect(n.request).toHaveBeenCalledTimes(2));
    sp.terminarLlamada();
    n.oyentes.visibilitychange();
    await Promise.resolve();
    expect(n.request).toHaveBeenCalledTimes(2);
  });

  it('pantalla de bloqueo: nombre de la sala, pausa = micrófono y colgar', async () => {
    const n = armar();
    const sp = await import('./segundoPlano');
    const colgar = vi.fn(), alternarMic = vi.fn(), ponerMic = vi.fn();
    sp.empezarLlamada('Juegos', false, { colgar, alternarMic, ponerMic });
    expect(n.mediaSession.metadata?.title).toBe('Juegos');
    expect(n.mediaSession.playbackState).toBe('playing');
    // Pausa siempre apaga y reproducir siempre prende (Android manda pausa solo, por ejemplo al entrar una llamada).
    n.acciones.pause?.();
    n.acciones.pause?.();
    n.acciones.play?.();
    n.acciones.hangup?.();
    expect(ponerMic.mock.calls).toEqual([[false], [false], [true]]);
    expect(alternarMic).not.toHaveBeenCalled();
    expect(colgar).toHaveBeenCalledOnce();
    sp.micEnPantalla(true);
    expect(n.mediaSession.playbackState).toBe('paused');
    expect(n.mediaSession.metadata?.album).toBe('Micrófono apagado');
    sp.terminarLlamada();
    expect(n.mediaSession.metadata).toBeNull();
    expect(n.acciones.hangup).toBeNull();
  });

  it('sin wake lock no rompe', async () => {
    armar({ wakeLock: false });
    const sp = await import('./segundoPlano');
    expect(() => sp.empezarLlamada('General', true, { colgar: () => {}, alternarMic: () => {}, ponerMic: () => {} })).not.toThrow();
    sp.terminarLlamada();
  });
});
