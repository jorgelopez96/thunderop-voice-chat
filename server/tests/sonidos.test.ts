import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startPocketBase, type Harness } from './harness';

let h: Harness;
beforeAll(async () => { h = await startPocketBase(); });
afterAll(async () => { await h.stop(); });

const unirse = (pb: any, code: string) => pb.send('/api/invites/join', { method: 'POST', body: { code } });
const uid = (pb: any) => pb.authStore.record.id as string;

// WAV mínimo válido (PocketBase detecta el MIME por contenido); `extra` agrega bytes de datos.
const wav = (extra = 0) => {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + extra, 4); h.write('WAVEfmt ', 8);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(8000, 24); h.writeUInt32LE(8000, 28); h.writeUInt16LE(1, 32); h.writeUInt16LE(8, 34);
  h.write('data', 36); h.writeUInt32LE(extra, 40);
  return Buffer.concat([h, Buffer.alloc(extra)]);
};
const fd = (group: string, owner: string, buf = wav(100), name = 'pum', tipo = 'audio/wav') => {
  const d = new FormData();
  d.append('group', group); d.append('owner', owner); d.append('name', name);
  d.append('file', new File([buf], 'x.wav', { type: tipo }));
  return d;
};

async function setup() {
  const a = await h.nuevoUsuario('ana');
  const b = await h.nuevoUsuario('beto');
  const c = await h.nuevoUsuario('carla');
  const g = await a.collection('groups').create({ name: 'g' });
  const inv = await a.collection('invites').create({ group: g.id });
  await unirse(b, inv.code);
  return { a, b, c, g };
}

describe('sonidos', () => {
  it('un miembro sube un sonido', async () => {
    const { b, g } = await setup();
    const s = await b.collection('sonidos').create(fd(g.id, uid(b)));
    expect(s.name).toBe('pum');
    expect((await fetch(b.files.getURL(s, s.file))).status).toBe(200);
  });

  it('la botonera los lista en el orden en que se subieron (@rowid: la colección no tiene "created")', async () => {
    const { b, g } = await setup();
    for (const n of ['zeta', 'alfa', 'medio']) await b.collection('sonidos').create(fd(g.id, uid(b), wav(100), n));
    const lista = await b.collection('sonidos').getFullList({ filter: `group = "${g.id}"`, sort: '@rowid' });
    expect(lista.map((x: { name: string }) => x.name)).toEqual(['zeta', 'alfa', 'medio']);
  });

  it('alguien de afuera no puede subir ni ver', async () => {
    const { b, c, g } = await setup();
    const s = await b.collection('sonidos').create(fd(g.id, uid(b)));
    await expect(c.collection('sonidos').create(fd(g.id, uid(c)))).rejects.toMatchObject({ status: 400 });
    await expect(c.collection('sonidos').getOne(s.id)).rejects.toMatchObject({ status: 404 });
    expect(await c.collection('sonidos').getFullList()).toHaveLength(0);
  });

  it('archivo de más de 1 MB se rechaza', async () => {
    const { b, g } = await setup();
    await expect(b.collection('sonidos').create(fd(g.id, uid(b), wav(1024 * 1024 + 10)))).rejects.toMatchObject({ status: 400 });
  });

  it('un archivo que no es audio se rechaza', async () => {
    const { b, g } = await setup();
    await expect(b.collection('sonidos').create(fd(g.id, uid(b), Buffer.from('%PDF-1.4 hola'), 'pum', 'application/pdf'))).rejects.toMatchObject({ status: 400 });
  });

  it('otro miembro no puede borrar un sonido ajeno', async () => {
    const { a, b, g } = await setup();
    const s = await a.collection('sonidos').create(fd(g.id, uid(a)));
    await expect(b.collection('sonidos').delete(s.id)).rejects.toMatchObject({ status: 404 });
  });

  it('el dueño del grupo puede borrar cualquiera', async () => {
    const { a, b, g } = await setup();
    const s = await b.collection('sonidos').create(fd(g.id, uid(b)));
    await a.collection('sonidos').delete(s.id);
  });

  it('tope de 50 por grupo', async () => {
    const { a, g } = await setup();
    for (let i = 0; i < 50; i++) await a.collection('sonidos').create(fd(g.id, uid(a), wav(10), `s${i}`));
    await expect(a.collection('sonidos').create(fd(g.id, uid(a)))).rejects.toMatchObject({
      status: 400, response: { message: 'El grupo ya tiene 50 sonidos.' },
    });
  }, 60000);
});
