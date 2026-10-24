import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { startPocketBase, type Harness } from './harness';

let h: Harness;
beforeAll(async () => { h = await startPocketBase(); });
afterAll(async () => { await h.stop(); });

describe('grupos', () => {
  it('el dueño sube foto al grupo; un miembro no', async () => {
    const a = await h.nuevoUsuario('ana');
    const b = await h.nuevoUsuario('beto');
    const g = await a.collection('groups').create({ name: 'g' });
    const inv = await a.collection('invites').create({ group: g.id });
    await b.send('/api/invites/join', { method: 'POST', body: { code: inv.code } });
    const foto = () => {
      const d = new FormData();
      d.append('foto', new File([readFileSync(new URL('./fixtures/img.png', import.meta.url))], 'img.png', { type: 'image/png' }));
      return d;
    };
    expect((await a.collection('groups').update(g.id, foto())).foto).toMatch(/\.png$/);
    await expect(b.collection('groups').update(g.id, foto())).rejects.toMatchObject({ status: 404 });
  });

  it('create group sets owner, members and default rooms', async () => {
    const a = await h.nuevoUsuario('ana');
    const b = await h.nuevoUsuario('beto');
    const g = await a.collection('groups').create({ name: 'Los pibes', owner: b.authStore.record!.id, members: [b.authStore.record!.id] });
    const aid = a.authStore.record!.id;
    expect(g.owner).toBe(aid);
    expect(g.members).toEqual([aid]);
    const salas = await a.collection('rooms').getFullList({ filter: `group = "${g.id}"`, sort: 'position' });
    expect(salas.map((s) => [s.name, s.kind])).toEqual([['General', 'chat'], ['General', 'voz']]);
  });

  it('one group per user', async () => {
    const a = await h.nuevoUsuario('ana');
    await a.collection('groups').create({ name: 'uno' });
    await expect(a.collection('groups').create({ name: 'dos' })).rejects.toMatchObject({ status: 400 });
  });

  it('non-member cannot view group', async () => {
    const a = await h.nuevoUsuario('ana');
    const b = await h.nuevoUsuario('beto');
    const g = await a.collection('groups').create({ name: 'privado' });
    await expect(b.collection('groups').getOne(g.id)).rejects.toMatchObject({ status: 404 });
    expect((await b.collection('groups').getList()).items).toHaveLength(0);
  });

  it('owner renames, non-owner cannot', async () => {
    const a = await h.nuevoUsuario('ana');
    const b = await h.nuevoUsuario('beto');
    const g = await a.collection('groups').create({ name: 'viejo' });
    await a.collection('groups').update(g.id, { name: 'nuevo' });
    await h.admin.collection('groups').update(g.id, { members: [a.authStore.record!.id, b.authStore.record!.id] });
    await expect(b.collection('groups').update(g.id, { name: 'hack' })).rejects.toMatchObject({ status: 404 });
  });

  it('owner cannot add members directly', async () => {
    const a = await h.nuevoUsuario('ana');
    const c = await h.nuevoUsuario('carla');
    const g = await a.collection('groups').create({ name: 'g' });
    await expect(a.collection('groups').update(g.id, { members: [a.authStore.record!.id, c.authStore.record!.id] }))
      .rejects.toMatchObject({ status: 400 });
  });

  it('owner cannot remove self', async () => {
    const a = await h.nuevoUsuario('ana');
    const g = await a.collection('groups').create({ name: 'g' });
    await expect(a.collection('groups').update(g.id, { members: [] })).rejects.toMatchObject({ status: 400 });
  });

  it('owner cannot transfer ownership via body or modifiers', async () => {
    const a = await h.nuevoUsuario('ana');
    const c = await h.nuevoUsuario('carla');
    const g = await a.collection('groups').create({ name: 'g' });
    for (const body of [{ owner: c.authStore.record!.id }, { 'owner+': c.authStore.record!.id }]) {
      await a.collection('groups').update(g.id, body).then(() => {}, (err) => expect([400, 404]).toContain(err.status));
      expect((await h.admin.collection('groups').getOne(g.id)).owner).toBe(a.authStore.record!.id);
    }
  });

  it('owner cannot add members via modifier', async () => {
    const a = await h.nuevoUsuario('ana');
    const c = await h.nuevoUsuario('carla');
    const g = await a.collection('groups').create({ name: 'g' });
    await expect(a.collection('groups').update(g.id, { 'members+': [c.authStore.record!.id] }))
      .rejects.toMatchObject({ status: 400 });
    expect((await h.admin.collection('groups').getOne(g.id)).members).toEqual([a.authStore.record!.id]);
  });

  it('deleting group cascades rooms messages invites', async () => {
    const a = await h.nuevoUsuario('ana');
    const g = await a.collection('groups').create({ name: 'g' });
    const inv = await a.collection('invites').create({ group: g.id });
    const sala = (await a.collection('rooms').getFullList({ filter: `group = "${g.id}" && kind = "chat"` }))[0];
    const aid = a.authStore.record!.id;
    const m = await a.collection('messages').create({ room: sala.id, author: aid, text: 'hola' });
    const m2 = await h.admin.collection('messages').create({ room: sala.id, author: aid, text: 'del admin' });
    await a.collection('groups').delete(g.id);
    await expect(h.admin.collection('rooms').getOne(sala.id)).rejects.toMatchObject({ status: 404 });
    await expect(h.admin.collection('messages').getOne(m.id)).rejects.toMatchObject({ status: 404 });
    await expect(h.admin.collection('messages').getOne(m2.id)).rejects.toMatchObject({ status: 404 });
    await expect(h.admin.collection('invites').getOne(inv.id)).rejects.toMatchObject({ status: 404 });
  });

  it('anota cuándo entra cada uno; el baneado sale y no puede volver hasta que lo desbaneen', async () => {
    const a = await h.nuevoUsuario('ana');
    const b = await h.nuevoUsuario('beto');
    const bid = b.authStore.record!.id;
    const g = await a.collection('groups').create({ name: 'g', descripcion: 'hola' });
    const inv = await a.collection('invites').create({ group: g.id });
    const unirse = () => b.send('/api/invites/join', { method: 'POST', body: { code: inv.code } });
    await unirse();
    const g1 = await a.collection('groups').getOne(g.id);
    expect(g1.descripcion).toBe('hola');
    expect(Object.keys(g1.ingresos).sort()).toEqual([a.authStore.record!.id, bid].sort());
    await expect(a.collection('groups').update(g.id, { ingresos: {} })).rejects.toMatchObject({ status: 403 });
    await expect(b.send(`/api/groups/${g.id}/banear`, { method: 'POST', body: { user: a.authStore.record!.id, baneado: true } })).rejects.toMatchObject({ status: 403 });

    await a.send(`/api/groups/${g.id}/banear`, { method: 'POST', body: { user: bid, baneado: true } });
    const g2 = await a.collection('groups').getOne(g.id);
    expect(g2.members).not.toContain(bid);
    expect(g2.baneados).toMatchObject([{ id: bid, name: b.authStore.record!.name }]);
    await expect(unirse()).rejects.toMatchObject({ status: 403 });

    await a.send(`/api/groups/${g.id}/banear`, { method: 'POST', body: { user: bid, baneado: false } });
    expect((await a.collection('groups').getOne(g.id)).baneados).toEqual([]);
    await unirse();
    expect((await a.collection('groups').getOne(g.id)).members).toContain(bid);
  });
});
