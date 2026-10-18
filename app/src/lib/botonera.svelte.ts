import type { RecordModel } from 'pocketbase';
import { pb } from './pb';
import { leerPrefs } from './prefs';
import { contextoVoz, publicarDatos, alRecibirDatos, voz } from './voz.svelte';
import { validarSonido, Limite } from './botoneraLogica';

const TOPIC = 'botonera';
const buffers = new Map<string, AudioBuffer>(); // ponytail: sin tope de tamaño; 50 sonidos × ≤10 s por grupo es acotado
const cupo = new Limite(3);
const codificar = (o: unknown) => new TextEncoder().encode(JSON.stringify(o));

/** Sonidos de un grupo, reactivos (realtime). Llamar `parar()` al terminar. */
export function sonidos(grupoId: string) {
  const estado = $state<{ lista: RecordModel[] }>({ lista: [] });
  const cargar = async () => {
    try { estado.lista = await pb.collection('sonidos').getFullList({ filter: pb.filter('group = {:g}', { g: grupoId }), sort: 'name' }); }
    catch { /* se conserva la lista anterior */ }
  };
  cargar();
  const sub = pb.collection('sonidos').subscribe('*', cargar);
  return { estado, parar: () => { sub.then((f) => f()).catch(() => {}); } };
}

/** Valida (tipo, tamaño y duración decodificada) y sube. Tira Error con el mensaje para mostrar. */
export async function subir(grupoId: string, nombre: string, archivo: File) {
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
  try { await pb.collection('sonidos').create({ group: grupoId, name: nombre.trim(), file: archivo, owner: dueño }); }
  catch (e) { throw new Error((e as { response?: { message?: string } })?.response?.message || 'No se pudo subir el sonido.'); }
}

export async function borrar(id: string) {
  await pb.collection('sonidos').delete(id);
  buffers.delete(id);
}

async function buffer(id: string, c: AudioContext) {
  let b = buffers.get(id);
  if (!b) {
    const rec = await pb.collection('sonidos').getOne(id);
    b = await c.decodeAudioData(await (await fetch(pb.files.getURL(rec, rec.file))).arrayBuffer());
    buffers.set(id, b);
  }
  return b;
}

/** Reproduce localmente por el contexto de la voz; si ya hay 3 sonando, se descarta. Sin voz no hay contexto: no suena. */
async function reproducir(id: string) {
  const c = contextoVoz();
  if (!c || !cupo.intentar()) return;
  try {
    const b = await buffer(id, c);
    if (c.state === 'closed') { cupo.liberar(); return; }
    const fuente = c.createBufferSource(), vol = c.createGain();
    fuente.buffer = b; vol.gain.value = leerPrefs().volBotonera;
    fuente.connect(vol).connect(c.destination);
    fuente.onended = () => { fuente.disconnect(); vol.disconnect(); cupo.liberar(); };
    fuente.start();
    if (import.meta.env.DEV) (globalThis as unknown as { __botonera: { reproducidos: number } }).__botonera.reproducidos++;
  } catch { cupo.liberar(); }
}

/** Suena para todos en la sala de voz (y para uno mismo). Fuera de la voz no hace nada. */
export async function tocar(id: string) {
  if (!voz.salaId) return;
  void reproducir(id);
  await publicarDatos(codificar({ id }), TOPIC);
}

alRecibirDatos((payload, topic) => {
  if (topic !== TOPIC) return;
  try { const { id } = JSON.parse(new TextDecoder().decode(payload)); if (typeof id === 'string') void reproducir(id); } catch { /* dato ajeno o roto */ }
});

if (import.meta.env.DEV) (globalThis as unknown as { __botonera: unknown }).__botonera = { reproducidos: 0 };
