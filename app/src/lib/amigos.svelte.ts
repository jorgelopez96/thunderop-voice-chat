import type { RecordModel } from 'pocketbase';
import { pb } from './pb';
import { mensajeError } from './sesion.svelte';

export type Amigo = { amistad: string; usuario: RecordModel };
export type Solicitud = { id: string; usuario: RecordModel };

export const amigos = $state<{ lista: Amigo[]; recibidas: Solicitud[]; enviadas: Solicitud[]; cargado: boolean }>({ lista: [], recibidas: [], enviadas: [], cargado: false });

pb.authStore.onChange(() => {
  if (!pb.authStore.token) Object.assign(amigos, { lista: [], recibidas: [], enviadas: [], cargado: false });
});

/** Reparte las amistades según mi lado. El perfil de a quien le pedí no se ve hasta que acepta: queda solo el id. */
export function separarAmistades(registros: RecordModel[], yo: string) {
  const res = { lista: [] as Amigo[], recibidas: [] as Solicitud[], enviadas: [] as Solicitud[] };
  for (const r of registros) {
    const soyDe = r.de === yo;
    const otroId: string = soyDe ? r.para : r.de;
    const usuario = (soyDe ? r.expand?.para : r.expand?.de) ?? { id: otroId, name: '', collectionId: '', collectionName: 'users' };
    if (r.estado === 'aceptada') res.lista.push({ amistad: r.id, usuario });
    else (soyDe ? res.enviadas : res.recibidas).push({ id: r.id, usuario });
  }
  res.lista.sort((a, b) => a.usuario.name.localeCompare(b.usuario.name));
  return res;
}

async function recargar() {
  const yo = pb.authStore.record?.id;
  if (!yo) return;
  try {
    const regs = await pb.collection('amistades').getFullList({ expand: 'de,para', sort: 'created', requestKey: null });
    Object.assign(amigos, separarAmistades(regs, yo), { cargado: true });
  } catch { /* red caída: se conserva lo anterior */ }
}

export function iniciarAmigos(): () => void {
  void recargar();
  const parar = pb.collection('amistades').subscribe('*', () => void recargar());
  return () => { parar.then((f) => f()).catch(() => {}); };
}

/** Cada acción devuelve '' si salió bien o el mensaje de error para mostrar. */
async function hacer(f: () => Promise<unknown>): Promise<string> {
  try { await f(); await recargar(); return ''; } catch (e) { return mensajeError(e); }
}

const solicitar = (body: object) => hacer(() => pb.send('/api/amigos/solicitar', { method: 'POST', body }));
export const solicitarPorNombre = (nombre: string) => solicitar({ nombre: nombre.trim() });
export const solicitarA = (usuario: string) => solicitar({ usuario });
export const aceptar = (id: string) => hacer(() => pb.collection('amistades').update(id, { estado: 'aceptada' }));
/** Rechazar, cancelar y eliminar amigo son lo mismo: borrar la amistad. */
export const quitar = (id: string) => hacer(() => pb.collection('amistades').delete(id));
