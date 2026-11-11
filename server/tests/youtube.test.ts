import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import { startPocketBase, type Harness } from './harness';

// Stub de oEmbed: título "Video <id>".
let oembed: Server;
let h: Harness;
beforeAll(async () => {
  oembed = createServer((req, res) => {
    const url = new URL(req.url!, 'http://x').searchParams.get('url') ?? '';
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ title: `Video ${url.slice(-11)}` }));
  });
  await new Promise<void>((ok) => oembed.listen(0, '127.0.0.1', ok));
  const { port } = oembed.address() as { port: number };
  h = await startPocketBase({ env: { YOUTUBE_OEMBED: `http://127.0.0.1:${port}/oembed` } });
});
afterAll(async () => {
  await h.stop();
  await new Promise((ok) => oembed.close(ok));
});

const unirse = (pb: any, code: string) => pb.send('/api/invites/join', { method: 'POST', body: { code } });
const yt = (pb: any, room: string, body: object) => pb.send(`/api/rooms/${room}/youtube`, { method: 'POST', body });

async function setup() {
  const a = await h.nuevoUsuario('ana');
  const b = await h.nuevoUsuario('beto');
  const c = await h.nuevoUsuario('carla');
  const g = await a.collection('groups').create({ name: 'g' });
  const inv = await a.collection('invites').create({ group: g.id });
  await unirse(b, inv.code);
  // Con roles, música/videos/sonidos piden permiso: acá el rol Todos los tiene, como antes de los roles.
  await a.collection('groups').update(g.id, { roles: [{ id: 'todos', nombre: 'Todos', color: '', permisos: ['youtube'] }] });
  const salas = await a.collection('rooms').getFullList({ filter: `group = "${g.id}"` });
  return { a, b, c, voz: salas.find((r) => r.kind === 'voz')!.id, chat: salas.find((r) => r.kind === 'chat')!.id };
}

describe('youtube juntos', () => {
  it('poner arranca el video con título y quién lo puso; se lee por la colección', async () => {
    const { a, b, voz } = await setup();
    const r = await yt(b, voz, { accion: 'poner', url: 'https://youtu.be/dQw4w9WgXcQ?t=42' });
    expect(r.video).toMatchObject({ room: voz, videoId: 'dQw4w9WgXcQ', titulo: 'Video dQw4w9WgXcQ', puestoPor: b.authStore.record.id, pausaS: null });
    expect(r.video.inicioMs - r.ahora).toBe(1500);
    expect((await a.collection('videos').getFullList())[0].videoId).toBe('dQw4w9WgXcQ');
  });

  it('acepta los links de video y rechaza el resto', async () => {
    const { b, voz } = await setup();
    const validos: [string, string][] = [
      ['https://www.youtube.com/watch?v=AAAAAAAAAA1&list=x', 'AAAAAAAAAA1'],
      ['https://youtube.com/watch?feature=share&v=AAAAAAAAAA2', 'AAAAAAAAAA2'],
      ['https://www.youtube.com/shorts/AAAAAAAAAA3', 'AAAAAAAAAA3'],
      ['https://www.youtube.com/live/AAAAAAAAAA4?si=x', 'AAAAAAAAAA4'],
      ['https://www.youtube.com/embed/AAAAAAAAA_5', 'AAAAAAAAA_5'],
      ['m.youtube.com/watch?v=AAAAAAAAA-6', 'AAAAAAAAA-6'],
    ];
    for (const [url, id] of validos) expect((await yt(b, voz, { accion: 'poner', url })).video.videoId, url).toBe(id);
    for (const url of ['https://youtube.com.evil.com/watch?v=AAAAAAAAAAA', 'https://youtube.com@evil.com/watch?v=AAAAAAAAAAA',
      'https://www.youtube.com/watch?v=corto', 'https://www.youtube.com/playlist?list=PLxxxxxxxxxx', 'https://vimeo.com/123', '']) {
      await expect(yt(b, voz, { accion: 'poner', url }), url).rejects.toMatchObject({ status: 400, response: { message: 'Ese link no es de un video de YouTube.' } });
    }
  });

  it('pausar, ir y reanudar mueven la posición compartida', async () => {
    const { a, b, voz } = await setup();
    const r0 = await yt(b, voz, { accion: 'poner', url: 'https://youtu.be/BBBBBBBBBBB' });
    await h.admin.collection('videos').update(r0.video.id, { inicioMs: r0.ahora - 10000 });
    const p = await yt(a, voz, { accion: 'pausar' });
    expect(p.video.pausaS).toBeGreaterThan(9);
    expect(p.video.pausaS).toBeLessThan(11.5);
    expect((await yt(a, voz, { accion: 'ir', posS: 42.5 })).video.pausaS).toBe(42.5);
    const s = await yt(b, voz, { accion: 'reanudar' });
    expect(s.video.pausaS).toBeNull();
    expect(Math.abs((s.ahora - s.video.inicioMs) / 1000 - 42.5)).toBeLessThan(0.01);
    // sonando: ir corre `inicioMs`
    const i = await yt(b, voz, { accion: 'ir', posS: 5 });
    expect(Math.abs((i.ahora - i.video.inicioMs) / 1000 - 5)).toBeLessThan(0.01);
    for (const posS of [-1, 'x', null, 1e9]) await expect(yt(b, voz, { accion: 'ir', posS })).rejects.toMatchObject({ status: 400 });
  });

  it('sacar deja la sala sin video y pausar sin video no hace nada', async () => {
    const { b, voz } = await setup();
    await yt(b, voz, { accion: 'poner', url: 'https://youtu.be/CCCCCCCCCCC' });
    expect((await yt(b, voz, { accion: 'sacar' })).video).toMatchObject({ videoId: '', titulo: '' });
    expect((await yt(b, voz, { accion: 'pausar' })).video.pausaS).toBeNull();
    // poner otro reemplaza al anterior en el mismo registro
    await yt(b, voz, { accion: 'poner', url: 'https://youtu.be/DDDDDDDDDDD' });
    expect(await b.collection('videos').getFullList()).toHaveLength(1);
  });

  it('GET devuelve el video y la hora del servidor', async () => {
    const { b, voz } = await setup();
    const leer = () => b.send(`/api/rooms/${voz}/youtube`, { method: 'GET' });
    const vacio = await leer();
    expect(vacio.video).toBeNull();
    expect(Math.abs(vacio.ahora - Date.now())).toBeLessThan(2000);
    const r = await yt(b, voz, { accion: 'poner', url: 'https://youtu.be/EEEEEEEEEEE' });
    expect((await leer()).video).toMatchObject({ id: r.video.id, inicioMs: r.video.inicioMs });
  });

  it('alguien de afuera recibe 403, en chat 400 y una acción rara 400', async () => {
    const { b, c, voz, chat } = await setup();
    await expect(yt(c, voz, { accion: 'poner', url: 'https://youtu.be/FFFFFFFFFFF' })).rejects.toMatchObject({ status: 403 });
    await expect(c.send(`/api/rooms/${voz}/youtube`, { method: 'GET' })).rejects.toMatchObject({ status: 403 });
    await expect(c.collection('videos').getFullList()).resolves.toHaveLength(0);
    await expect(yt(b, chat, { accion: 'pausar' })).rejects.toMatchObject({ status: 400, response: { message: 'No es una sala de voz.' } });
    await expect(yt(b, voz, { accion: 'borrarTodo' })).rejects.toMatchObject({ status: 400 });
  });
});
