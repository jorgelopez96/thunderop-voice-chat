import { ClientResponseError, type RecordModel } from 'pocketbase';
import { pb } from './pb';
import { extraerCodigo, linkInvitacion } from './invitacion';
import { salirVoz, voz } from './voz.svelte';

export const grupos = $state<{ lista: RecordModel[]; cargado: boolean }>({ lista: [], cargado: false });
// Svelte no permite reasignar un $state exportado: se expone como propiedad.
export const grupoActual = $state<{ id: string | null }>({ id: null });
/** Quién está en cada sala de voz del grupo actual: `{ [roomId]: { id, name }[] }`. */
export const enVoz = $state<{ grupo: string | null; salas: Record<string, { id: string; name: string; silenciado?: boolean }[]> }>({ grupo: null, salas: {} });

// Al cerrar sesión (o invalidarse) no debe quedar nada del usuario anterior.
pb.authStore.onChange(() => {
  if (!pb.authStore.token) { grupos.lista = []; grupos.cargado = false; grupoActual.id = null; enVoz.grupo = null; enVoz.salas = {}; salirVoz(); voz.error = ''; voz.muteado = false; }
});

const ES = (e: unknown, ...codigos: number[]) => e instanceof ClientResponseError && codigos.includes(e.status);

export async function recargarGrupos() {
  try {
    grupos.lista = await pb.collection('groups').getFullList({ expand: 'members', sort: 'name' });
    grupos.cargado = true;
    if (grupoActual.id && !grupos.lista.some((g) => g.id === grupoActual.id)) grupoActual.id = null;
  } catch { /* red caída: se conserva la lista anterior */ }
}

/** Actualiza `enVoz` con la presencia de voz del grupo. Si falla (red, LiveKit caído) se conserva la última. */
export async function presencia(groupId: string) {
  if (enVoz.grupo !== groupId) { enVoz.grupo = groupId; enVoz.salas = {}; }
  try {
    const salas = await pb.send(`/api/groups/${groupId}/voz`, {});
    if (enVoz.grupo === groupId) enVoz.salas = salas;
  } catch { /* se conserva la presencia anterior */ }
}

async function verificarActual() {
  if (!grupoActual.id) { enVoz.grupo = null; enVoz.salas = {}; return; }
  presencia(grupoActual.id);
  try { await pb.collection('groups').getOne(grupoActual.id); }
  catch (e) { if (ES(e, 404)) { grupoActual.id = null; await recargarGrupos(); } }
}

/** Carga la lista, la mantiene con realtime y vigila `grupoActual`. Devuelve la función de limpieza. */
export function iniciarGrupos(): () => void {
  recargarGrupos();
  const parar = pb.collection('groups').subscribe('*', () => { recargarGrupos(); });
  // ponytail: un miembro echado no recibe evento realtime; sondeo cada 10 s (retraso máx. 10 s) y al enfocar.
  // Mejora: que el servidor publique un evento propio al usuario echado.
  const t = setInterval(verificarActual, 10_000);
  window.addEventListener('focus', verificarActual);
  return () => {
    clearInterval(t);
    window.removeEventListener('focus', verificarActual);
    parar.then((f) => f()).catch(() => {});
  };
}

export async function crearGrupo(name: string) {
  const g = await pb.collection('groups').create({ name });
  await recargarGrupos();
  grupoActual.id = g.id;
}

export async function unirse(entrada: string) {
  const code = extraerCodigo(entrada);
  if (!code) throw new Error('Código inválido');
  try {
    const { group } = await pb.send('/api/invites/join', { method: 'POST', body: { code } });
    await recargarGrupos();
    grupoActual.id = group;
  } catch (e) {
    if (ES(e, 404)) throw new Error('Código inválido o vencido');
    if (ES(e, 400)) throw new Error('El grupo está lleno');
    throw e;
  }
}

export async function crearInvitacion(groupId: string): Promise<string> {
  const inv = await pb.collection('invites').create({ group: groupId });
  return linkInvitacion(inv.code);
}

export async function echar(groupId: string, userId: string) {
  await pb.collection('groups').update(groupId, { 'members-': userId });
}

export async function salirDe(groupId: string) {
  await pb.send(`/api/groups/${groupId}/leave`, { method: 'POST' });
  grupoActual.id = null;
  await recargarGrupos();
}

export async function borrarGrupo(groupId: string) {
  await pb.collection('groups').delete(groupId);
  grupoActual.id = null;
  await recargarGrupos();
}

/** Salas de un grupo, reactivas (realtime). Llamar `parar()` al terminar. */
export function salas(groupId: string) {
  const estado = $state<{ lista: RecordModel[] }>({ lista: [] });
  const cargar = async () => {
    try { estado.lista = await pb.collection('rooms').getFullList({ filter: pb.filter('group = {:g}', { g: groupId }), sort: 'position' }); }
    catch { /* se conserva la lista anterior */ }
  };
  cargar();
  const sub = pb.collection('rooms').subscribe('*', cargar);
  return { estado, parar: () => { sub.then((f) => f()).catch(() => {}); } };
}

export async function crearSala(groupId: string, name: string, kind: 'chat' | 'voz', position: number) {
  await pb.collection('rooms').create({ group: groupId, name, kind, position });
}
export async function renombrarSala(roomId: string, name: string) {
  await pb.collection('rooms').update(roomId, { name });
}
export async function borrarSala(roomId: string) {
  await pb.collection('rooms').delete(roomId);
}
