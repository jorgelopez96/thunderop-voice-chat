import { Channel, invoke } from '@tauri-apps/api/core';

// Transmisor nativo (src-tauri/src/transmisor.rs): captura y comprime con la placa por fuera de WebView2.
// Entra a la sala como `<usuario>.pantalla` (LiveKit no deja dos conexiones con la misma identidad).
export const SUFIJO_PANTALLA = '.pantalla';
export const esPantallaNativa = (identidad: string) => identidad.endsWith(SUFIJO_PANTALLA);
/** El usuario detrás de una identidad (la del transmisor nativo es la suya + el sufijo). */
export const duenio = (identidad: string) => (esPantallaNativa(identidad) ? identidad.slice(0, -SUFIJO_PANTALLA.length) : identidad);

// Si la placa no tiene compresor por hardware (código 3) no se vuelve a probar: se usa la transmisión de WebView2.
const CLAVE = 'dm.sinNativo';
export function hayNativo() {
  if (!('__TAURI_INTERNALS__' in globalThis)) return false;
  try { return localStorage.getItem(CLAVE) !== '1'; } catch { return true; }
}
export function sinNativo() { try { localStorage.setItem(CLAVE, '1'); } catch { /* sin almacenamiento */ } }

export type Ventana = { pid: number; titulo: string };
/** Ventanas abiertas que se pueden transmitir, con el proceso de cada una (para capturar solo su sonido). */
export async function ventanas(): Promise<Ventana[]> {
  try { return await invoke<Ventana[]>('ventanas_transmisor'); } catch { return []; }
}

type Estado = { tipo: 'transmitiendo' } | { tipo: 'fin'; codigo: number };
export type Opciones = { url: string; token: string; que: string; fps: number; mbps: number; alto: number };

/** Resuelve 'ok' cuando ya publica, o el código de salida si terminó antes (ver nativo/transmisor/src/main.rs;
 *  -1 si ni arrancó). Si termina después de arrancar, avisa a `alTerminar`. */
export function iniciarNativo(op: Opciones, alTerminar: (codigo: number) => void): Promise<'ok' | number> {
  return new Promise((resolver) => {
    let listo = false;
    const fin = (r: 'ok' | number) => { if (!listo) { listo = true; clearTimeout(espera); resolver(r); } };
    // Sin noticias en 20 s (LiveKit no contesta): se corta y cuenta como "no conecta".
    const espera = setTimeout(() => { void detenerNativo(); fin(5); }, 20_000);
    const canal = new Channel<Estado>();
    canal.onmessage = (m) => {
      if (m.tipo === 'transmitiendo') fin('ok');
      else if (!listo) fin(m.codigo);
      else alTerminar(m.codigo);
    };
    invoke('iniciar_transmisor', { ...op, canal }).catch(() => fin(-1));
  });
}

/** Cambia fps, tope y alto del transmisor que está corriendo, sin cortarlo. */
export async function calidadNativo(fps: number, mbps: number, alto: number) {
  try { await invoke('calidad_transmisor', { fps, mbps, alto }); return true; } catch { return false; }
}

export async function detenerNativo() {
  if (!('__TAURI_INTERNALS__' in globalThis)) return;
  try { await invoke('detener_transmisor'); } catch (e) { console.warn('detener_transmisor falló', e); }
}
