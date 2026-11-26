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

  it('users list only shows visible users (self, group mates, friends)', async () => {
    const a = await h.nuevoUsuario('ana');
    await h.nuevoUsuario('beto');
    expect((await a.collection('users').getFullList()).map((u) => u.id)).toEqual([a.authStore.record!.id]);
  });

  it('visto only changes through the heartbeat', async () => {
    const a = await h.nuevoUsuario('ana');
    const id = a.authStore.record!.id;
    await a.collection('users').update(id, { visto: '2099-01-01 00:00:00.000Z' });
    expect((await a.collection('users').getOne(id)).visto).toBe('');
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
    expect((await b.collection('users').getOne(a.authStore.record!.id)).name).toBe(a.authStore.record!.name);
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
    expect(r.expand!.members.map((m: any) => m.name)).toContain(a.authStore.record!.name);
  });
});

describe('tarjeta de perfil', () => {
  it('guarda estado, juegos y redes válidos', async () => {
    const a = await h.nuevoUsuario('ana');
    const id = a.authStore.record!.id;
    await a.collection('users').update(id, { actividad: 'Jugando Fortnite', juegos: ['Fortnite', 'GTA IV'], redes: { instagram: 'osidis', youtube: '' } });
    const u = await a.collection('users').getOne(id);
    expect([u.actividad, u.juegos, u.redes]).toEqual(['Jugando Fortnite', ['Fortnite', 'GTA IV'], { instagram: 'osidis', youtube: '' }]);
  });

  it('rechaza más de 5 juegos, redes desconocidas y usuarios con caracteres raros', async () => {
    const a = await h.nuevoUsuario('ana');
    const id = a.authStore.record!.id;
    for (const datos of [{ juegos: ['a', 'b', 'c', 'd', 'e', 'f'] }, { juegos: [''] }, { redes: { tiktok: 'x' } }, { redes: { instagram: 'a/b?c' } }]) {
      await expect(a.collection('users').update(id, datos)).rejects.toMatchObject({ status: 400 });
    }
  });

  it('cumpleaños: solo día y mes, solo si lo muestra, y no se puede inventar', async () => {
    const a = await h.nuevoUsuario('ana');
    const b = await h.nuevoUsuario('beto');
    const g = await a.collection('groups').create({ name: 'g' });
    const inv = await a.collection('invites').create({ group: g.id });
    await b.send('/api/invites/join', { method: 'POST', body: { code: inv.code } });
    const id = a.authStore.record!.id;
    await a.collection('users').update(id, { cumple: '12-25' });
    expect((await b.collection('users').getOne(id)).cumple).toBe('');
    await a.collection('users').update(id, { mostrarCumple: true });
    const visto = await b.collection('users').getOne(id);
    expect(visto.cumple).toBe('01-01'); // el harness crea las cuentas con nacimiento 1996-01-01
    expect(visto.nacimiento).toBeUndefined();
    await a.collection('users').update(id, { mostrarCumple: false });
    expect((await b.collection('users').getOne(id)).cumple).toBe('');
  });

  it('al crear la cuenta tampoco entra un cumpleaños inventado ni redes inválidas', async () => {
    const datos = (extra: object) => ({ email: `x${Math.random().toString(36).slice(2, 8)}@test.local`, password: 'clave-larga-123', passwordConfirm: 'clave-larga-123',
      username: `x${Math.random().toString(36).slice(2, 10)}`, name: 'X', terminos: 1, perfilCompleto: true, nacimiento: '1996-01-01', ...extra });
    const u = await h.admin.collection('users').create(datos({ cumple: '12-25', mostrarCumple: true }));
    expect([u.cumple, u.mostrarCumple]).toEqual(['', false]);
    await expect(h.admin.collection('users').create(datos({ redes: { instagram: 'a/b?c' } }))).rejects.toMatchObject({ status: 400 });
  });

  it('código para invitar: solo con sesión', async () => {
    const a = await h.nuevoUsuario('ana');
    expect(await a.send('/api/invitacion', {})).toHaveProperty('codigo');
    expect((await fetch(`${h.url}/api/invitacion`)).status).toBe(401);
  });
});
