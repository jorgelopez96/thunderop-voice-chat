import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import PocketBase from 'pocketbase';
import { startPocketBase, type Harness } from './harness';

// livekit.js es CommonJS del JSVM de PocketBase y el paquete es ESM: se evalúa a mano.
const lk = { exports: {} as { silenciado: (p: object, s: string[]) => boolean } };
new Function('module', readFileSync(new URL('../pb_hooks/livekit.js', import.meta.url), 'utf8'))(lk);
const { silenciado } = lk.exports;

let h: Harness;
beforeAll(async () => { h = await startPocketBase(); });
afterAll(async () => { await h.stop(); });

const noUnico = { status: 400, response: { data: { name: { code: 'validation_not_unique' } } } };

describe('nombre único', () => {
  it('no distingue mayúsculas al registrarse ni al renombrarse', async () => {
    const a = await h.nuevoUsuario('ana');
    const b = await h.nuevoUsuario('beto');
    const nombre = a.authStore.record!.name as string;
    const password = randomBytes(8).toString('hex');
    await expect(h.admin.collection('users').create({ email: `x-${randomBytes(4).toString('hex')}@test.local`, password, passwordConfirm: password, name: nombre.toUpperCase() }))
      .rejects.toMatchObject(noUnico);
    await expect(b.collection('users').update(b.authStore.record!.id, { name: nombre.toUpperCase() }))
      .rejects.toMatchObject(noUnico);
  });
});

describe('fundador', () => {
  it('no se lo pone uno mismo, sí un superuser', async () => {
    const password = randomBytes(8).toString('hex');
    const email = `f-${randomBytes(4).toString('hex')}@test.local`;
    const u = await h.nuevoUsuario('fede');
    const creado = await u.collection('users').create({ email, password, passwordConfirm: password, name: `f${randomBytes(3).toString('hex')}`, fundador: true });
    expect((await h.admin.collection('users').getOne(creado.id)).fundador).toBe(false);
    const id = u.authStore.record!.id;
    await u.collection('users').update(id, { fundador: true });
    expect((await h.admin.collection('users').getOne(id)).fundador).toBe(false);
    await h.admin.collection('users').update(id, { fundador: true });
    expect((await h.admin.collection('users').getOne(id)).fundador).toBe(true);
    await u.collection('users').update(id, { status: 'hola' });
    expect((await h.admin.collection('users').getOne(id)).fundador).toBe(true);
  });
});

describe('presencia', () => {
  it('latido guarda visto', async () => {
    const a = await h.nuevoUsuario('ana');
    const r = await a.send('/api/latido', { method: 'POST' });
    const visto = (await a.collection('users').getOne(a.authStore.record!.id)).visto;
    expect(visto).toBe(r.visto);
    expect(Math.abs(Date.parse(visto) - Date.now())).toBeLessThan(5000);
    await expect(new PocketBase(h.url).send('/api/latido', { method: 'POST' })).rejects.toMatchObject({ status: 401 });
  });

  it('silenciado: por el dueño, sin micrófono o con el micrófono muteado', () => {
    const mic = (muted: boolean, source: unknown = 'MICROPHONE') => ({ identity: 'b', tracks: [{ source, muted }] });
    expect(silenciado(mic(false), [])).toBe(false);
    expect(silenciado(mic(false, 2), [])).toBe(false);
    expect(silenciado(mic(false), ['b'])).toBe(true);
    expect(silenciado(mic(true), [])).toBe(true);
    expect(silenciado({ identity: 'b' }, [])).toBe(true);
    expect(silenciado({ identity: 'b', tracks: [{ source: 'SCREEN_SHARE_AUDIO', muted: false }] }, [])).toBe(true);
  });
});
