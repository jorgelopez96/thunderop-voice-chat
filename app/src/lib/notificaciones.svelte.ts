import { isTauri } from '@tauri-apps/api/core';
import { pb } from './pb';
import { leerPrefs } from './prefs';
import { esGif } from './links';

// Aviso de mensaje nuevo (privados y salas): sonido y, si la ventana no está a la vista, notificación de Windows.
// Cada chat se puede silenciar hasta una fecha o para siempre; se guarda en este dispositivo:
// `localStorage['dm.silencio.<usuario>']` = { chat: hasta (ms) }.
const SIEMPRE = Number.MAX_SAFE_INTEGER;
export const DURACIONES = [['1 día', 1], ['1 semana', 7], ['1 mes', 30], ['Hasta que lo vuelva a activar', null]] as const;

const clave = () => `dm.silencio.${pb.authStore.record?.id}`;
function leer(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(clave()) ?? '{}'); } catch { return {}; }
}
export const silencio = $state<{ hasta: Record<string, number> }>({ hasta: leer() });

/** Hasta cuándo está silenciado (ms), o 0 si no lo está. */
export function silenciadoHasta(chat: string): number {
  const h = silencio.hasta[chat] ?? 0;
  return h > Date.now() ? h : 0;
}
export const esParaSiempre = (h: number) => h === SIEMPRE;

/** `dias` null = hasta que lo cambie; 0 = quitar el silencio. */
export function silenciar(chat: string, dias: number | null) {
  const hasta = { ...leer() };
  if (dias === 0) delete hasta[chat];
  else hasta[chat] = dias === null ? SIEMPRE : Date.now() + dias * 86_400_000;
  silencio.hasta = hasta;
  try { localStorage.setItem(clave(), JSON.stringify(hasta)); } catch { /* sin almacenamiento: dura esta sesión */ }
}

// Historial de la campanita (menciones y privados), en este dispositivo:
// `localStorage['dm.avisos.<usuario>']`, los 50 más nuevos.
type Aviso = { id: string; titulo: string; texto: string; fecha: string; leido: boolean };
const claveAvisos = () => `dm.avisos.${pb.authStore.record?.id}`;
function leerAvisos(): Aviso[] {
  try { return JSON.parse(localStorage.getItem(claveAvisos()) ?? '[]'); } catch { return []; }
}
export const avisos = $state<{ lista: Aviso[] }>({ lista: leerAvisos() });
function guardarAvisos(lista: Aviso[]) {
  avisos.lista = lista;
  try { localStorage.setItem(claveAvisos(), JSON.stringify(lista)); } catch { /* sin almacenamiento: dura esta sesión */ }
}
const anotar = (titulo: string, texto: string) =>
  guardarAvisos([{ id: crypto.randomUUID(), titulo, texto, fecha: new Date().toISOString(), leido: false }, ...avisos.lista].slice(0, 50));
export const marcarAvisosLeidos = () => { if (avisos.lista.some((a) => !a.leido)) guardarAvisos(avisos.lista.map((a) => ({ ...a, leido: true }))); };
export const borrarAvisos = () => guardarAvisos([]);

// Chats a la vista: no avisan mientras la ventana tenga el foco.
const viendo = new Set<string>();
/** La vista que muestra el chat lo llama al abrirlo; devuelve la función para dejar de verlo. */
export function ver(chat: string) {
  viendo.add(chat);
  return () => viendo.delete(chat);
}

let ctx: AudioContext | undefined;
function ding() {
  ctx ??= new AudioContext();
  const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
  o.type = 'sine';
  o.frequency.setValueAtTime(880, t);
  o.frequency.setValueAtTime(1175, t + 0.09);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.1, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + 0.32);
}

/** `aunSilenciado`: te mencionaron con @, avisa aunque el chat esté silenciado (si los avisos de menciones están prendidos).
 * `guardar`: además queda en la campanita. */
export async function avisar(chat: string, titulo: string, texto: string, aunSilenciado = false, guardar = false) {
  const aLaVista = document.visibilityState === 'visible' && document.hasFocus();
  const p = leerPrefs();
  const porMencion = aunSilenciado && p.avisoMenciones;
  const porMensaje = p.avisoMensajes && !silenciadoHasta(chat);
  if ((!porMencion && !porMensaje) || (aLaVista && viendo.has(chat))) return;
  if (guardar) anotar(titulo, texto);
  if (p.sonidoMensajes) ding();
  if (aLaVista || !p.notificaciones || !isTauri()) return;
  try {
    const n = await import('@tauri-apps/plugin-notification');
    if (!(await n.isPermissionGranted()) && (await n.requestPermission()) !== 'granted') return;
    n.sendNotification({ title: titulo, body: texto });
  } catch { /* sin notificación: quedó el sonido y el contador */ }
}

/** Texto corto para la notificación. */
export const resumen = (m: { [k: string]: unknown }) =>
  (m.text ? (esGif(String(m.text)) ? 'Mandó un GIF' : String(m.text).slice(0, 120)) : m.file ? 'Mandó un archivo' : '');
