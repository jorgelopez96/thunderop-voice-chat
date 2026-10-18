import type { RecordModel } from 'pocketbase';
import { pb } from './pb';
import { mensajeError } from './sesion.svelte';

const PAGINA = 50;
const EXPAND = 'author';

/** Antepone una página más antigua sin repetir ids ya presentes (realtime o cargas solapadas). */
export function anteponer<T extends { id: string }>(actuales: T[], pagina: T[]) {
  const ids = new Set(actuales.map((m) => m.id));
  return [...pagina.filter((m) => !ids.has(m.id)), ...actuales];
}

/** Chat de una sala: últimos 50 + realtime. Los mensajes quedan en orden cronológico. Llamar `cerrar()` al terminar. */
export function abrirChat(roomId: string) {
  const estado = $state<{ mensajes: RecordModel[]; hayMas: boolean; error: string }>({ mensajes: [], hayMas: false, error: '' });
  let cerrado = false;
  let cargando = false;
  const filtroSala = pb.filter('room = {:r}', { r: roomId });

  const insertar = (m: RecordModel) => {
    if (estado.mensajes.some((x) => x.id === m.id)) return;
    estado.mensajes = [...estado.mensajes, m].sort((a, b) => (a.created < b.created ? -1 : a.created > b.created ? 1 : 0));
  };

  async function cargar(antes?: string) {
    const filter = antes ? pb.filter(`${filtroSala} && created < {:c}`, { c: antes }) : filtroSala;
    const r = await pb.collection('messages').getList(1, PAGINA, { filter, sort: '-created', expand: EXPAND, skipTotal: true });
    if (cerrado) return;
    estado.mensajes = anteponer(estado.mensajes, r.items.reverse());
    estado.hayMas = r.items.length === PAGINA;
  }
  cargar().catch(() => { estado.error = 'No se pudieron cargar los mensajes.'; });

  const sub = pb.collection('messages').subscribe('*', async (e) => {
    if (e.action === 'delete') { estado.mensajes = estado.mensajes.filter((m) => m.id !== e.record.id); return; }
    if (e.action !== 'create') return;
    // El evento realtime llega sin `expand`: se trae el mensaje con su autor.
    let m = e.record;
    try { m = await pb.collection('messages').getOne(m.id, { expand: EXPAND }); } catch { /* sin autor visible: "Ex miembro" */ }
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
    cerrar() { cerrado = true; sub.then((f) => f()).catch(() => {}); },
  };
}

export async function enviar(roomId: string, texto: string, archivo?: File) {
  const d = new FormData();
  d.append('room', roomId);
  d.append('author', pb.authStore.record!.id);
  if (texto) d.append('text', texto);
  if (archivo) d.append('file', archivo);
  await pb.collection('messages').create(d);
}

export async function borrar(id: string) {
  await pb.collection('messages').delete(id);
}
