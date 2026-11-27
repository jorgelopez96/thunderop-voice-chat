import { describe, it, expect, vi, beforeEach } from 'vitest';

// Pulsar para hablar y los atajos de alternar, con la app y la voz de mentira.
const h = vi.hoisted(() => ({ voz: { salaId: 'sala' as string | null, muteado: true, ensordecido: false }, oyente: null as null | ((e: { payload: { codigo: number; abajo: boolean } }) => void) }));
vi.mock('@tauri-apps/api/core', () => ({ isTauri: () => true, invoke: vi.fn(async () => {}) }));
vi.mock('./plataforma.svelte', async (original) => ({ ...(await original<typeof import('./plataforma.svelte')>()), esWindows: true }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async (_: string, f: typeof h.oyente) => { h.oyente = f; return () => {}; }) }));
vi.mock('./voz.svelte', () => ({
  voz: h.voz,
  alternarMute: vi.fn(async () => { h.voz.muteado = !h.voz.muteado; }),
  ensordecer: vi.fn(async (si: boolean) => { h.voz.ensordecido = si; }),
}));
const { iniciarAtajos, guardarAtajo } = await import('./atajos.svelte');

const LATERAL = 0x1_0005, RUEDA = 0x1_0004; // botones del mouse: no pasan por el chequeo de "estás escribiendo"
const apretar = (codigo: number, abajo: boolean) => h.oyente!({ payload: { codigo, abajo } });

describe('atajos', () => {
  beforeEach(async () => {
    Object.assign(h.voz, { salaId: 'sala', muteado: true, ensordecido: false });
    guardarAtajo('hablar', { codigo: LATERAL, nombre: 'Lateral' });
    guardarAtajo('silenciar', { codigo: RUEDA, nombre: 'Rueda' });
    iniciarAtajos();
    await vi.waitFor(() => expect(h.oyente).toBeTruthy());
  });
  it('pulsar para hablar: silenciado, prende el mic mientras se mantiene y lo apaga al soltar', () => {
    apretar(LATERAL, true);
    expect(h.voz.muteado).toBe(false);
    apretar(LATERAL, false);
    expect(h.voz.muteado).toBe(true);
  });
  it('pulsar para hablar sin estar silenciado no hace nada (ni al soltar)', () => {
    h.voz.muteado = false;
    apretar(LATERAL, true);
    apretar(LATERAL, false);
    expect(h.voz.muteado).toBe(false);
  });
  it('silenciar alterna solo al apretar, y fuera de una sala no hace nada', () => {
    apretar(RUEDA, true);
    apretar(RUEDA, false);
    expect(h.voz.muteado).toBe(false);
    h.voz.salaId = null;
    apretar(RUEDA, true);
    expect(h.voz.muteado).toBe(false);
  });
  it('la misma tecla no puede hacer dos cosas: asignarla a otra acción se la saca a la anterior', () => {
    guardarAtajo('ensordecer', { codigo: RUEDA, nombre: 'Rueda' });
    apretar(RUEDA, true);
    expect(h.voz.ensordecido).toBe(true);
    expect(h.voz.muteado).toBe(true);
  });
});
