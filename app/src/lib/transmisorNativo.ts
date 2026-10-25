import { Channel, invoke } from '@tauri-apps/api/core';
import { pb } from './pb';
import { recortarRegistro } from './transmision';

// Transmisor nativo (src-tauri/src/transmisor.rs): captura y comprime con la placa por fuera de WebView2.
// Entra a la sala como `<usuario>.pantalla` (LiveKit no deja dos conexiones con la misma identidad).
export const SUFIJO_PANTALLA = '.pantalla';
export const esPantallaNativa = (identidad: string) => identidad.endsWith(SUFIJO_PANTALLA);
/** El usuario detrás de una identidad (la del transmisor nativo es la suya + el sufijo). */
export const duenio = (identidad: string) => (esPantallaNativa(identidad) ? identidad.slice(0, -SUFIJO_PANTALLA.length) : identidad);

export type Estado = { tipo: 'transmitiendo' } | { tipo: 'fin'; codigo: number; registro: string };
export type Fuente = { tipo: 'monitor' | 'ventana'; id: string; titulo: string; pid: number; png_base64: string | null; icono_base64?: string | null };
export type Opciones = { url: string; token: string; que: string; fps: number; mbps: number; alto: number };

const enTauri = () => '__TAURI_INTERNALS__' in globalThis;
/** Transmite con el nativo: en el escritorio, o en los E2E de desarrollo que piden el simulado (`dm.simularNativo`).
 *  En el navegador se usa el compartir pantalla del navegador. */
export const conNativo = () => enTauri() || (import.meta.env.DEV && localStorage.getItem('dm.simularNativo') === '1');

/** Sube el registro de una transmisión al servidor para diagnosticar. Sin esperar y sin fallar: todo error se ignora (también el 429). */
export async function subirDiagnostico(codigo: number, registro: string): Promise<void> {
  const user = pb.authStore.record?.id;
  if (!enTauri() || !user) return;
  try {
    const { getVersion } = await import('@tauri-apps/api/app');
    await pb.collection('diagnosticos').create({ user, version: await getVersion(), codigo, contenido: recortarRegistro(registro) }, { requestKey: null });
  } catch (e) { console.warn('no se pudo subir el diagnóstico', e); }
}
// Fuera de Tauri y solo en desarrollo, el transmisor simulado (los E2E); en producción no existe.
let simulado: { detener(): void; calidad(fps: number, alto: number): void } | undefined;
/** Solo DEV (E2E): corta el simulado como lo haría el transmisor al cerrarse la ventana compartida. */
export const cortarSimulado = () => simulado?.detener();

/** Resuelve 'ok' cuando ya publica, o el código de salida si terminó antes (ver nativo/transmisor/src/main.rs;
 *  -1 si ni arrancó). Si termina después de arrancar, avisa a `alTerminar`. */
export function iniciarNativo(op: Opciones, alTerminar: (codigo: number) => void): Promise<'ok' | number> {
  return new Promise((resolver) => {
    let listo = false;
    const fin = (r: 'ok' | number) => { if (!listo) { listo = true; clearTimeout(espera); resolver(r); } };
    // Sin noticias en 20 s (LiveKit no contesta): se corta y cuenta como "no conecta".
    const espera = setTimeout(() => { void detenerNativo(); fin(5); }, 20_000);
    const alMensaje = (m: Estado) => {
      if (m.tipo === 'fin') void subirDiagnostico(m.codigo, m.registro);
      if (m.tipo === 'transmitiendo') fin('ok');
      else if (!listo) fin(m.codigo);
      else alTerminar(m.codigo);
    };
    if (enTauri()) {
      const canal = new Channel<Estado>();
      canal.onmessage = alMensaje;
      invoke('iniciar_transmisor', { ...op, canal }).catch((e) => { void subirDiagnostico(-1, String(e)); fin(-1); });
    } else if (import.meta.env.DEV) {
      import('./transmisorSimulado').then((m) => { simulado = m.simularNativo(op, (e) => { if (e.tipo === 'fin') simulado = undefined; alMensaje(e); }); }).catch(() => fin(-1));
    } else fin(-1);
  });
}

/** Cambia fps, tope y alto del transmisor que está corriendo, sin cortarlo. */
export async function calidadNativo(fps: number, mbps: number, alto: number) {
  if (!enTauri()) { simulado?.calidad(fps, alto); return !!simulado; }
  try { await invoke('calidad_transmisor', { fps, mbps, alto }); return true; } catch { return false; }
}

export async function detenerNativo() {
  if (!enTauri()) { simulado?.detener(); simulado = undefined; return; }
  try { await invoke('detener_transmisor'); } catch (e) { console.warn('detener_transmisor falló', e); }
}

/** Monitores y ventanas para transmitir, con miniatura de `ancho` px (`[]` si falla). */
export async function fuentes(ancho = 320): Promise<Fuente[]> {
  try {
    if (enTauri()) return await invoke<Fuente[]>('fuentes_transmisor', { ancho });
    if (import.meta.env.DEV) return (await import('./transmisorSimulado')).fuentesSimuladas();
  } catch (e) { console.warn('fuentes_transmisor falló', e); }
  return [];
}
