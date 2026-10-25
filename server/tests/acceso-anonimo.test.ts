import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import PocketBase from 'pocketbase';
import { startPocketBase, type Harness } from './harness';

// Revisión de seguridad: nadie sin sesión lee datos, y nadie ve lo de un grupo ajeno ni lo privado de otro.
let h: Harness;
beforeAll(async () => { h = await startPocketBase(); });
afterAll(async () => { await h.stop(); });

const id = (pb: PocketBase) => pb.authStore.record!.id;
/** Lo que devuelve listar una colección: los registros, o [] si el servidor la niega (401/403/404). */
async function ve(pb: PocketBase, coleccion: string, filtro = ''): Promise<unknown[]> {
  try { return (await pb.collection(coleccion).getList(1, 50, filtro ? { filter: filtro } : {})).items; }
  catch (e) { expect([401, 403, 404]).toContain((e as { status: number }).status); return []; }
}

async function escenario() {
  const [a, b, c] = await Promise.all(['ana', 'beto', 'caro'].map((n) => h.nuevoUsuario(n)));
  const g = await a.collection('groups').create({ name: 'secreto' });
  const chat = (await a.collection('rooms').getFullList({ filter: `group = "${g.id}" && kind = "chat"` }))[0].id;
  await a.collection('messages').create({ room: chat, author: id(a), text: 'solo del grupo' });
  await a.collection('invites').create({ group: g.id });
  const { amistad } = await a.send('/api/amigos/solicitar', { method: 'POST', body: { usuario: id(b) } });
  await b.collection('amistades').update(amistad.id, { estado: 'aceptada' });
  await b.collection('privados').create({ author: id(b), para: id(a), text: 'privado' });
  await a.collection('diagnosticos').create({ user: id(a), version: '0.7.1', codigo: 4, contenido: 'x' });
  await a.send('/api/amigos/bloquear', { method: 'POST', body: { usuario: id(c), bloquear: true } });
  return { a, b, c, g, chat };
}

describe('acceso sin sesión y entre usuarios', () => {
  it('sin sesión no se lee ninguna colección', async () => {
    await escenario();
    const anonimo = new PocketBase(h.url);
    const colecciones = (await h.admin.collections.getFullList()).filter((c) => !c.system && !c.name.startsWith('_'));
    expect(colecciones.map((c) => c.name)).toEqual(expect.arrayContaining(['users', 'groups', 'rooms', 'messages', 'privados', 'amistades', 'invites', 'sonidos', 'diagnosticos']));
    for (const c of colecciones) expect(await ve(anonimo, c.name), c.name).toEqual([]);
  });

  it('alguien de afuera no ve el grupo, sus salas, mensajes, invitaciones ni sonidos', async () => {
    const { c, g, chat } = await escenario();
    expect(await ve(c, 'groups', `id = "${g.id}"`)).toEqual([]);
    expect(await ve(c, 'rooms', `group = "${g.id}"`)).toEqual([]);
    expect(await ve(c, 'messages', `room = "${chat}"`)).toEqual([]);
    expect(await ve(c, 'invites', `group = "${g.id}"`)).toEqual([]);
    expect(await ve(c, 'sonidos', `group = "${g.id}"`)).toEqual([]);
  });

  it('los privados, los diagnósticos y la lista de bloqueados de otro no se leen', async () => {
    const { a, b, c } = await escenario();
    expect(await ve(c, 'privados')).toEqual([]);
    expect(await ve(b, 'diagnosticos')).toEqual([]);
    expect(await ve(a, 'diagnosticos')).toEqual([]); // ni el propio: solo el superusuario
    expect((await b.collection('users').getOne(id(a))).bloqueados).toBeUndefined();
  });

  it('las rutas propias piden sesión o código', async () => {
    const anonimo = new PocketBase(h.url);
    for (const [ruta, body] of [['/api/amigos/bloquear', { usuario: 'x', bloquear: true }], ['/api/amigos/solicitar', { username: 'x' }], ['/api/descarga/validar', {}]] as const) {
      await expect(anonimo.send(ruta, { method: 'POST', body })).rejects.toMatchObject({ status: 401 });
    }
    await expect(anonimo.send('/api/amigos/bloqueados', {})).rejects.toMatchObject({ status: 401 });
  });
});
