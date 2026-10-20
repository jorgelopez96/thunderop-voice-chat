import type { RecordModel } from 'pocketbase';
import { pb } from './pb';
import { mensajeError } from './sesion.svelte';

const PAGINA = 50;
const EXPAND = 'author,respondeA.author'; // el mensaje citado y su autor, para mostrar la respuesta

/** Antepone una página más antigua sin repetir ids ya presentes (realtime o cargas solapadas). */
export function anteponer<T extends { id: string }>(actuales: T[], pagina: T[]) {
  const ids = new Set(actuales.map((m) => m.id));
  return [...pagina.filter((m) => !ids.has(m.id)), ...actuales];
}

export type ChatAbierto = ReturnType<typeof abrirLista>;

/** Chat de una sala de grupo. */
export const abrirChat = (roomId: string) => abrirLista('messages', pb.filter('room = {:r}', { r: roomId }));

/** Mensajes de `coleccion` que cumplen `filtroSala`: últimos 50 + realtime, en orden cronológico. Llamar `cerrar()` al terminar. */
export function abrirLista(coleccion: 'messages' | 'privados', filtroSala: string) {
  const estado = $state<{ mensajes: RecordModel[]; hayMas: boolean; error: string }>({ mensajes: [], hayMas: false, error: '' });
  let cerrado = false;
  let cargando = false;

  const insertar = (m: RecordModel) => {
    if (estado.mensajes.some((x) => x.id === m.id)) return;
    estado.mensajes = [...estado.mensajes, m].sort((a, b) => (a.created < b.created ? -1 : a.created > b.created ? 1 : 0));
  };

  async function cargar(antes?: string) {
    const filter = antes ? pb.filter(`${filtroSala} && created < {:c}`, { c: antes }) : filtroSala;
    const r = await pb.collection(coleccion).getList(1, PAGINA, { filter, sort: '-created', expand: EXPAND, skipTotal: true });
    if (cerrado) return;
    estado.mensajes = anteponer(estado.mensajes, r.items.reverse());
    estado.hayMas = r.items.length === PAGINA;
  }
  cargar().catch(() => { estado.error = 'No se pudieron cargar los mensajes.'; });

  const sub = pb.collection(coleccion).subscribe('*', async (e) => {
    if (e.action === 'delete') { estado.mensajes = estado.mensajes.filter((m) => m.id !== e.record.id); return; }
    if (e.action === 'update') { // reacciones: se conserva el autor ya expandido
      estado.mensajes = estado.mensajes.map((m) => (m.id === e.record.id ? { ...e.record, expand: m.expand } : m));
      return;
    }
    if (e.action !== 'create') return;
    // El evento realtime llega sin `expand`: se trae el mensaje con su autor.
    let m = e.record;
    try { m = await pb.collection(coleccion).getOne(m.id, { expand: EXPAND }); } catch { /* sin autor visible: "Ex miembro" */ }
    if (!cerrado) insertar(m);
  }, { filter: filtroSala });

  return {
    get mensajes() { return estado.mensajes; },
    get hayMas() { return estado.hayMas; },
    get error() { return estado.error; },
    async cargarMas() {
      const primero = estado.mensajes[0];
      if (!primero || cargando) return;
      cargando = true;
      try { await cargar(primero.created); }
      catch (e) { estado.error = mensajeError(e); }
      finally { cargando = false; }
    },
    /** Pone o saca mi reacción; llega a todos por el realtime. */
    reaccionar: (id: string, emoji: string) => pb.send('/api/reaccionar', { method: 'POST', body: { coleccion, id, emoji } }),
    cerrar() { cerrado = true; sub.then((f) => f()).catch(() => {}); },
  };
}

export async function enviar(roomId: string, texto: string, archivo?: File, respondeA?: string) {
  const d = new FormData();
  d.append('room', roomId);
  d.append('author', pb.authStore.record!.id);
  if (texto) d.append('text', texto);
  if (archivo) d.append('file', archivo);
  if (respondeA) d.append('respondeA', respondeA);
  await pb.collection('messages').create(d);
}

export async function borrar(id: string) {
  await pb.collection('messages').delete(id);
}
