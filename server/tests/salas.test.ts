import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startPocketBase, type Harness } from './harness';

let h: Harness;
beforeAll(async () => { h = await startPocketBase(); });
afterAll(async () => { await h.stop(); });

const rejected = (p: Promise<any>) =>
  p.then(() => { throw new Error('should have been rejected'); }, (e) => expect([400, 404]).toContain(e.status));

async function setup() {
  const a = await h.nuevoUsuario('ana');
  const b = await h.nuevoUsuario('beto');
  const c = await h.nuevoUsuario('carla');
  const g = await a.collection('groups').create({ name: 'g' });
  const inv = await a.collection('invites').create({ group: g.id });
  await b.send('/api/invites/join', { method: 'POST', body: { code: inv.code } });
  return { a, b, c, g };
}

describe('salas', () => {
  it('owner creates renames deletes rooms', async () => {
    const { a, g } = await setup();
    const r = await a.collection('rooms').create({ group: g.id, name: 'Juegos', kind: 'chat', position: 2 });
    expect((await a.collection('rooms').update(r.id, { name: 'Otro' })).name).toBe('Otro');
    await a.collection('rooms').delete(r.id);
    await rejected(a.collection('rooms').getOne(r.id));
  });

  it('member cannot manage rooms', async () => {
    const { a, b, g } = await setup();
    await rejected(b.collection('rooms').create({ group: g.id, name: 'x', kind: 'chat' }));
    const r = await a.collection('rooms').create({ group: g.id, name: 'Juegos', kind: 'chat' });
    await rejected(b.collection('rooms').update(r.id, { name: 'y' }));
    await rejected(b.collection('rooms').delete(r.id));
  });

  it('owner cannot move room to another group', async () => {
    const { a, g } = await setup();
    const otro = await h.nuevoUsuario('dani');
    const g2 = await otro.collection('groups').create({ name: 'g2' });
    const r = await a.collection('rooms').create({ group: g.id, name: 'Juegos', kind: 'chat' });
    await rejected(a.collection('rooms').update(r.id, { group: g2.id }));
  });

  it('non-member cannot list rooms', async () => {
    const { c } = await setup();
    expect((await c.collection('rooms').getList()).items).toHaveLength(0);
  });

  it('rejects invalid kind', async () => {
    const { a, g } = await setup();
    await expect(a.collection('rooms').create({ group: g.id, name: 'x', kind: 'video' })).rejects.toMatchObject({ status: 400 });
  });
});
