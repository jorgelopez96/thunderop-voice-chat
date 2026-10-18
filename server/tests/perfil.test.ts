import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startPocketBase, type Harness } from './harness';

let h: Harness;
beforeAll(async () => { h = await startPocketBase(); });
afterAll(async () => { await h.stop(); });

describe('perfil de usuario', () => {
  it('register and update own profile', async () => {
    const a = await h.nuevoUsuario('ana');
    const id = a.authStore.record!.id;
    await a.collection('users').update(id, { name: 'Ana', color: '#ff8800', status: 'jugando' });
    const u = await a.collection('users').getOne(id);
    expect([u.name, u.color, u.status]).toEqual(['Ana', '#ff8800', 'jugando']);
  });

  it('cannot update another user', async () => {
    const a = await h.nuevoUsuario('ana');
    const b = await h.nuevoUsuario('beto');
    await expect(b.collection('users').update(a.authStore.record!.id, { name: 'x' }))
      .rejects.toMatchObject({ status: 404 });
  });

  it('rejects bad color', async () => {
    const a = await h.nuevoUsuario('ana');
    await expect(a.collection('users').update(a.authStore.record!.id, { color: 'rojo' }))
      .rejects.toMatchObject({ status: 400 });
  });

  it('users list is not public', async () => {
    const a = await h.nuevoUsuario('ana');
    await expect(a.collection('users').getList()).rejects.toMatchObject({ status: 403 });
  });

  const join = (pb: any, code: string) => pb.send('/api/invites/join', { method: 'POST', body: { code } });
  async function grupoCon(owner: any, ...others: any[]) {
    const g = await owner.collection('groups').create({ name: 'g' });
    const inv = await owner.collection('invites').create({ group: g.id });
    for (const o of others) await join(o, inv.code);
    return g;
  }

  it('user can view self', async () => {
    const a = await h.nuevoUsuario('ana');
    expect((await a.collection('users').getOne(a.authStore.record!.id)).id).toBe(a.authStore.record!.id);
  });

  it('stranger cannot view profile', async () => {
    const a = await h.nuevoUsuario('ana');
    const b = await h.nuevoUsuario('beto');
    await expect(b.collection('users').getOne(a.authStore.record!.id)).rejects.toMatchObject({ status: 404 });
  });

  it('group mate can view profile', async () => {
    const a = await h.nuevoUsuario('ana');
    const b = await h.nuevoUsuario('beto');
    await grupoCon(a, b);
    expect((await b.collection('users').getOne(a.authStore.record!.id)).name).toBe('ana');
  });

  it('members in different groups cannot view each other', async () => {
    const a = await h.nuevoUsuario('ana');
    const b = await h.nuevoUsuario('beto');
    const c = await h.nuevoUsuario('carla');
    await grupoCon(a, b);
    await grupoCon(c, b);
    await expect(a.collection('users').getOne(c.authStore.record!.id)).rejects.toMatchObject({ status: 404 });
  });

  it('expand members works for group mates', async () => {
    const a = await h.nuevoUsuario('ana');
    const b = await h.nuevoUsuario('beto');
    const g = await grupoCon(a, b);
    const r = await b.collection('groups').getOne(g.id, { expand: 'members' });
    expect(r.expand!.members.map((m: any) => m.name)).toContain('ana');
  });
});
