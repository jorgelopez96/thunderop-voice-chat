import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startPocketBase, type Harness } from './harness';

let h: Harness;
beforeAll(async () => { h = await startPocketBase(); });
afterAll(async () => { await h.stop(); });

const join = (pb: any, code: string) => pb.send('/api/invites/join', { method: 'POST', body: { code } });
const leave = (pb: any, id: string) => pb.send(`/api/groups/${id}/leave`, { method: 'POST' });

async function setup() {
  const a = await h.nuevoUsuario('ana');
  const b = await h.nuevoUsuario('beto');
  const c = await h.nuevoUsuario('carla');
  const g = await a.collection('groups').create({ name: 'g' });
  const inv = await a.collection('invites').create({ group: g.id });
  return { a, b, c, g, inv };
}

describe('invitaciones', () => {
  it('member creates invite with server-side code and expiry', async () => {
    const a = await h.nuevoUsuario('ana');
    const b = await h.nuevoUsuario('beto');
    const g = await a.collection('groups').create({ name: 'g' });
    const inv = await a.collection('invites').create({ group: g.id, code: 'hack', created_by: b.authStore.record!.id });
    expect(inv.code).toMatch(/^[a-z0-9]{10}$/);
    expect(inv.code).not.toBe('hack');
    expect(inv.created_by).toBe(a.authStore.record!.id);
    const diff = new Date(inv.expires).getTime() - (Date.now() + 7 * 864e5);
    expect(Math.abs(diff)).toBeLessThan(60_000);
  });

  it('join with code adds member', async () => {
    const { b, g, inv } = await setup();
    expect(await join(b, inv.code)).toEqual({ group: g.id });
    expect((await b.collection('groups').getOne(g.id)).id).toBe(g.id);
    expect(await b.collection('rooms').getFullList({ filter: `group = "${g.id}"` })).toHaveLength(2);
  });

  it('join is idempotent for existing member', async () => {
    const { b, g, inv } = await setup();
    await join(b, inv.code);
    await join(b, inv.code);
    const bid = b.authStore.record!.id;
    const members = (await b.collection('groups').getOne(g.id)).members;
    expect(members.filter((m: string) => m === bid)).toHaveLength(1);
  });

  it('join rejects unknown code', async () => {
    const { b } = await setup();
    await expect(join(b, 'nope')).rejects.toMatchObject({ status: 404 });
  });

  it('join rejects expired code', async () => {
    const { b, inv } = await setup();
    await h.admin.collection('invites').update(inv.id, { expires: '2020-01-01 00:00:00.000Z' });
    await expect(join(b, inv.code)).rejects.toMatchObject({ status: 404 });
  });

  it('any member can invite', async () => {
    const { b, g, inv } = await setup();
    await join(b, inv.code);
    const inv2 = await b.collection('invites').create({ group: g.id });
    expect(inv2.created_by).toBe(b.authStore.record!.id);
  });

  it('non-member cannot list invites', async () => {
    const { c } = await setup();
    expect((await c.collection('invites').getList()).items).toHaveLength(0);
  });

  it('owner kicks member', async () => {
    const { a, b, g, inv } = await setup();
    await join(b, inv.code);
    await a.collection('groups').update(g.id, { members: [a.authStore.record!.id] });
    await expect(b.collection('groups').getOne(g.id)).rejects.toMatchObject({ status: 404 });
  });

  it("kicked member's own invites are revoked", async () => {
    const { a, b, g, inv } = await setup();
    await join(b, inv.code);
    const x = await b.collection('invites').create({ group: g.id });
    await a.collection('groups').update(g.id, { members: [a.authStore.record!.id] });
    const c = await h.nuevoUsuario('carla');
    await expect(join(c, x.code)).rejects.toMatchObject({ status: 404 });
    await expect(h.admin.collection('invites').getOne(x.id)).rejects.toMatchObject({ status: 404 });
  });

  it('leaving revokes own invites', async () => {
    const { b, c, g, inv } = await setup();
    await join(b, inv.code);
    const y = await b.collection('invites').create({ group: g.id });
    await leave(b, g.id);
    await expect(join(c, y.code)).rejects.toMatchObject({ status: 404 });
  });

  it("other members' invites survive a kick", async () => {
    const { a, b, c, g, inv } = await setup();
    await join(b, inv.code);
    const z = await a.collection('invites').create({ group: g.id });
    await a.collection('groups').update(g.id, { members: [a.authStore.record!.id] });
    expect(await join(c, z.code)).toEqual({ group: g.id });
  });

  it('kicked member can rejoin with a fresh invite from a member', async () => {
    const { a, b, g, inv } = await setup();
    await join(b, inv.code);
    await a.collection('groups').update(g.id, { members: [a.authStore.record!.id] });
    const w = await a.collection('invites').create({ group: g.id });
    expect(await join(b, w.code)).toEqual({ group: g.id });
  });

  it('member leaves', async () => {
    const { a, b, c, g, inv } = await setup();
    await join(b, inv.code);
    await leave(b, g.id);
    await expect(b.collection('groups').getOne(g.id)).rejects.toMatchObject({ status: 404 });
    await expect(leave(a, g.id)).rejects.toMatchObject({ status: 400 });
    await expect(leave(c, g.id)).rejects.toMatchObject({ status: 404 });
  });

  it('member with invites deletes account', async () => {
    const { b, inv } = await setup();
    await join(b, inv.code);
    const mia = await b.collection('invites').create({ group: inv.group });
    await b.collection('users').delete(b.authStore.record!.id);
    await expect(h.admin.collection('invites').getOne(mia.id)).rejects.toMatchObject({ status: 404 });
  });

  it('owner deletes account cascades group', async () => {
    const { a, b, g } = await setup();
    const sala = (await a.collection('rooms').getFullList({ filter: `group = "${g.id}" && kind = "chat"` }))[0];
    const msg = await a.collection('messages').create({ room: sala.id, author: a.authStore.record!.id, text: 'hola' });
    const invA = await a.collection('invites').create({ group: g.id });
    const gb = await b.collection('groups').create({ name: 'gb' });
    const invB = await b.collection('invites').create({ group: gb.id });
    await join(a, invB.code);
    const invAEnB = await a.collection('invites').create({ group: gb.id });
    await a.collection('users').delete(a.authStore.record!.id);
    const adm = h.admin;
    await expect(adm.collection('groups').getOne(g.id)).rejects.toMatchObject({ status: 404 });
    await expect(adm.collection('rooms').getOne(sala.id)).rejects.toMatchObject({ status: 404 });
    await expect(adm.collection('messages').getOne(msg.id)).rejects.toMatchObject({ status: 404 });
    await expect(adm.collection('invites').getOne(invA.id)).rejects.toMatchObject({ status: 404 });
    await expect(adm.collection('invites').getOne(invAEnB.id)).rejects.toMatchObject({ status: 404 });
    expect((await adm.collection('groups').getOne(gb.id)).id).toBe(gb.id);
  });
});
