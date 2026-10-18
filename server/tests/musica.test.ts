import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import { startPocketBase, type Harness } from './harness';

// Stub de oEmbed: `modo` decide si responde con título o con 500.
let modo: 'ok' | 'falla' = 'ok';
let oembed: Server;
let h: Harness;
beforeAll(async () => {
  oembed = createServer((req, res) => {
    if (modo === 'falla') { res.writeHead(500).end(); return; }
    const url = new URL(req.url!, 'http://x').searchParams.get('url') ?? '';
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ title: `Tema ${url.slice(-11)}` }));
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
const musica = (pb: any, room: string, body: object) => pb.send(`/api/rooms/${room}/musica`, { method: 'POST', body });
const yt = (id: string) => `https://www.youtube.com/watch?v=${id}`;

async function setup() {
  const a = await h.nuevoUsuario('ana');
  const b = await h.nuevoUsuario('beto');
  const c = await h.nuevoUsuario('carla');
  const g = await a.collection('groups').create({ name: 'g' });
  const inv = await a.collection('invites').create({ group: g.id });
  await unirse(b, inv.code);
  const salas = await a.collection('rooms').getFullList({ filter: `group = "${g.id}"` });
  const voz = salas.find((r) => r.kind === 'voz')!.id;
  const chat = salas.find((r) => r.kind === 'chat')!.id;
  return { a, b, c, g, voz, chat };
}

const canciones = (pb: any, room: string) => pb.collection('canciones').getFullList({ filter: `room = "${room}"`, sort: 'created' });

describe('música', () => {
  it('agregar el primer link arranca a sonar con título del oEmbed', async () => {
    const { b, voz } = await setup();
    const r = await musica(b, voz, { accion: 'agregar', url: 'https://youtu.be/dQw4w9WgXcQ?t=42' });
    const [c] = await canciones(b, voz);
    expect(c).toMatchObject({ videoId: 'dQw4w9WgXcQ', titulo: 'Tema dQw4w9WgXcQ', estado: 'sonando', agregadoPor: b.authStore.record.id });
    expect(r.reproduccion).toMatchObject({ room: voz, actual: c.id, pausaS: null });
    expect(r.reproduccion.inicioMs - r.ahora).toBe(1500);
    // la reproducción también se lee por la colección
    expect((await b.collection('reproducciones').getFullList())[0].actual).toBe(c.id);
  });

  it('agregar con oEmbed caído usa el título genérico', async () => {
    const { b, voz } = await setup();
    modo = 'falla';
    try {
      await musica(b, voz, { accion: 'agregar', url: yt('aaaaaaaaaaa') });
    } finally { modo = 'ok'; }
    expect((await canciones(b, voz))[0].titulo).toBe('Video de YouTube');
  });

  it('link inválido da 400 con el mensaje', async () => {
    const { b, voz } = await setup();
    const validos = [
      'https://www.youtube.com/watch?v=AAAAAAAAAA1&list=x',
      'https://youtube.com/watch?feature=share&v=AAAAAAAAAA2',
      'https://youtu.be/AAAAAAAAAA3',
      'https://www.youtube.com/shorts/AAAAAAAAAA4',
      'https://music.youtube.com/watch?v=AAAAAAAAAA5',
      'https://m.youtube.com/watch?v=AAAAAAAAA_6',
      'youtube.com/watch?v=AAAAAAAAA-7',
    ];
    for (const url of validos) await musica(b, voz, { accion: 'agregar', url });
    expect((await canciones(b, voz)).map((c: any) => c.videoId)).toEqual(
      ['AAAAAAAAAA1', 'AAAAAAAAAA2', 'AAAAAAAAAA3', 'AAAAAAAAAA4', 'AAAAAAAAAA5', 'AAAAAAAAA_6', 'AAAAAAAAA-7']);

    const invalidos = [
      'https://youtube.com.evil.com/watch?v=AAAAAAAAAAA',
      'https://evil.com/watch?v=AAAAAAAAAAA',
      'https://youtube.com@evil.com/watch?v=AAAAAAAAAAA',
      'https://www.youtube.com/watch?v=corto',
      'https://www.youtube.com/watch?v=AAAAAAAAAAAB',
      'https://www.youtube.com/watch',
      'https://vimeo.com/123',
      'cualquier cosa',
      '',
    ];
    for (const url of invalidos) {
      await expect(musica(b, voz, { accion: 'agregar', url }), url).rejects.toMatchObject({
        status: 400, response: { message: 'Ese link no es de YouTube.' },
      });
    }
  });

  it('pausar y reanudar conservan la posición', async () => {
    const { b, voz } = await setup();
    const r0 = await musica(b, voz, { accion: 'agregar', url: yt('BBBBBBBBBBB') });
    // la corremos 10 s hacia atrás para tener una posición no trivial
    await h.admin.collection('reproducciones').update(r0.reproduccion.id, { inicioMs: r0.ahora - 10000 });
    const p = await musica(b, voz, { accion: 'pausar' });
    expect(p.reproduccion.pausaS).toBeGreaterThan(10 - 1.5);
    expect(p.reproduccion.pausaS).toBeLessThan(10 + 1.5);
    await new Promise((r) => setTimeout(r, 700));
    const s = await musica(b, voz, { accion: 'reanudar' });
    expect(s.reproduccion.pausaS).toBeNull();
    expect(Math.abs((s.ahora - s.reproduccion.inicioMs) / 1000 - p.reproduccion.pausaS)).toBeLessThan(1.5);
  });

  it('terminó duplicado avanza una sola vez', async () => {
    const { a, b, voz } = await setup();
    await musica(b, voz, { accion: 'agregar', url: yt('CCCCCCCCCC1') });
    await musica(b, voz, { accion: 'agregar', url: yt('CCCCCCCCCC2') });
    await musica(b, voz, { accion: 'agregar', url: yt('CCCCCCCCCC3') });
    const [c1, c2, c3] = await canciones(b, voz);
    await Promise.all([a, b, a, b].map((pb) => musica(pb, voz, { accion: 'termino', cancionId: c1.id })));
    const despues = await canciones(b, voz);
    expect(despues.map((c: any) => c.estado)).toEqual(['hecha', 'sonando', 'cola']);
    expect((await b.collection('reproducciones').getFullList())[0].actual).toBe(c2.id);
    expect(c3.estado).toBe('cola');
  });

  it('saltar con id viejo no hace nada', async () => {
    const { b, voz } = await setup();
    await musica(b, voz, { accion: 'agregar', url: yt('DDDDDDDDDD1') });
    await musica(b, voz, { accion: 'agregar', url: yt('DDDDDDDDDD2') });
    const [c1, c2] = await canciones(b, voz);
    await musica(b, voz, { accion: 'saltar', cancionId: c1.id });
    const r = await musica(b, voz, { accion: 'saltar', cancionId: c1.id });
    expect(r.reproduccion.actual).toBe(c2.id);
    expect((await canciones(b, voz)).map((c: any) => c.estado)).toEqual(['hecha', 'sonando']);
  });

  it('error marca la canción y salta', async () => {
    const { b, voz } = await setup();
    await musica(b, voz, { accion: 'agregar', url: yt('EEEEEEEEEE1') });
    await musica(b, voz, { accion: 'agregar', url: yt('EEEEEEEEEE2') });
    const [c1, c2] = await canciones(b, voz);
    const r = await musica(b, voz, { accion: 'error', cancionId: c1.id });
    expect(r.reproduccion.actual).toBe(c2.id);
    expect((await canciones(b, voz)).map((c: any) => c.estado)).toEqual(['error', 'sonando']);
  });

  it('quitar una de la cola la borra', async () => {
    const { a, b, voz } = await setup();
    await musica(b, voz, { accion: 'agregar', url: yt('FFFFFFFFFF1') });
    await musica(b, voz, { accion: 'agregar', url: yt('FFFFFFFFFF2') });
    const [c1, c2] = await canciones(b, voz);
    const r = await musica(a, voz, { accion: 'quitar', cancionId: c2.id });
    expect(r.reproduccion.actual).toBe(c1.id);
    expect((await canciones(b, voz)).map((c: any) => c.id)).toEqual([c1.id]);
  });

  it('la última que termina deja actual vacío', async () => {
    const { b, voz } = await setup();
    await musica(b, voz, { accion: 'agregar', url: yt('GGGGGGGGGG1') });
    const [c1] = await canciones(b, voz);
    const r = await musica(b, voz, { accion: 'termino', cancionId: c1.id });
    expect(r.reproduccion.actual).toBe('');
    // la siguiente que se agrega arranca sola
    const r2 = await musica(b, voz, { accion: 'agregar', url: yt('GGGGGGGGGG2') });
    expect(r2.reproduccion.actual).not.toBe('');
  });

  it('alguien de afuera recibe 403', async () => {
    const { c, voz } = await setup();
    await expect(musica(c, voz, { accion: 'agregar', url: yt('HHHHHHHHHHH') })).rejects.toMatchObject({ status: 403 });
    await expect(c.collection('canciones').getFullList()).resolves.toHaveLength(0);
  });

  it('en una sala de chat da 400', async () => {
    const { b, chat } = await setup();
    await expect(musica(b, chat, { accion: 'agregar', url: yt('IIIIIIIIIII') })).rejects.toMatchObject({ status: 400 });
  });

  it('los clientes no escriben las colecciones directo', async () => {
    const { b, voz } = await setup();
    await expect(b.collection('canciones').create({ room: voz, videoId: 'JJJJJJJJJJJ', titulo: 'x', estado: 'sonando' }))
      .rejects.toMatchObject({ status: 403 });
  });
});
