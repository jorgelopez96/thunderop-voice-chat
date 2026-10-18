import { createHmac } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startLiveKit, startPocketBase, type Harness, type LiveKit } from './harness';

let lk: LiveKit;
let h: Harness;
beforeAll(async () => {
  lk = await startLiveKit();
  h = await startPocketBase({
    env: { LIVEKIT_URL: lk.wsUrl, LIVEKIT_API_URL: lk.apiUrl, LIVEKIT_API_KEY: lk.key, LIVEKIT_API_SECRET: lk.secret },
  });
});
afterAll(async () => { await h?.stop(); await lk?.stop(); });

// Verifica la firma HS256 con el secret y devuelve los claims.
function verificar(token: string, secret: string): any {
  const [cab, cuerpo, firma] = token.split('.');
  expect(JSON.parse(Buffer.from(cab, 'base64url').toString()).alg).toBe('HS256');
  expect(createHmac('sha256', secret).update(`${cab}.${cuerpo}`).digest('base64url')).toBe(firma);
  return JSON.parse(Buffer.from(cuerpo, 'base64url').toString());
}

async function setup() {
  const a = await h.nuevoUsuario('ana');
  const b = await h.nuevoUsuario('beto');
  const c = await h.nuevoUsuario('carla');
  const g = await a.collection('groups').create({ name: 'g' });
  const inv = await a.collection('invites').create({ group: g.id });
  await b.send('/api/invites/join', { method: 'POST', body: { code: inv.code } });
  const salas = await a.collection('rooms').getFullList({ filter: `group = "${g.id}"` });
  const voz = salas.find((r) => r.kind === 'voz')!;
  const chat = salas.find((r) => r.kind === 'chat')!;
  return { a, b, c, g, voz, chat };
}

const token = (pb: { send: Function }, sala: string) => pb.send(`/api/rooms/${sala}/token`, { method: 'POST' });

describe('voz', () => {
  it('miembro recibe token válido para sala de voz', async () => {
    const { b, voz } = await setup();
    const res = await token(b, voz.id);
    expect(res.url).toBe(lk.wsUrl);
    const c = verificar(res.token, lk.secret);
    expect(c.iss).toBe(lk.key);
    expect(c.sub).toBe(b.authStore.record!.id);
    expect(c.name).toBe('beto');
    expect(c.video).toEqual({ room: voz.id, roomJoin: true, canSubscribe: true, canPublish: true, canPublishData: true });
    expect(c.exp - c.nbf).toBeLessThanOrEqual(600);
    expect(c.exp - c.nbf).toBeGreaterThan(590);
  });

  it('no miembro → 403', async () => {
    const { c, voz } = await setup();
    await expect(token(c, voz.id)).rejects.toMatchObject({ status: 403 });
  });

  it('sala de chat → 400', async () => {
    const { a, chat } = await setup();
    await expect(token(a, chat.id)).rejects.toMatchObject({ status: 400 });
  });

  it('sin auth → 401', async () => {
    const { voz } = await setup();
    const res = await fetch(`${h.url}/api/rooms/${voz.id}/token`, { method: 'POST' });
    expect(res.status).toBe(401);
  });

  it('silenciado recibe canPublishSources sin microphone', async () => {
    const { b, g, voz } = await setup();
    await h.admin.collection('groups').update(g.id, { silenciados: [b.authStore.record!.id] });
    const c = verificar((await token(b, voz.id)).token, lk.secret);
    expect(c.video.canPublishSources).toEqual(['camera', 'screen_share', 'screen_share_audio']);
  });

  it('el dueño puede silenciar; el miembro ve silenciados', async () => {
    const { a, b, g } = await setup();
    const bId = b.authStore.record!.id;
    await a.collection('groups').update(g.id, { silenciados: [bId] });
    expect((await b.collection('groups').getOne(g.id)).silenciados).toEqual([bId]);
    await expect(b.collection('groups').update(g.id, { silenciados: [] })).rejects.toMatchObject({ status: 404 });
  });

  it('sin variables LIVEKIT_* → 503 con mensaje en español', async () => {
    const h2 = await startPocketBase();
    try {
      const a = await h2.nuevoUsuario('ana');
      const g = await a.collection('groups').create({ name: 'g' });
      const voz = (await a.collection('rooms').getFullList()).find((r) => r.kind === 'voz')!;
      await expect(token(a, voz.id)).rejects.toMatchObject({
        status: 503, response: { message: 'La voz no está configurada en el servidor.' },
      });
      await expect(a.send(`/api/groups/${g.id}/voz`, {})).rejects.toMatchObject({ status: 503 });
    } finally {
      await h2.stop();
    }
  });

  it('presencia: sala vacía → []', async () => {
    const { b, g, voz } = await setup();
    expect(await b.send(`/api/groups/${g.id}/voz`, {})).toEqual({ [voz.id]: [] });
  });

  it('presencia: no miembro → 403', async () => {
    const { c, g } = await setup();
    await expect(c.send(`/api/groups/${g.id}/voz`, {})).rejects.toMatchObject({ status: 403 });
  });
});
