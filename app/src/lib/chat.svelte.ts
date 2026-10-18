import type { RecordModel } from 'pocketbase';
import { pb } from './pb';

const PAGINA = 50;
const EXPAND = 'author';

/** Chat de una sala: últimos 50 + realtime. Los mensajes quedan en orden cronológico. Llamar `cerrar()` al terminar. */
export function abrirChat(roomId: string) {
  const estado = $state<{ mensajes: RecordModel[]; hayMas: boolean; error: string }>({ mensajes: [], hayMas: false, error: '' });
  let cerrado = false;
  const filtroSala = pb.filter('room = {:r}', { r: roomId });

  const insertar = (m: RecordModel) => {
    if (estado.mensajes.some((x) => x.id === m.id)) return;
    estado.mensajes = [...estado.mensajes, m].sort((a, b) => (a.created < b.created ? -1 : a.created > b.created ? 1 : 0));
  };

  async function cargar(antes?: string) {
    const filter = antes ? pb.filter(`${filtroSala} && created < {:c}`, { c: antes }) : filtroSala;
    const r = await pb.collection('messages').getList(1, PAGINA, { filter, sort: '-created', expand: EXPAND, skipTotal: true });
    if (cerrado) return;
    estado.mensajes = [...r.items.reverse(), ...estado.mensajes];
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
      if (primero) await cargar(primero.created);
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
