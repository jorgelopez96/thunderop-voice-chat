import type { RecordModel } from 'pocketbase';
import { pb } from './pb';
import { leerPrefs } from './prefs';
import { contextoVoz, publicarDatos, alRecibirDatos, voz } from './voz.svelte';
import { validarSonido, Limite, mensajeSubida } from './botoneraLogica';

const TOPIC = 'botonera';
const buffers = new Map<string, { group: string; b: AudioBuffer }>(); // ponytail: sin tope de tamaño; 50 sonidos × ≤10 s por grupo es acotado
// Un cupo por contexto: al cerrarse el de la voz (onended no es fiable ahí) su cupo se descarta con él.
const cupos = new WeakMap<AudioContext, Limite>();
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
  catch (e) { throw new Error(mensajeSubida((e as { response?: Parameters<typeof mensajeSubida>[0] })?.response)); }
}

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

/** Reproduce localmente por el contexto de la voz; si ya hay 3 sonando, se descarta. Sin voz no hay contexto: no suena. */
async function reproducir(id: string) {
  const c = contextoVoz();
  if (!c) return;
  let cupo = cupos.get(c);
  if (!cupo) cupos.set(c, cupo = new Limite(3));
  if (!cupo.intentar()) return;
  let tomado = true;
  const soltar = () => { if (tomado) { tomado = false; cupo.liberar(); } };
  try {
    const b = await buffer(id, c);
    if (c.state === 'closed') return soltar();
    const fuente = c.createBufferSource(), vol = c.createGain();
    fuente.buffer = b; vol.gain.value = leerPrefs().volBotonera;
    fuente.connect(vol).connect(c.destination);
    fuente.onended = () => { fuente.disconnect(); vol.disconnect(); soltar(); };
    fuente.start();
  } catch { return soltar(); }
  if (import.meta.env.DEV) (globalThis as unknown as { __botonera?: { reproducidos: number } }).__botonera!.reproducidos++;
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
