import { pb } from '../pb';
import { mensajeError } from '../sesion.svelte';
import { leerPrefs, guardarPrefs } from '../prefs';
import { alCambiarSala } from '../voz.svelte';
import { posicion, muestra, mejor, type Muestra } from './posicion';
import { crearReproductor, FIN, SONANDO, PAUSADO, type Reproductor } from './reproductor';

// Música sincronizada de la sala de voz: el estado vive en PocketBase (solo lo escribe la ruta del servidor)
// y cada cliente lo reproduce con su propio reproductor, en la posición compartida.

export type Cancion = { id: string; videoId: string; titulo: string; agregadoPor: string; estado: 'cola' | 'sonando' | 'hecha' | 'error' };
type Rep = { actual: string; inicioMs: number; pausaS: number | null };

/** `cola`: la que suena, las que esperan y las que dieron error hace poco (marcadas), en orden. */
export const musica = $state<{ cola: Cancion[]; actual: Cancion | null; pausado: boolean; error: string }>({ cola: [], actual: null, pausado: false, error: '' });

const ERRORES_EMBED = [2, 5, 100, 101, 150];
const TOLERANCIA_S = 2;
const ERROR_VISIBLE_MS = 10 * 60_000;

let sala: string | null = null;
let rep: Rep | null = null;
let reloj: Muestra | null = null; // mejor medición del desfase con el servidor (ms que va adelantado)
let medido = false; // el reproductor no arranca hasta tener la primera medición (o que falle)
let remedir: ReturnType<typeof setInterval> | undefined;
let carga = 0; // invalida las lecturas viejas (realtime y respuestas pueden llegar desordenadas)
let subs: Promise<() => Promise<void>>[] = [];
let host: HTMLElement | null = null;
let rp: Reproductor | null = null;
let cargada: Cancion | null = null; // la que tiene el reproductor
let estado = -1;
let vigia: ReturnType<typeof setInterval> | undefined;

const ahoraServidor = () => Date.now() + (reloj?.desfase ?? 0);
const anotar = (r: { ahora?: unknown }, enviado: number) => {
  if (typeof r?.ahora === 'number') { const ahora = Date.now(); reloj = mejor(reloj, muestra(r.ahora, enviado, ahora), ahora); }
};

/** Escucha la cola y la reproducción de la sala de voz `roomId`. */
export function conectar(roomId: string) {
  desconectar();
  sala = roomId;
  const filtro = pb.filter('room = {:r}', { r: roomId });
  // ponytail: sin relectura al reconectar el realtime; cualquier acción o evento siguiente lo pone al día
  subs = ['canciones', 'reproducciones'].map((c) => pb.collection(c).subscribe('*', () => void cargar(), { filter: filtro }));
  void medir().finally(() => { if (sala !== roomId) return; medido = true; void cargar(); });
  remedir = setInterval(() => void medir(), 60_000);
}

/** Mide el desfase con el GET de la ruta: 3 muestras seguidas; queda la de menor ida y vuelta. */
async function medir() {
  const s = sala;
  for (let i = 0; i < 3 && s && s === sala; i++) {
    const enviado = Date.now();
    try { anotar(await pb.send(`/api/rooms/${s}/musica`, { method: 'GET', requestKey: null }), enviado); }
    catch { return; } // sin medición se sigue con la anterior (o 0)
  }
}

export function desconectar() {
  sala = null; rep = null; carga++; reloj = null; medido = false;
  clearInterval(remedir);
  for (const s of subs) s.then((f) => f()).catch(() => {});
  subs = [];
  Object.assign(musica, { cola: [], actual: null, pausado: false, error: '' });
  destruir();
}

/** Dónde va el reproductor (lo ubica la vista; `null` lo saca). Cambiar de lugar lo recrea. */
export function ubicarReproductor(el: HTMLElement | null) {
  if (el === host) return;
  destruir();
  host = el;
  sincronizar();
}

export const agregar = (url: string) => enviar('agregar', { url });
export const pausar = () => enviar('pausar');
export const reanudar = () => enviar('reanudar');
export const saltar = () => (musica.actual ? enviar('saltar', { cancionId: musica.actual.id }) : Promise.resolve(false));
export const quitar = (id: string) => enviar('quitar', { cancionId: id });

/** Volumen de la música (0 a 100), aparte del de las voces. Se guarda en prefs. */
export function volumenMusica(v: number) {
  if (!Number.isFinite(v)) return;
  v = Math.min(100, Math.max(0, v));
  guardarPrefs({ volMusica: v });
  rp?.volumen(v);
}

/** POST a la ruta de música. Mide el desfase con su `ahora` y relee el estado. false si falló (queda en `musica.error`). */
async function enviar(accion: string, extra: Record<string, string> = {}): Promise<boolean> {
  const s = sala;
  if (!s) return false;
  musica.error = '';
  const enviado = Date.now();
  try {
    const r = await pb.send(`/api/rooms/${s}/musica`, { method: 'POST', body: { accion, ...extra }, requestKey: null });
    if (s !== sala) return false;
    if (accion !== 'agregar') anotar(r, enviado); // `agregar` toma `ahora` después del oEmbed: muestra sesgada
    await cargar();
    return true;
  } catch (e) {
    if (s === sala) musica.error = mensajeError(e);
    return false;
  }
}

async function cargar() {
  const s = sala, mio = ++carga;
  if (!s) return;
  // Los temas con error quedan a la vista 10 minutos, en su lugar de la cola.
  const filtro = pb.filter("room = {:r} && (estado = 'cola' || estado = 'sonando' || (estado = 'error' && updated >= {:desde}))",
    { r: s, desde: new Date(ahoraServidor() - ERROR_VISIBLE_MS) });
  try {
    const [cola, r] = await Promise.all([
      pb.collection('canciones').getFullList<Cancion>({ filter: filtro, sort: 'created', requestKey: null }),
      pb.collection('reproducciones').getFirstListItem<Rep>(pb.filter('room = {:r}', { r: s }), { requestKey: null })
        .catch((e) => { if (e?.status === 404) return null; throw e; }), // sin música todavía
    ]);
    if (mio !== carga) return;
    musica.cola = cola;
    rep = r && { actual: r.actual, inicioMs: r.inicioMs, pausaS: typeof r.pausaS === 'number' ? r.pausaS : null };
    sincronizar();
  } catch { /* se conserva lo anterior; el próximo evento lo reintenta */ }
}

/** Lleva el reproductor al estado compartido: existe solo con canción actual, voz conectada y lugar donde ponerlo. */
function sincronizar() {
  const c = rep?.actual ? musica.cola.find((x) => x.id === rep!.actual) ?? null : null;
  musica.actual = c;
  musica.pausado = rep?.pausaS != null;
  if (!c || !rep || !host || !sala || !medido) return destruir();
  if (!rp) {
    const nuevo = rp = crearReproductor(host);
    nuevo.onEstado((e) => { if (rp === nuevo) alEstado(e); });
    nuevo.onError((codigo) => { if (rp === nuevo) alError(codigo); });
    nuevo.volumen(leerPrefs().volMusica);
    vigia = setInterval(corregir, 5000);
  }
  if (cargada?.id !== c.id) { cargada = c; estado = -1; rp.cargar(c.videoId, posicion(rep, ahoraServidor())); }
  else corregir();
  if (musica.pausado) rp.pause(); else rp.play();
}

/** Si el reproductor se desvió más de 2 s de la posición compartida, salta a ella.
 *  Solo con el video andando o pausado de verdad: no en anuncios ni cargando, ni recién cargado en pausa
 *  (ahí la posición ya la dio `cargar`, y en YouTube un `seekTo` sobre un video sin arrancar lo hace sonar). */
function corregir() {
  if (!rp || !rep || !cargada) return;
  if (estado !== (rep.pausaS == null ? SONANDO : PAUSADO)) return;
  const compartida = posicion(rep, ahoraServidor());
  if (Math.abs(rp.tiempo() - compartida) > TOLERANCIA_S) rp.seek(compartida);
}

function alEstado(e: number) {
  estado = e;
  if (e === SONANDO) { if (musica.pausado) rp?.pause(); else corregir(); } // también al volver de un anuncio
  // Todos los de la sala mandan `termino`; el servidor avanza una sola vez (el id viejo no hace nada).
  else if (e === FIN && cargada) void enviar('termino', { cancionId: cargada.id });
}

function alError(codigo: number) {
  if (ERRORES_EMBED.includes(codigo) && cargada) {
    const c = cargada;
    void enviar('error', { cancionId: c.id }).then((ok) => { if (ok) musica.error = `No se puede reproducir acá: ${c.titulo}`; });
  } else musica.error = 'No se pudo cargar el reproductor de YouTube.';
}

function destruir() {
  clearInterval(vigia);
  rp?.destruir();
  rp = null; cargada = null; estado = -1;
}

alCambiarSala((id) => (id ? conectar(id) : desconectar()));

// Solo para los E2E (en el build de producción no existe).
if (import.meta.env.DEV) {
  (globalThis as unknown as { __musica: unknown }).__musica = {
    get reproductor() { return !!rp; },
    tiempo: () => rp?.tiempo() ?? 0,
    get videoId() { return rp ? cargada?.videoId ?? null : null; },
  };
}
