import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EventSource } from 'eventsource';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startPocketBase, type Harness } from './harness';

(globalThis as any).EventSource = EventSource;

let h: Harness;
beforeAll(async () => { h = await startPocketBase(); });
afterAll(async () => { await h.stop(); });

const fx = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const archivo = (nombre: string, tipo: string) => new File([readFileSync(join(fx, nombre))], nombre, { type: tipo });
const unirse = (pb: any, code: string) => pb.send('/api/invites/join', { method: 'POST', body: { code } });

async function setup() {
  const a = await h.nuevoUsuario('ana');
  const b = await h.nuevoUsuario('beto');
  const c = await h.nuevoUsuario('carla');
  const g = await a.collection('groups').create({ name: 'g' });
  const inv = await a.collection('invites').create({ group: g.id });
  await unirse(b, inv.code);
  const salas = await a.collection('rooms').getFullList({ filter: `group = "${g.id}"` });
  const chat = salas.find((s) => s.kind === 'chat')!.id;
  const voz = salas.find((s) => s.kind === 'voz')!.id;
  return { a, b, c, g, chat, voz };
}
const uid = (pb: any) => pb.authStore.record.id as string;
const fd = (room: string, author: string, f: File) => {
  const d = new FormData();
  d.append('room', room); d.append('author', author); d.append('file', f);
  return d;
};

describe('mensajes', () => {
  it('member posts text', async () => {
    const { b, chat } = await setup();
    const m = await b.collection('messages').create({ room: chat, author: uid(b), text: 'hola' });
    expect(m.text).toBe('hola');
  });

  it('rejects empty message', async () => {
    const { b, chat } = await setup();
    await expect(b.collection('messages').create({ room: chat, author: uid(b) })).rejects.toMatchObject({ status: 400 });
  });

  it('voice rooms have their own chat', async () => {
    const { b, voz } = await setup();
    expect((await b.collection('messages').create({ room: voz, author: uid(b), text: 'x' })).room).toBe(voz);
  });

  it('rejects spoofed author', async () => {
    const { a, b, chat } = await setup();
    await expect(b.collection('messages').create({ room: chat, author: uid(a), text: 'x' })).rejects.toMatchObject({ status: 400 });
  });

  it('posts image and video', async () => {
    const { b, chat } = await setup();
    for (const [n, t] of [['img.png', 'image/png'], ['video.mp4', 'video/mp4']]) {
      const rec = await b.collection('messages').create(fd(chat, uid(b), archivo(n, t)));
      expect((await fetch(b.files.getURL(rec, rec.file))).status).toBe(200);
    }
  });

  it('server rejects disallowed or oversized files', async () => {
    const { b, chat } = await setup();
    const grande = new File(
      [Buffer.concat([Buffer.from('000000186674797069736F6D', 'hex'), Buffer.alloc(26 * 1024 * 1024)])],
      'grande.mp4', { type: 'video/mp4' });
    for (const f of [archivo('doc.pdf', 'application/pdf'), archivo('falso.png', 'image/png'), grande]) {
      await expect(b.collection('messages').create(fd(chat, uid(b), f))).rejects.toMatchObject({ status: 400 });
    }
  });

  it('author deletes own, owner deletes any, member cannot delete others', async () => {
    const { a, b, chat } = await setup();
    const mb = await b.collection('messages').create({ room: chat, author: uid(b), text: 'b' });
    const ma = await a.collection('messages').create({ room: chat, author: uid(a), text: 'a' });
    await expect(b.collection('messages').delete(ma.id)).rejects.toMatchObject({ status: 404 });
    await b.collection('messages').delete(mb.id);
    const mb2 = await b.collection('messages').create({ room: chat, author: uid(b), text: 'b2' });
    await a.collection('messages').delete(mb2.id);
    await a.collection('messages').delete(ma.id);
  });

  it('non-member cannot read messages', async () => {
    const { b, c, chat } = await setup();
    await b.collection('messages').create({ room: chat, author: uid(b), text: 'hola' });
    expect((await c.collection('messages').getList()).items).toHaveLength(0);
  });

  it('kicked member stops receiving realtime and loses access', async () => {
    const { a, b, g, chat } = await setup();
    const eventos: unknown[] = [];
    await b.collection('messages').subscribe('*', (e) => eventos.push(e), { filter: `room="${chat}"` });
    await a.collection('messages').create({ room: chat, author: uid(a), text: 'uno' });
    await new Promise((r) => setTimeout(r, 1000));
    expect(eventos).toHaveLength(1);
    await a.collection('groups').update(g.id, { members: [uid(a)] });
    await a.collection('messages').create({ room: chat, author: uid(a), text: 'dos' });
    await new Promise((r) => setTimeout(r, 2000));
    expect(eventos).toHaveLength(1);
    expect((await b.collection('messages').getList()).items).toHaveLength(0);
    await b.collection('messages').unsubscribe();
  });

  it('messages expose created and sort by -created', async () => {
    const { b, chat } = await setup();
    const m1 = await b.collection('messages').create({ room: chat, author: uid(b), text: 'uno' });
    await new Promise((r) => setTimeout(r, 20));
    const m2 = await b.collection('messages').create({ room: chat, author: uid(b), text: 'dos' });
    const l = await b.collection('messages').getList(1, 10, { sort: '-created', filter: `room="${chat}"` });
    expect(l.items.map((m) => m.id)).toEqual([m2.id, m1.id]);
    expect(l.items.every((m) => typeof m.created === 'string' && m.created !== '')).toBe(true);
  });
});
