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

// Llama a la RoomService de LiveKit con un token de admin firmado acá.
async function roomService(method: string, body: object) {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const ahora = Math.floor(Date.now() / 1000);
  const cuerpo = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ iss: lk.key, nbf: ahora, exp: ahora + 60, video: { roomCreate: true, roomList: true } })}`;
  const jwt = `${cuerpo}.${createHmac('sha256', lk.secret).update(cuerpo).digest('base64url')}`;
  const res = await fetch(`${lk.apiUrl}/twirp/livekit.RoomService/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` }, body: JSON.stringify(body),
  });
  expect(res.status).toBe(200);
  return res.json();
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
    expect(c.name).toBe(b.authStore.record!.name);
    expect(c.video).toEqual({ room: voz.id, roomJoin: true, canSubscribe: true, canPublish: true, canPublishData: true, canUpdateOwnMetadata: true });
    expect(c.exp - c.nbf).toBeLessThanOrEqual(600);
    expect(c.exp - c.nbf).toBeGreaterThan(590);
  });

  it('token de pantalla: otra identidad que solo publica la pantalla', async () => {
    const { b, c: otro, voz } = await setup();
    const res = await b.send(`/api/rooms/${voz.id}/token-pantalla`, { method: 'POST' });
    const c = verificar(res.token, lk.secret);
    expect(c.sub).toBe(`${b.authStore.record!.id}.pantalla`);
    expect(c.name).toBe(`${b.authStore.record!.name} (pantalla)`);
    expect(c.video).toEqual({ room: voz.id, roomJoin: true, canSubscribe: false, canPublish: true, canPublishData: false, canPublishSources: ['screen_share'] });
    await expect(otro.send(`/api/rooms/${voz.id}/token-pantalla`, { method: 'POST' })).rejects.toMatchObject({ status: 403 });
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
  describe('moderación', () => {
    const silenciar = (pb: { send: Function }, g: string, user: string, silenciado: boolean) =>
      pb.send(`/api/groups/${g}/silenciar`, { method: 'POST', body: { user, silenciado } });

    it('dueño silencia y el siguiente token no permite micrófono', async () => {
      const { a, b, g, voz } = await setup();
      const bId = b.authStore.record!.id;
      expect(await silenciar(a, g.id, bId, true)).toEqual({ ok: true });
      expect((await a.collection('groups').getOne(g.id)).silenciados).toEqual([bId]);
      const c = verificar((await token(b, voz.id)).token, lk.secret);
      expect(c.video.canPublishSources).toEqual(['camera', 'screen_share', 'screen_share_audio']);
    });

    it('dueño quita el silencio y el token vuelve a permitir todo', async () => {
      const { a, b, g, voz } = await setup();
      const bId = b.authStore.record!.id;
      await silenciar(a, g.id, bId, true);
      expect(await silenciar(a, g.id, bId, false)).toEqual({ ok: true });
      expect((await a.collection('groups').getOne(g.id)).silenciados).toEqual([]);
      const c = verificar((await token(b, voz.id)).token, lk.secret);
      expect(c.video.canPublishSources).toBeUndefined();
    });

    it('desconectar: solo el dueño, y no a sí mismo', async () => {
      const { a, b, g } = await setup();
      const desconectar = (pb: { send: Function }, user: string) => pb.send(`/api/groups/${g.id}/desconectar`, { method: 'POST', body: { user } });
      expect(await desconectar(a, b.authStore.record!.id)).toEqual({ ok: true });
      await expect(desconectar(b, a.authStore.record!.id)).rejects.toMatchObject({ status: 403 });
      await expect(desconectar(a, a.authStore.record!.id)).rejects.toMatchObject({ status: 400 });
    });

    it('bloquear la voz: no recibe token hasta que el dueño lo permite; solo el dueño', async () => {
      const { a, b, g, voz } = await setup();
      const bId = b.authStore.record!.id;
      const bloquear = (pb: { send: Function }, user: string, bloqueado: boolean) =>
        pb.send(`/api/groups/${g.id}/bloquear-voz`, { method: 'POST', body: { user, bloqueado } });
      expect(await bloquear(a, bId, true)).toEqual({ ok: true });
      await expect(token(b, voz.id)).rejects.toMatchObject({ status: 403 });
      await expect(b.collection('groups').update(g.id, { bloqueados: [] })).rejects.toBeTruthy();
      await expect(bloquear(b, a.authStore.record!.id, true)).rejects.toMatchObject({ status: 403 });
      await bloquear(a, bId, false);
      expect((await token(b, voz.id)).token).toBeTruthy();
    });

    it('mover: solo a una sala de voz del mismo grupo', async () => {
      const { a, b, g, voz } = await setup();
      const mover = (sala: string) => a.send(`/api/groups/${g.id}/mover`, { method: 'POST', body: { user: b.authStore.record!.id, sala } });
      expect(await mover(voz.id)).toEqual({ ok: true });
      await expect(mover('noexiste123456')).rejects.toMatchObject({ status: 400 });
    });

    it('no dueño → 403', async () => {
      const { a, b, g } = await setup();
      await expect(silenciar(b, g.id, a.authStore.record!.id, true)).rejects.toMatchObject({ status: 403 });
    });

    it('silenciar al dueño → 400', async () => {
      const { a, g } = await setup();
      await expect(silenciar(a, g.id, a.authStore.record!.id, true)).rejects.toMatchObject({ status: 400 });
    });

    it('silenciar a un no miembro → 400', async () => {
      const { a, c, g } = await setup();
      await expect(silenciar(a, g.id, c.authStore.record!.id, true)).rejects.toMatchObject({ status: 400 });
      await expect(a.send(`/api/groups/${g.id}/silenciar`, { method: 'POST', body: { user: 'x' } }))
        .rejects.toMatchObject({ status: 400 });
    });

    it('echar con livekit vivo no falla y saca de silenciados', async () => {
      const { a, b, g } = await setup();
      const aId = a.authStore.record!.id;
      await silenciar(a, g.id, b.authStore.record!.id, true);
      await a.collection('groups').update(g.id, { members: [aId] });
      const grupo = await a.collection('groups').getOne(g.id);
      expect(grupo.members).toEqual([aId]);
      expect(grupo.silenciados).toEqual([]);
    });

    it('salir del grupo también saca de silenciados', async () => {
      const { a, b, g } = await setup();
      await silenciar(a, g.id, b.authStore.record!.id, true);
      await b.send(`/api/groups/${g.id}/leave`, { method: 'POST' });
      expect((await a.collection('groups').getOne(g.id)).silenciados).toEqual([]);
    });

    it('borrar sala de voz con livekit vivo no falla', async () => {
      const { a, chat, voz } = await setup();
      await roomService('CreateRoom', { name: voz.id });
      await a.collection('rooms').delete(voz.id);
      await expect(a.collection('rooms').getOne(voz.id)).rejects.toMatchObject({ status: 404 });
      expect((await roomService('ListRooms', { names: [voz.id] })).rooms ?? []).toEqual([]);
      await a.collection('rooms').delete(chat.id); // no es de voz: no toca livekit
    });

    it('miembro no puede editar silenciados por la API de registros', async () => {
      const { a, b, g } = await setup();
      const bId = b.authStore.record!.id;
      await silenciar(a, g.id, bId, true);
      await expect(b.collection('groups').update(g.id, { silenciados: [] })).rejects.toMatchObject({ status: 404 });
      expect((await a.collection('groups').getOne(g.id)).silenciados).toEqual([bId]);
    });
  
    it('con livekit vivo no se registran fallos', async () => {
      await new Promise((r) => setTimeout(r, 3500)); // los logs de PocketBase se guardan cada ~3 s
      expect((await h.admin.logs.getList(1, 50, { filter: 'message = "LiveKit falló"' })).items).toEqual([]);
    });

    it('livekit caído: se registra con warn y no revierte', async () => {
      const h2 = await startPocketBase({
        env: { LIVEKIT_URL: lk.wsUrl, LIVEKIT_API_URL: 'http://127.0.0.1:1', LIVEKIT_API_KEY: lk.key, LIVEKIT_API_SECRET: lk.secret },
      });
      try {
        const a = await h2.nuevoUsuario('ana');
        const b = await h2.nuevoUsuario('beto');
        const g = await a.collection('groups').create({ name: 'g' });
        const inv = await a.collection('invites').create({ group: g.id });
        await b.send('/api/invites/join', { method: 'POST', body: { code: inv.code } });
        const voz = (await a.collection('rooms').getFullList()).find((r) => r.kind === 'voz')!;
        const bId = b.authStore.record!.id;
        expect(await silenciar(a, g.id, bId, true)).toEqual({ ok: true });
        await a.collection('groups').update(g.id, { members: [a.authStore.record!.id] });
        await a.collection('rooms').delete(voz.id);
        expect((await a.collection('groups').getOne(g.id)).silenciados).toEqual([]);
        let metodos: string[] = [];
        for (let i = 0; i < 60 && metodos.length < 3; i++) {
          await new Promise((r) => setTimeout(r, 100));
          const logs = await h2.admin.logs.getList(1, 50, { filter: 'message = "LiveKit falló"' });
          metodos = logs.items.map((l) => l.data.method).sort();
        }
        expect(metodos).toEqual(['DeleteRoom', 'RemoveParticipant', 'RemoveParticipant', 'UpdateParticipant']);
      } finally {
        await h2.stop();
      }
    });
  });
});
