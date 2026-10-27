import type { RecordModel } from 'pocketbase';
import { pb } from './pb';
import { leerPrefs } from './prefs';
import { contextoVoz, publicarDatos, alRecibirDatos, voz } from './voz.svelte';
import { validarSonido, mensajeSubida } from './botoneraLogica';

const TOPIC = 'botonera';
const buffers = new Map<string, { group: string; b: AudioBuffer }>(); // ponytail: sin tope de tamaño; 50 sonidos × ≤10 s por grupo es acotado
const codificar = (o: unknown) => new TextEncoder().encode(JSON.stringify(o));

/** Quién tocó qué, para el cartelito de la llamada: los últimos 5, cada uno dura 2,5 s. */
export const tocados = $state<{ lista: { n: number; quien: string; sonido: string }[] }>({ lista: [] });
let contador = 0;
function anotar(quien: string, sonido: string) {
  const n = ++contador;
  tocados.lista = [...tocados.lista.slice(-4), { n, quien, sonido }];
  setTimeout(() => { tocados.lista = tocados.lista.filter((x) => x.n !== n); }, 2500);
}

/** Sonidos de un grupo, reactivos (realtime). Llamar `parar()` al terminar. */
export function sonidos(grupoId: string) {
  const estado = $state<{ lista: RecordModel[] }>({ lista: [] });
  const cargar = async () => {
    try { estado.lista = await pb.collection('sonidos').getFullList({ filter: pb.filter('group = {:g}', { g: grupoId }), sort: '@rowid' }); }
    catch { /* se conserva la lista anterior */ }
  };
  cargar();
  const sub = pb.collection('sonidos').subscribe('*', cargar);
  return { estado, parar: () => { sub.then((f) => f()).catch(() => {}); } };
}

/** Valida (tipo, tamaño y duración decodificada) y sube. Tira Error con el mensaje para mostrar. */
export async function subir(grupoId: string, nombre: string, archivo: File, volumen: number) {
  const previo = validarSonido({ duracion: 0, tamaño: archivo.size, tipo: archivo.type });
  if (previo) throw new Error(previo);
  let duracion: number;
  try {
    // Contexto descartable: la voz puede no estar activa. decodeAudioData no depende de la tasa.
    const c = new AudioContext();
    try { duracion = (await c.decodeAudioData(await archivo.arrayBuffer())).duration; } finally { c.close().catch(() => {}); }
  } catch { throw new Error('No se pudo leer el audio.'); }
  const msg = validarSonido({ duracion, tamaño: archivo.size, tipo: archivo.type });
  if (msg) throw new Error(msg);
  const dueño = pb.authStore.record?.id;
  try { await pb.collection('sonidos').create({ group: grupoId, name: nombre.trim(), file: archivo, owner: dueño, volumen }); }
  catch (e) { throw new Error(mensajeSubida((e as { response?: Parameters<typeof mensajeSubida>[0] })?.response)); }
}

export const editar = (id: string, cambios: { name?: string; volumen?: number }) => pb.collection('sonidos').update(id, cambios);

/** Volumen base del sonido (0,05 a 2). */
export const volumenDe = (rec: RecordModel) => (rec.volumen || 100) / 100;

export async function borrar(id: string) {
  await pb.collection('sonidos').delete(id);
  buffers.delete(id);
}

/** Decodifica un sonido del grupo de voz actual; uno de otro grupo (id mandado por un par de otra sala) no se decodifica ni se cachea. */
async function buffer(id: string, c: AudioContext) {
  let e = buffers.get(id);
  if (!e) {
    const rec = await pb.collection('sonidos').getOne(id);
    if (rec.group !== voz.grupoId) throw new Error('otro grupo');
    e = { group: rec.group, b: await c.decodeAudioData(await (await fetch(pb.files.getURL(rec, rec.file))).arrayBuffer()) };
    buffers.set(id, e);
  }
  if (e.group !== voz.grupoId) throw new Error('otro grupo');
  return e.b;
}

/** Reproduce localmente por el contexto de la voz, sin tope: se pueden pisar y mezclar todos los que quieran.
 *  Sin voz no hay contexto: no suena. */
async function reproducir(id: string, base: number) {
  const c = contextoVoz();
  if (!c || voz.ensordecido) return; // ensordecido no escucha nada, tampoco la botonera
  try {
    const b = await buffer(id, c);
    if (c.state === 'closed') return;
    const fuente = c.createBufferSource(), vol = c.createGain();
    fuente.buffer = b; vol.gain.value = leerPrefs().volBotonera * base;
    fuente.connect(vol).connect(c.destination);
    fuente.onended = () => { fuente.disconnect(); vol.disconnect(); };
    fuente.start();
  } catch { return; }
  if (import.meta.env.DEV) (globalThis as unknown as { __botonera?: { reproducidos: number } }).__botonera!.reproducidos++;
}

/** Suena para todos en la sala de voz (y para uno mismo). Fuera de la voz no hace nada.
 *  El volumen base viaja con el aviso: así un cambio reciente suena igual para todos, aunque tengan el audio en caché. */
export async function tocar(rec: RecordModel) {
  if (!voz.salaId) return;
  const vol = volumenDe(rec);
  void reproducir(rec.id, vol);
  anotar('Vos', rec.name);
  await publicarDatos(codificar({ id: rec.id, vol, nombre: rec.name }), TOPIC);
}

alRecibirDatos((payload, topic, de) => {
  if (topic !== TOPIC) return;
  try {
    const { id, vol, nombre } = JSON.parse(new TextDecoder().decode(payload));
    // Las versiones viejas no mandan el nombre del sonido.
    if (typeof id === 'string') anotar(de ?? 'Alguien', typeof nombre === 'string' ? nombre.slice(0, 60) : 'un sonido');
    // Mismo rango que la colección: un par no puede mandar un sonido a todo volumen.
    if (typeof id === 'string') void reproducir(id, typeof vol === 'number' ? Math.min(2, Math.max(0.05, vol)) : 1);
  } catch { /* dato ajeno o roto */ }
});

if (import.meta.env.DEV) (globalThis as unknown as { __botonera: unknown }).__botonera = { reproducidos: 0 };
