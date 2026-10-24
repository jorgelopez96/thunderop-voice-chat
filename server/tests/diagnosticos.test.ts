import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startPocketBase, type Harness } from './harness';

let h: Harness;
beforeAll(async () => { h = await startPocketBase(); });
afterAll(async () => { await h.stop(); });

const error = (p: Promise<unknown>) => p.then(() => null, (e) => e);
const datos = (user: string, extra = {}) => ({ user, version: '0.6.0', codigo: 4, contenido: 'placa: X', ...extra });

describe('diagnosticos', () => {
  it('el usuario crea el suyo', async () => {
    const pb = await h.nuevoUsuario('diag');
    const r = await pb.collection('diagnosticos').create(datos(pb.authStore.record!.id));
    expect(r.codigo).toBe(4);
  });

  it('no a nombre de otro', async () => {
    const pb = await h.nuevoUsuario('diagA');
    const otro = await h.nuevoUsuario('diagB');
    const e = await error(pb.collection('diagnosticos').create(datos(otro.authStore.record!.id)));
    expect([400, 403]).toContain(e?.status);
  });

  it('no puede leer ni tocar', async () => {
    const pb = await h.nuevoUsuario('diagC');
    const c = pb.collection('diagnosticos');
    const mio = await c.create(datos(pb.authStore.record!.id));
    const lista = await c.getList().then((l) => l.items.length === 0 ? 403 : 200, (e) => e.status);
    expect(lista).toBe(403);
    expect([403, 404]).toContain((await error(c.getOne(mio.id)))?.status);
    expect([403, 404]).toContain((await error(c.update(mio.id, { codigo: 1 })))?.status);
    expect([403, 404]).toContain((await error(c.delete(mio.id)))?.status);
  });

  it('sin sesión e incompleta', async () => {
    const pb = await h.nuevoUsuario('diagD', { incompleta: true });
    const e = await error(pb.collection('diagnosticos').create(datos(pb.authStore.record!.id)));
    expect(e?.status).toBe(403);
    expect(e?.response.falta).toBeTruthy();
    const anon = new (pb.constructor as typeof import('pocketbase').default)(h.url);
    expect([400, 401, 403]).toContain((await error(anon.collection('diagnosticos').create(datos(pb.authStore.record!.id))))?.status);
  });

  it('tope de tamaño', async () => {
    const pb = await h.nuevoUsuario('diagE');
    const id = pb.authStore.record!.id;
    expect((await error(pb.collection('diagnosticos').create(datos(id, { contenido: 'a'.repeat(65537) }))))?.status).toBe(400);
    await pb.collection('diagnosticos').create(datos(id, { contenido: 'a'.repeat(65536) }));
  });

  it('el admin lo lee', async () => {
    const pb = await h.nuevoUsuario('diagF');
    const r = await pb.collection('diagnosticos').create(datos(pb.authStore.record!.id, { contenido: 'visible-admin' }));
    const v = await h.admin.collection('diagnosticos').getOne(r.id);
    expect(v.contenido).toBe('visible-admin');
    expect(v.created).toBeTruthy();
  });
});

describe('diagnosticos: tope y limpieza', () => {
  it('tope por hora por usuario', async () => {
    const h2 = await startPocketBase({ env: { DIAGNOSTICOS_POR_HORA: '2' } });
    try {
      const a = await h2.nuevoUsuario('topeA');
      const b = await h2.nuevoUsuario('topeB');
      const crear = (pb: typeof a) => pb.collection('diagnosticos').create(datos(pb.authStore.record!.id));
      await crear(a);
      await crear(a);
      expect((await error(crear(a)))?.status).toBe(429);
      await crear(b);
    } finally { await h2.stop(); }
  });

  it('la limpieza borra los viejos', async () => {
    const h2 = await startPocketBase({ env: { DIAGNOSTICOS_DIAS: '0' } });
    try {
      const pb = await h2.nuevoUsuario('limpia');
      const r = await pb.collection('diagnosticos').create(datos(pb.authStore.record!.id));
      await h2.admin.send('/api/crons/diagnosticos-viejos', { method: 'POST' });
      for (let i = 0; i < 50 && !(await error(h2.admin.collection('diagnosticos').getOne(r.id))); i++) await new Promise((x) => setTimeout(x, 100));
      expect((await error(h2.admin.collection('diagnosticos').getOne(r.id)))?.status).toBe(404);
    } finally { await h2.stop(); }
  });
});
