import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type PocketBase from 'pocketbase';
import { startPocketBase, type Harness } from './harness';

let h: Harness;
beforeAll(async () => { h = await startPocketBase(); });
afterAll(async () => { await h.stop(); });

const solicitar = (pb: PocketBase, body: object) => pb.send('/api/amigos/solicitar', { method: 'POST', body });
const id = (pb: PocketBase) => pb.authStore.record!.id;
const nombre = (pb: PocketBase) => pb.authStore.record!.name as string;
const usuario = (pb: PocketBase) => pb.authStore.record!.username as string;

describe('amistades', () => {
  it('solicitar por usuario sin distinguir mayúsculas: pendiente visible para ambos y perfil visible', async () => {
    const [a, b, c] = await Promise.all(['ana', 'beto', 'carla'].map((n) => h.nuevoUsuario(n)));
    const { amistad } = await solicitar(a, { username: ' ' + usuario(b).toUpperCase() + ' ' });
    expect(amistad).toMatchObject({ de: id(a), para: id(b), estado: 'pendiente' });
    for (const p of [a, b]) expect((await p.collection('amistades').getFullList()).map((x) => x.id)).toEqual([amistad.id]);
    expect((await c.collection('amistades').getFullList())).toEqual([]);
    expect((await b.collection('users').getOne(id(a))).name).toBe(nombre(a));
    await expect(c.collection('users').getOne(id(a))).rejects.toMatchObject({ status: 404 });
    // quien pide no ve al otro hasta que acepta, aunque el otro tenga otros amigos
    await solicitar(c, { usuario: id(b) });
    await solicitar(b, { usuario: id(c) });
    await expect(a.collection('users').getOne(id(b))).rejects.toMatchObject({ status: 404 });
    await b.collection('amistades').update(amistad.id, { estado: 'aceptada' });
    expect((await a.collection('users').getOne(id(b))).name).toBe(nombre(b));
  });

  it('errores con texto', async () => {
    const [a, b] = await Promise.all(['ana', 'beto'].map((n) => h.nuevoUsuario(n)));
    await expect(solicitar(a, { username: 'nadie-asi' })).rejects.toMatchObject({ status: 404, message: 'No hay nadie con ese usuario.' });
    // el apodo ya no sirve para buscar
    await expect(solicitar(a, { username: nombre(b) })).rejects.toMatchObject({ status: 404 });
    await expect(solicitar(a, { nombre: nombre(b) })).rejects.toMatchObject({ status: 404 });
    await expect(solicitar(a, { usuario: 'noexiste123456' })).rejects.toMatchObject({ status: 404 });
    await expect(solicitar(a, { usuario: id(a) })).rejects.toMatchObject({ status: 400, message: 'No te podés agregar a vos mismo.' });
    await solicitar(a, { usuario: id(b) });
    await expect(solicitar(a, { usuario: id(b) })).rejects.toMatchObject({ status: 400, message: 'Ya le mandaste una solicitud.' });
    await solicitar(b, { usuario: id(a) });
    await expect(solicitar(a, { usuario: id(b) })).rejects.toMatchObject({ status: 400, message: 'Ya son amigos.' });
  });

  it('cruzadas (seguidas y a la vez) dejan una sola amistad aceptada', async () => {
    const [a, b, c, d] = await Promise.all(['ana', 'beto', 'carla', 'dani'].map((n) => h.nuevoUsuario(n)));
    await solicitar(a, { usuario: id(b) });
    expect((await solicitar(b, { usuario: id(a) })).amistad.estado).toBe('aceptada');
    expect((await a.collection('amistades').getFullList()).map((x) => x.estado)).toEqual(['aceptada']);

    await Promise.allSettled([solicitar(c, { usuario: id(d) }), solicitar(d, { usuario: id(c) })]);
    expect((await c.collection('amistades').getFullList()).map((x) => x.estado)).toEqual(['aceptada']);
  });

  it('solo "para" acepta; cualquiera borra; no se crea directo', async () => {
    const [a, b] = await Promise.all(['ana', 'beto'].map((n) => h.nuevoUsuario(n)));
    const { amistad } = await solicitar(a, { usuario: id(b) });
    await expect(a.collection('amistades').update(amistad.id, { estado: 'aceptada' })).rejects.toMatchObject({ status: 404 });
    await expect(b.collection('amistades').update(amistad.id, { estado: 'aceptada', de: id(b) })).rejects.toMatchObject({ status: 404 });
    expect((await b.collection('amistades').update(amistad.id, { estado: 'aceptada' })).estado).toBe('aceptada');
    await a.collection('amistades').delete(amistad.id);
    for (const p of [a, b]) expect(await p.collection('amistades').getFullList()).toEqual([]);
    await expect(a.collection('amistades').create({ de: id(a), para: id(b), estado: 'aceptada' })).rejects.toMatchObject({ status: 403 });
  });
});
