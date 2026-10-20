import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type PocketBase from 'pocketbase';
import { startPocketBase, type Harness } from './harness';

let h: Harness;
beforeAll(async () => { h = await startPocketBase(); });
afterAll(async () => { await h.stop(); });

const id = (pb: PocketBase) => pb.authStore.record!.id;
const solicitar = (pb: PocketBase, usuario: string) => pb.send('/api/amigos/solicitar', { method: 'POST', body: { usuario } });
const escribir = (de: PocketBase, para: PocketBase, text = 'hola') => de.collection('privados').create({ author: id(de), para: id(para), text });

async function amigos() {
  const [a, b, c] = await Promise.all(['ana', 'beto', 'carla'].map((n) => h.nuevoUsuario(n)));
  await solicitar(a, id(b));
  const { amistad } = await solicitar(b, id(a));
  return { a, b, c, amistad };
}

describe('privados', () => {
  it('amigos se escriben y ambos lo ven; un tercero no', async () => {
    const { a, b, c } = await amigos();
    const m = await escribir(a, b);
    await escribir(b, a, 'chau');
    for (const p of [a, b]) expect((await p.collection('privados').getFullList()).length).toBe(2);
    expect(await c.collection('privados').getFullList({ filter: `author = "${id(a)}" || para = "${id(a)}"` })).toEqual([]);
    await expect(c.collection('privados').getOne(m.id)).rejects.toMatchObject({ status: 404 });
  });

  it('sin amistad o después de eliminarla → 403, el historial queda', async () => {
    const { a, b, c, amistad } = await amigos();
    await expect(escribir(a, c)).rejects.toMatchObject({ status: 403, message: 'Solo podés escribirle a tus amigos.' });
    await solicitar(a, id(c)); // pendiente no alcanza
    await expect(escribir(a, c)).rejects.toMatchObject({ status: 403 });
    await escribir(a, b);
    await b.collection('amistades').delete(amistad.id);
    await expect(escribir(b, a)).rejects.toMatchObject({ status: 403 });
    for (const p of [a, b]) expect((await p.collection('privados').getFullList()).length).toBe(1);
  });

  it('author ajeno, vacío y borrado solo del autor', async () => {
    const { a, b } = await amigos();
    await expect(b.collection('privados').create({ author: id(a), para: id(b), text: 'x' })).rejects.toMatchObject({ status: 400 });
    await expect(escribir(a, b, '   ')).rejects.toMatchObject({ status: 400 });
    const m = await escribir(a, b);
    await expect(b.collection('privados').delete(m.id)).rejects.toMatchObject({ status: 404 });
    await a.collection('privados').delete(m.id);
    expect(await b.collection('privados').getFullList()).toEqual([]);
  });
});
