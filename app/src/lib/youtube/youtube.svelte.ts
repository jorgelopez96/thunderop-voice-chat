import { pb } from '../pb';
import { mensajeError } from '../sesion.svelte';
import { volumenYoutube, guardarVolumenYoutube } from '../prefs';
import { alCambiarSala, voz } from '../voz.svelte';
import { posicion, muestra, mejor, type Muestra } from '../musica/posicion';
import { FIN, SONANDO, PAUSADO, type Reproductor } from '../musica/reproductor';
import { crearReproductorVideo } from './reproductor';
import { idDeVideo, desviado } from './sincro';

// YouTube juntos: el video de la sala de voz vive en PocketBase (`videos`, solo lo escribe la ruta del servidor)
// y cada cliente lo reproduce en la tarjeta del escenario, en la posición compartida. Mismo esquema que la música.

export type VideoSala = { videoId: string; titulo: string; puestoPor: string; inicioMs: number; pausaS: number | null };

export const youtube = $state<{ actual: VideoSala | null; pausado: boolean; error: string; terminado: boolean }>(
  { actual: null, pausado: false, error: '', terminado: false });

const ERRORES_EMBED = [2, 5, 100, 101, 150];

let sala: string | null = null;
let reloj: Muestra | null = null; // desfase con el servidor (ms que va adelantado)
let medido = false;
let remedir: ReturnType<typeof setInterval> | undefined;
let carga = 0; // invalida lecturas viejas
let sub: Promise<() => Promise<void>> | null = null;
let host: HTMLElement | null = null;
let rp: Reproductor | null = null;
let cargado = ''; // `videoId|inicioMs` de lo que tiene el reproductor: poner el mismo video de nuevo también recarga
let estado = -1;
let vigia: ReturnType<typeof setInterval> | undefined;

const ahoraServidor = () => Date.now() + (reloj?.desfase ?? 0);
const anotar = (r: { ahora?: unknown }, enviado: number) => {
  if (typeof r?.ahora === 'number') { const ahora = Date.now(); reloj = mejor(reloj, muestra(r.ahora, enviado, ahora), ahora); }
};

function conectar(roomId: string) {
  desconectar();
  sala = roomId;
  // ponytail: sin relectura al reconectar el realtime (igual que la música); la próxima acción lo pone al día
  sub = pb.collection('videos').subscribe('*', () => void cargar(), { filter: pb.filter('room = {:r}', { r: roomId }) });
  void medir().finally(() => { if (sala !== roomId) return; medido = true; void cargar(); });
  remedir = setInterval(() => void medir(), 60_000);
}

/** 3 muestras seguidas del GET; queda la de menor ida y vuelta. */
async function medir() {
  const s = sala;
  for (let i = 0; i < 3 && s && s === sala; i++) {
    const enviado = Date.now();
    try { anotar(await pb.send(`/api/rooms/${s}/youtube`, { method: 'GET', requestKey: null }), enviado); }
    catch { return; }
  }
}

function desconectar() {
  sala = null; carga++; reloj = null; medido = false;
  clearInterval(remedir);
  sub?.then((f) => f()).catch(() => {});
  sub = null;
  Object.assign(youtube, { actual: null, pausado: false, error: '', terminado: false });
  destruir();
}

/** Dónde va el video (lo ubica la tarjeta del escenario; `null` lo saca). */
export function ubicarVideo(el: HTMLElement | null) {
  if (el === host) return;
  destruir();
  host = el;
  sincronizar();
}

/** Pone el video del link para toda la sala. false si no sirve o falló (queda en `youtube.error`). */
export function poner(url: string) {
  if (!idDeVideo(url.trim())) { youtube.error = 'Ese link no es de un video de YouTube.'; return Promise.resolve(false); }
  return enviar('poner', { url: url.trim() });
}
export const pausar = () => enviar('pausar');
export const reanudar = () => enviar('reanudar');
export const sacar = () => enviar('sacar');
export const ir = (posS: number) => enviar('ir', { posS: Math.max(0, posS) });
/** Ver de nuevo desde el principio, para todos. */
export async function deNuevo() { if (await ir(0) && youtube.pausado) await reanudar(); }

const oido = (v: number) => (voz.ensordecido ? 0 : v);
$effect.root(() => { $effect(() => { const v = oido(volumenYoutube()); rp?.volumen(v); }); });

export function volumenVideo(v: number) {
  if (!Number.isFinite(v)) return;
  v = Math.min(100, Math.max(0, v));
  guardarVolumenYoutube(v);
  rp?.volumen(oido(v));
}

async function enviar(accion: string, extra: Record<string, unknown> = {}): Promise<boolean> {
  const s = sala;
  if (!s) return false;
  youtube.error = '';
  const enviado = Date.now();
  try {
    const r = await pb.send(`/api/rooms/${s}/youtube`, { method: 'POST', body: { accion, ...extra }, requestKey: null });
    if (s !== sala) return false;
    if (accion !== 'poner') anotar(r, enviado); // `poner` toma `ahora` después del oEmbed: muestra sesgada
    await cargar();
    return true;
  } catch (e) {
    if (s === sala) youtube.error = mensajeError(e);
    return false;
  }
}

async function cargar() {
  const s = sala, mio = ++carga;
  if (!s) return;
  try {
    const v = await pb.collection('videos').getFirstListItem<VideoSala>(pb.filter('room = {:r}', { r: s }), { requestKey: null })
      .catch((e) => { if (e?.status === 404) return null; throw e; });
    if (mio !== carga) return;
    youtube.actual = v?.videoId ? { videoId: v.videoId, titulo: v.titulo, puestoPor: v.puestoPor, inicioMs: v.inicioMs,
      pausaS: typeof v.pausaS === 'number' ? v.pausaS : null } : null;
    sincronizar();
  } catch { /* se conserva lo anterior; el próximo evento lo reintenta */ }
}

/** Lleva el reproductor al estado compartido: existe solo con video, tarjeta donde ponerlo y reloj medido. */
function sincronizar() {
  const v = youtube.actual;
  youtube.pausado = v?.pausaS != null;
  if (!v || !host || !sala || !medido) return destruir();
  if (!rp) {
    const nuevo = rp = crearReproductorVideo(host);
    nuevo.onEstado((e) => { if (rp === nuevo) alEstado(e); });
    nuevo.onError((codigo) => { if (rp === nuevo) alError(codigo); });
    nuevo.volumen(oido(volumenYoutube()));
    vigia = setInterval(corregir, 3000);
  }
  const clave = `${v.videoId}|${v.inicioMs}`;
  if (!cargado.startsWith(`${v.videoId}|`) || (clave !== cargado && youtube.terminado)) {
    estado = -1; youtube.terminado = false;
    rp.cargar(v.videoId, posicion(v, ahoraServidor()));
  } else corregir();
  cargado = clave;
  if (youtube.pausado) rp.pause(); else rp.play();
}

/** Si se fue de la posición compartida, salta a ella. Solo sonando o pausado de verdad (no en anuncios, cargando ni recién cargado en pausa). */
function corregir() {
  const v = youtube.actual;
  if (!rp || !v) return;
  if (estado !== (v.pausaS == null ? SONANDO : PAUSADO)) return;
  const compartida = posicion(v, ahoraServidor());
  if (desviado(rp.tiempo(), compartida, v.pausaS != null)) rp.seek(compartida);
}

function alEstado(e: number) {
  estado = e;
  youtube.terminado = e === FIN;
  if (e === SONANDO) { if (youtube.pausado) rp?.pause(); else corregir(); } // también al volver de un anuncio
  else if (e === PAUSADO && youtube.pausado) corregir(); // que todos queden en el mismo cuadro
}

function alError(codigo: number) {
  youtube.error = ERRORES_EMBED.includes(codigo) ? 'Este video no se puede ver acá (el dueño no deja insertarlo).' : 'No se pudo cargar el reproductor de YouTube.';
}

function destruir() {
  clearInterval(vigia);
  rp?.destruir();
  rp = null; cargado = ''; estado = -1;
}

/** Dónde va el video, para la barra de la tarjeta. */
export const progreso = () => ({ t: rp?.tiempo() ?? 0, dur: rp?.duracion() ?? 0 });

alCambiarSala((id) => (id ? conectar(id) : desconectar()));
