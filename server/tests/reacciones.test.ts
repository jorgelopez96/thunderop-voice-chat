import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type PocketBase from 'pocketbase';
import { startPocketBase, type Harness } from './harness';

let h: Harness;
beforeAll(async () => { h = await startPocketBase(); });
afterAll(async () => { await h.stop(); });

const id = (pb: PocketBase) => pb.authStore.record!.id;
const reaccionar = (pb: PocketBase, mid: string, emoji: string) => pb.send('/api/reaccionar', { method: 'POST', body: { coleccion: 'privados', id: mid, emoji } });

describe('reacciones', () => {
  it('poner, sumar y sacar; un tercero no puede; no se cuelan al crear', async () => {
    const [a, b, c] = await Promise.all(['ana', 'beto', 'carla'].map((n) => h.nuevoUsuario(n)));
    await a.send('/api/amigos/solicitar', { method: 'POST', body: { usuario: id(b) } });
    await b.send('/api/amigos/solicitar', { method: 'POST', body: { usuario: id(a) } });
    const m = await a.collection('privados').create({ author: id(a), para: id(b), text: 'hola', reacciones: { '😈': [id(c)] } });
    expect(m.reacciones).toEqual({});
    await reaccionar(a, m.id, '👍');
    await reaccionar(b, m.id, '👍');
    expect((await b.collection('privados').getOne(m.id)).reacciones).toEqual({ '👍': [id(a), id(b)] });
    await reaccionar(a, m.id, '👍');
    await reaccionar(b, m.id, '👍');
    expect((await b.collection('privados').getOne(m.id)).reacciones).toEqual({});
    await expect(reaccionar(c, m.id, '👍')).rejects.toMatchObject({ status: 404 });
  });
});

describe('respuestas', () => {
  it('se puede responder en el mismo privado, no citar uno de otra conversación', async () => {
    const [a, b, c] = await Promise.all(['ana', 'beto', 'carla'].map((n) => h.nuevoUsuario(n)));
    for (const [x, y] of [[a, b], [a, c]] as const) {
      await x.send('/api/amigos/solicitar', { method: 'POST', body: { usuario: id(y) } });
      await y.send('/api/amigos/solicitar', { method: 'POST', body: { usuario: id(x) } });
    }
    const m = await a.collection('privados').create({ author: id(a), para: id(b), text: 'hola' });
    const r = await b.collection('privados').create({ author: id(b), para: id(a), text: 'qué tal', respondeA: m.id });
    expect(r.respondeA).toBe(m.id);
    await expect(a.collection('privados').create({ author: id(a), para: id(c), text: 'x', respondeA: m.id })).rejects.toMatchObject({ status: 400 });
  });
});

describe('editar', () => {
  it('el autor cambia solo el texto y queda marcado; nadie más puede', async () => {
    const [a, b] = await Promise.all(['ana', 'beto'].map((n) => h.nuevoUsuario(n)));
    await a.send('/api/amigos/solicitar', { method: 'POST', body: { usuario: id(b) } });
    await b.send('/api/amigos/solicitar', { method: 'POST', body: { usuario: id(a) } });
    const m = await a.collection('privados').create({ author: id(a), para: id(b), text: 'hola' });
    expect(m.editado).toBe('');
    const e = await a.collection('privados').update(m.id, { text: 'chau' });
    expect(e.text).toBe('chau');
    expect(e.editado).not.toBe('');
    await expect(a.collection('privados').update(m.id, { text: '  ' })).rejects.toMatchObject({ status: 400 });
    await expect(a.collection('privados').update(m.id, { text: 'x', para: id(a) })).rejects.toMatchObject({ status: 400 });
    await expect(b.collection('privados').update(m.id, { text: 'x' })).rejects.toMatchObject({ status: 404 });
  });
});
