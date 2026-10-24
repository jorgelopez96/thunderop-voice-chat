import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import PocketBase from 'pocketbase';
import { EventSource } from 'eventsource';
import { startPocketBase, type Harness } from './harness';

let h: Harness;
beforeAll(async () => { h = await startPocketBase(); });
afterAll(async () => { await h.stop(); });

describe('esquema de cuentas', () => {
  it('esquema: usuario único, identidad por usuario o mail, nombre repetible', async () => {
    const pass = randomBytes(8).toString('hex');
    const sufijo = randomBytes(3).toString('hex');
    const crear = (username: string, email: string) => h.admin.collection('users').create({
      email, username, password: pass, passwordConfirm: pass, name: 'Repetido', verified: true,
    });
    const mail = `jorgel-${sufijo}@test.local`;
    await crear('jorgel', mail);
    await crear(`otro${sufijo}`, `otro-${sufijo}@test.local`);
    await expect(crear('jorgel', `tercero-${sufijo}@test.local`)).rejects.toMatchObject({ status: 400 });

    const a = new PocketBase(h.url);
    const b = new PocketBase(h.url);
    const porUsuario = await a.collection('users').authWithPassword('jorgel', pass);
    const porMail = await b.collection('users').authWithPassword(mail, pass);
    expect(porUsuario.record.id).toBe(porMail.record.id);

    const id = porUsuario.record.id;
    await expect(a.collection('users').update(id, { username: 'otro' })).rejects.toMatchObject({ status: expect.any(Number) });
    // los campos ocultos los ignora el servidor en silencio: no rechaza, pero no se guardan
    await a.collection('users').update(id, { invitado: true }).catch(() => {});
    expect((await h.admin.collection('users').getOne(id)).invitado).toBe(false);
    expect((await h.admin.collection('users').getOne(id)).username).toBe('jorgel');

    const lista = await a.collection('codigos').getList(1, 10).catch((e) => e);
    expect(lista.status === 403 || lista.items?.length === 0).toBe(true);
  });
});

describe('registro público', () => {
  const pass = 'Abcdef1!';
  const sufijo = randomBytes(3).toString('hex');
  let n = 0;
  const hoyUtc = (anios: number, dias = 0) => {
    const d = new Date();
    return new Date(Date.UTC(d.getUTCFullYear() - anios, d.getUTCMonth(), d.getUTCDate() + dias)).toISOString().slice(0, 10);
  };
  const registrar = (extra: Record<string, unknown> = {}) => {
    const k = `${sufijo}${n++}`;
    return new PocketBase(h.url).collection('users').create({
      email: `reg-${k}@test.local`, username: `reg${k}`, password: pass, passwordConfirm: pass,
      name: 'Nuevo', nacimiento: '2000-01-01', terminos: 1, ...extra,
    });
  };
  const error = (p: Promise<unknown>) => p.then(() => null, (e) => e);
  const mensaje = (e: any) => e?.response?.message ?? JSON.stringify(e?.response);

  it('registro válido queda sin confirmar ni invitado', async () => {
    const r = await registrar();
    expect(r.verified).toBe(false);
    const g = await h.admin.collection('users').getOne(r.id);
    expect([g.invitado, g.perfilCompleto, g.terminos]).toEqual([false, true, 1]);
    expect(g.terminosFecha).toBeTruthy();
    expect(g.nacimiento).toContain('2000-01-01');
  });

  it('usuario se normaliza', async () => {
    const k = `${sufijo}norm`;
    const r = await registrar({ username: ` Jorgel${k} ` });
    expect(r.username).toBe(`jorgel${k}`);
  });

  it('usuario inválido', async () => {
    for (const username of ['ab', 'con espacio', 'acentó', 'a'.repeat(21)]) {
      const e = await error(registrar({ username }));
      expect(e?.status).toBe(400);
      expect(mensaje(e)).toBe('El usuario tiene que tener de 3 a 20 caracteres: letras sin acentos, números, punto o guion bajo.');
    }
  });

  it('contraseña débil', async () => {
    for (const password of ['abcdefgh', 'Abcdefg1', 'abcdefg1!', 'Abc1!']) {
      const e = await error(registrar({ password, passwordConfirm: password }));
      expect(e?.status).toBe(400);
      expect(mensaje(e)).toBe('La contraseña necesita 8 caracteres, una mayúscula, un número y un carácter especial.');
    }
  });

  it('edad mínima', async () => {
    await registrar({ nacimiento: hoyUtc(13) });
    const e = await error(registrar({ nacimiento: hoyUtc(13, 1) }));
    expect(e?.status).toBe(400);
    expect(mensaje(e)).toBe('Tenés que tener al menos 13 años para usar Thunderop.');
    for (const nacimiento of ['2999-01-01', '2000-02-30']) {
      const f = await error(registrar({ nacimiento }));
      expect(f?.status).toBe(400);
      expect(mensaje(f)).toBe('La fecha de nacimiento no es válida.');
    }
  });

  it('sin aceptar términos', async () => {
    for (const terminos of [0, 2]) {
      const e = await error(registrar({ terminos }));
      expect(e?.status).toBe(400);
      expect(mensaje(e)).toBe('Tenés que aceptar los términos y la política de privacidad.');
    }
  });

  it('terminos ausente, nulo o de otro tipo', async () => {
    const sin = await error(registrar({ terminos: undefined }));
    expect(sin?.status).toBe(400);
    for (const terminos of [null, '', false, true, '1', [1]]) {
      const e = await error(registrar({ terminos }));
      expect(e?.status).toBe(400);
      expect(mensaje(e)).toBe('Tenés que aceptar los términos y la política de privacidad.');
    }
  });

  it('servidor sin TERMINOS_VERSION no deja registrar', async () => {
    const h2 = await startPocketBase({ env: { TERMINOS_VERSION: '' } });
    try {
      const k = `${sufijo}sv`;
      const e = await error(new PocketBase(h2.url).collection('users').create({
        email: `sv-${k}@test.local`, username: `sv${k}`, password: pass, passwordConfirm: pass,
        name: 'Nuevo', nacimiento: '2000-01-01', terminos: 0,
      }));
      expect(e?.status).toBe(400);
      expect(mensaje(e)).toBe('Tenés que aceptar los términos y la política de privacidad.');
    } finally { await h2.stop(); }
  });

  it('no se puede auto-invitar', async () => {
    const r = await registrar({ invitado: true, verified: true, perfilCompleto: false });
    const g = await h.admin.collection('users').getOne(r.id);
    expect([g.invitado, g.verified, g.perfilCompleto]).toEqual([false, false, true]);
  });

  it('mail con mayúsculas', async () => {
    const k = `${sufijo}mail`;
    await registrar({ email: `Ana${k}@Test.Local`, username: `ana${k}` });
    const a = await new PocketBase(h.url).collection('users').authWithPassword(`ana${k}@test.local`, pass);
    expect(a.record.username).toBe(`ana${k}`);
  });
});

describe('códigos por mail', () => {
  const pass = 'Abcdef1!';
  const sufijo = randomBytes(3).toString('hex');
  let n = 0;
  const sha = (c: string) => createHash('sha256').update(c).digest('hex');
  const pb = () => new PocketBase(h.url);
  const post = (ruta: string, body: Record<string, unknown>) => pb().send(`/api/cuenta/${ruta}`, { method: 'POST', body });
  const error = (p: Promise<unknown>) => p.then(() => null, (e) => e);
  async function nueva() {
    const k = `${sufijo}c${n++}`;
    const email = `cod-${k}@test.local`;
    const u = await pb().collection('users').create({
      email, username: `cod${k}`, password: pass, passwordConfirm: pass,
      name: 'Nuevo', nacimiento: '2000-01-01', terminos: 1,
    });
    return { id: u.id, email };
  }
  const codigos = (id: string) => h.admin.collection('codigos').getFullList({ filter: `user = "${id}"` });
  async function fijar(id: string, tipo: string, codigo = '123456') {
    await post('codigo', { email: (await h.admin.collection('users').getOne(id)).email, tipo });
    const [c] = await codigos(id);
    await h.admin.collection('codigos').update(c.id, { hash: sha(codigo) });
    return c.id;
  }

  it('confirmar con código', async () => {
    const u = await nueva();
    await fijar(u.id, 'verificar');
    await post('verificar', { email: u.email, codigo: '123456' });
    expect((await h.admin.collection('users').getOne(u.id)).verified).toBe(true);
    expect(await codigos(u.id)).toHaveLength(0);
  });

  it('código mal 5 veces lo invalida', async () => {
    const u = await nueva();
    await fijar(u.id, 'verificar');
    for (let i = 0; i < 5; i++) expect((await error(post('verificar', { email: u.email, codigo: '000000' })))?.status).toBe(400);
    const e = await error(post('verificar', { email: u.email, codigo: '123456' }));
    expect(e?.status).toBe(400);
    expect(e.response.message).toBe('El código no es válido o venció.');
    expect((await h.admin.collection('users').getOne(u.id)).verified).toBe(false);
  });

  it('código vencido', async () => {
    const u = await nueva();
    const id = await fijar(u.id, 'verificar');
    await h.admin.collection('codigos').update(id, { expira: '2020-01-01 00:00:00.000Z' });
    expect((await error(post('verificar', { email: u.email, codigo: '123456' })))?.status).toBe(400);
    expect((await h.admin.collection('users').getOne(u.id)).verified).toBe(false);
  });

  it('pedir otro invalida el anterior', async () => {
    const u = await nueva();
    await post('codigo', { email: u.email, tipo: 'verificar' });
    await post('codigo', { email: u.email, tipo: 'verificar' });
    expect(await codigos(u.id)).toHaveLength(1);
  });

  it('mail inexistente responde igual', async () => {
    const antes = (await h.admin.collection('codigos').getFullList()).length;
    const r = await post('codigo', { email: `nadie-${sufijo}@test.local`, tipo: 'restablecer' });
    expect(r).toEqual({});
    expect((await h.admin.collection('codigos').getFullList()).length).toBe(antes);
  });

  it('restablecer contraseña', async () => {
    const u = await nueva();
    await fijar(u.id, 'restablecer');
    const debil = await error(post('restablecer', { email: u.email, codigo: '123456', password: 'abc' }));
    expect(debil?.status).toBe(400);
    const nueva1 = 'Nueva123!';
    await post('restablecer', { email: u.email, codigo: '123456', password: nueva1 });
    await pb().collection('users').authWithPassword(u.email, nueva1);
    expect((await error(pb().collection('users').authWithPassword(u.email, pass)))?.status).toBe(400);
    expect((await h.admin.collection('users').getOne(u.id)).verified).toBe(true);
  });

  it('20 intentos en paralelo no pasan el límite', async () => {
    const u = await nueva();
    await fijar(u.id, 'verificar');
    const rs = await Promise.all(Array.from({ length: 20 }, () => error(post('verificar', { email: u.email, codigo: '000000' }))));
    expect(rs.every((e) => e?.status === 400)).toBe(true);
    expect((await error(post('verificar', { email: u.email, codigo: '123456' })))?.status).toBe(400);
    expect((await h.admin.collection('users').getOne(u.id)).verified).toBe(false);
  });

  it('el código de un tipo no sirve para el otro', async () => {
    const u = await nueva();
    await fijar(u.id, 'verificar');
    expect((await error(post('restablecer', { email: u.email, codigo: '123456', password: 'Nueva123!' })))?.status).toBe(400);
    const v = await nueva();
    await h.admin.collection('users').update(v.id, { verified: true });
    await fijar(v.id, 'restablecer');
    expect((await error(post('verificar', { email: v.email, codigo: '123456' })))?.status).toBe(400);
  });

  it('restablecer con código equivocado', async () => {
    const u = await nueva();
    await fijar(u.id, 'restablecer');
    expect((await error(post('restablecer', { email: u.email, codigo: '000000', password: 'Nueva123!' })))?.status).toBe(400);
    await pb().collection('users').authWithPassword(u.email, pass);
  });

  it('el código anterior deja de servir al pedir otro', async () => {
    const u = await nueva();
    await fijar(u.id, 'verificar');
    await post('codigo', { email: u.email, tipo: 'verificar' });
    expect((await error(post('verificar', { email: u.email, codigo: '123456' })))?.status).toBe(400);
  });

  it('tope de 5 códigos por hora', async () => {
    const u = await nueva();
    for (let i = 0; i < 5; i++) {
      await post('codigo', { email: u.email, tipo: 'verificar' });
      const [c] = await codigos(u.id);
      await h.admin.collection('codigos').update(c.id, { hash: sha(`11111${i}`) });
    }
    expect(await post('codigo', { email: u.email, tipo: 'verificar' })).toEqual({});
    const cs = await codigos(u.id);
    expect(cs).toHaveLength(1);
    expect(cs[0].hash).toBe(sha('111114'));
    // los 5 intentos agotados no reinician la cuenta
    for (let i = 0; i < 5; i++) await error(post('verificar', { email: u.email, codigo: '000000' }));
    await post('codigo', { email: u.email, tipo: 'verificar' });
    expect((await codigos(u.id))[0].hash).toBe('');
    await post('verificar', { email: u.email, codigo: '111114' }).then(() => { throw new Error('no debía servir'); }, () => {});
    await h.admin.collection('codigos').update(cs[0].id, { ventana: '2020-01-01 00:00:00.000Z' });
    await post('codigo', { email: u.email, tipo: 'verificar' });
    const [nuevo] = await codigos(u.id);
    expect(nuevo.hash).not.toBe('');
    expect(nuevo.emitidos).toBe(1);
  });
});

describe('cuenta completa', () => {
  const error = (p: Promise<unknown>) => p.then(() => null, (e) => e);
  const estado = (pb: PocketBase) => pb.send('/api/cuenta/estado', {});
  const post = (pb: PocketBase, ruta: string, body: Record<string, unknown>) => pb.send(ruta, { method: 'POST', body });
  const sufijo = randomBytes(3).toString('hex');

  it('incompleta no puede usar nada', async () => {
    (globalThis as any).EventSource = EventSource;
    const dueno = await h.nuevoUsuario('dueno');
    const g = await dueno.collection('groups').create({ name: 'g' });
    const voz = (await dueno.collection('rooms').getFullList({ filter: `group = "${g.id}"` })).find((s) => s.kind === 'voz')!.id;
    const pb = await h.nuevoUsuario('x', { incompleta: true });
    const yo = pb.authStore.record!.id;

    const lista = await error(pb.collection('groups').getList());
    expect(lista?.status).toBe(403);
    expect(lista.response).toEqual({ message: 'Tu cuenta no está completa.', falta: ['verificar', 'invitacion'] });
    const bloqueadas = [
      () => pb.send(`/api/rooms/${voz}/token`, { method: 'POST' }),
      () => pb.send('/api/amigos/solicitar', { method: 'POST', body: { username: 'nadie' } }),
      () => pb.send('/api/files/token', { method: 'POST' }),
      () => pb.send('/api/batch', { method: 'POST', body: { requests: [{ method: 'GET', url: '/api/collections/groups/records' }] } }),
      () => pb.collection('users').getOne(dueno.authStore.record!.id),
      () => pb.collection('users').update(yo, { name: 'otro' }),
      () => pb.collection('_pb_users_auth_').getList(),
      () => pb.collection('users').getOne(yo, { expand: 'groups_via_members' }),
      () => pb.collection('users').authRefresh({ expand: 'groups_via_members' }),
    ];
    for (const p of bloqueadas) expect((await error(p()))?.status).toBe(403);
    await expect(pb.collection('groups').subscribe('*', () => {})).rejects.toMatchObject({ status: 403 });
    pb.realtime.unsubscribe();

    expect((await pb.collection('users').getOne(yo)).id).toBe(yo);
    expect((await pb.collection('_pb_users_auth_').getOne(yo)).id).toBe(yo);
    await pb.collection('users').authRefresh();
    await pb.collection('users').listAuthMethods();
    expect(await estado(pb)).toEqual({
      verificado: false, invitado: false, terminos: 1, terminosVigente: 1, perfilCompleto: true, menor: false,
      username: pb.authStore.record!.username, falta: ['verificar', 'invitacion'],
    });
    expect(await new PocketBase(h.url).send('/api/cuenta/terminos', {})).toEqual({ version: 1 });
    expect((await error(new PocketBase(h.url).send('/api/cuenta/estado', {})))?.status).toBe(401);
  });

  it('invitación', async () => {
    const pb = await h.nuevoUsuario('inv', { incompleta: true });
    const mal = await error(post(pb, '/api/cuenta/invitacion', { codigo: 'MAL' }));
    expect(mal?.status).toBe(400);
    expect(mal.response.message).toBe('El código de invitación no es válido.');
    expect((await error(post(pb, '/api/cuenta/invitacion', {})))?.status).toBe(400);
    await post(pb, '/api/cuenta/invitacion', { codigo: ' prueba26 ' });
    expect((await h.admin.collection('users').getOne(pb.authStore.record!.id)).invitado).toBe(true);
    expect((await estado(pb)).falta).toEqual(['verificar']);
  });

  it('completar perfil', async () => {
    const pass = 'Abcdef1!';
    const crear = async (k: string) => {
      const email = `comp-${sufijo}${k}@test.local`;
      await h.admin.collection('users').create({
        email, username: `tmp${sufijo}${k}`, password: pass, passwordConfirm: pass, name: 'Oauth', verified: true, invitado: true,
      });
      const pb = new PocketBase(h.url);
      await pb.collection('users').authWithPassword(email, pass);
      return pb;
    };
    const pb = await crear('a');
    expect((await estado(pb)).falta).toEqual(['terminos', 'perfil']);
    expect((await error(pb.collection('groups').getList()))?.status).toBe(403);

    const nacimiento = new Date(Date.UTC(new Date().getUTCFullYear() - 15, 0, 1)).toISOString().slice(0, 10);
    for (const datos of [
      { username: 'ab', nacimiento, terminos: 1 },
      { username: `ok${sufijo}`, nacimiento: '2999-01-01', terminos: 1 },
      { username: `ok${sufijo}`, nacimiento, terminos: '1' },
    ]) expect((await error(post(pb, '/api/cuenta/completar', datos)))?.status).toBe(400);

    await post(pb, '/api/cuenta/completar', { username: ` Comp${sufijo} `, nacimiento, terminos: 1 });
    const est = await estado(pb);
    expect(est).toMatchObject({ perfilCompleto: true, terminos: 1, menor: true, username: `comp${sufijo}`, falta: [] });
    const g = await h.admin.collection('users').getOne(pb.authStore.record!.id);
    expect(g.nacimiento).toContain(nacimiento);
    expect(g.terminosFecha).toBeTruthy();
    await pb.collection('groups').getList();

    const otra = await error(post(pb, '/api/cuenta/completar', { username: `otro${sufijo}`, nacimiento, terminos: 1 }));
    expect(otra?.status).toBe(400);
    expect(otra.response.message).toBe('Tu perfil ya está completo.');

    const pb2 = await crear('b');
    const tomado = await error(post(pb2, '/api/cuenta/completar', { username: `COMP${sufijo}`, nacimiento, terminos: 1 }));
    expect(tomado?.status).toBe(400);
    expect(tomado.response.data?.username?.code).toBe('validation_not_unique');
    expect((await h.admin.collection('users').getOne(pb2.authStore.record!.id)).perfilCompleto).toBe(false);
  });

  it('términos nuevos', async () => {
    const h2 = await startPocketBase({ env: { TERMINOS_VERSION: '2' } });
    try {
      const pb = await h2.nuevoUsuario('ter');
      const e = await error(pb.collection('groups').getList());
      expect(e?.status).toBe(403);
      expect(e.response.falta).toEqual(['terminos']);
      expect(await new PocketBase(h2.url).send('/api/cuenta/terminos', {})).toEqual({ version: 2 });
      for (const version of [1, '2', 3]) expect((await error(post(pb, '/api/cuenta/terminos', { version })))?.status).toBe(400);
      await post(pb, '/api/cuenta/terminos', { version: 2 });
      expect(await estado(pb)).toMatchObject({ terminos: 2, terminosVigente: 2, falta: [] });
      await pb.collection('groups').getList();
    } finally { await h2.stop(); }
  });

  it('descarga', async () => {
    const validar = (pb: PocketBase, body: Record<string, unknown>) => post(pb, '/api/descarga/validar', body);
    const anon = new PocketBase(h.url);
    expect((await error(validar(anon, {})))?.status).toBe(401);
    expect((await error(validar(anon, { codigo: 'OTRO' })))?.status).toBe(401);
    const link = { url: `${(await h.admin.settings.getAll()).meta.appURL.replace(/\/+$/, '')}/descargas/thunderop-setup.exe` };
    expect(await validar(anon, { codigo: 'PRUEBA26' })).toEqual(link);
    expect(await validar(await h.nuevoUsuario('desc'), {})).toEqual(link);
    expect((await error(validar(await h.nuevoUsuario('desc', { incompleta: true }), {})))?.status).toBe(401);
  });
});

describe('Google/Microsoft, configuración y limpieza', () => {
  const error = (p: Promise<unknown>) => p.then(() => null, (e) => e);

  it('cuenta nueva por Google/Microsoft arranca incompleta y con usuario al azar', () => {
    const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../pb_hooks/reglas.js'), 'utf8');
    const mod = { exports: {} as any };
    const security = { randomStringWithAlphabet: (n: number, abc: string) => abc.slice(0, n) };
    new Function('module', '$security', '$os', src)(mod, security, { getenv: () => '' });
    const { datosOAuth } = mod.exports;
    expect(datosOAuth('Jorge López', 'jorge@gmail.com')).toEqual({
      username: 'uabcdefghijkl', perfilCompleto: false, invitado: false, terminos: 0, name: 'Jorge López',
    });
    expect(datosOAuth('', 'jorge.l@outlook.com').name).toBe('jorge.l');
    expect(datosOAuth(undefined, 'x@y.z').username).toMatch(/^u[a-z0-9]{12}$/);
    expect(datosOAuth('a'.repeat(50), 'x@y.z').name).toBe('a'.repeat(32));
    expect(datosOAuth(' ', `${'b'.repeat(50)}@y.z`).name).toBe('b'.repeat(32));
    const { errorOAuthMail } = mod.exports;
    expect(errorOAuthMail('')).toMatch(/no comparte un mail/);
    expect(errorOAuthMail(undefined)).toMatch(/no comparte un mail/);
    expect(errorOAuthMail('jorge@gmail.com')).toBe('');
  });

  it('confía en la IP que agrega Caddy a la derecha de X-Forwarded-For', async () => {
    expect((await h.admin.settings.getAll()).trustedProxy).toEqual({ headers: ['X-Forwarded-For'], useLeftmostIP: false });
  });

  it('config desde el entorno', async () => {
    const h2 = await startPocketBase({ env: { GOOGLE_ID: 'g', GOOGLE_SECRET: 's', MICROSOFT_ID: 'm', MICROSOFT_SECRET: 't', APP_URL: 'https://ejemplo.test' } });
    try {
      const users = await h2.admin.collections.getOne('users');
      expect(users.oauth2.enabled).toBe(true);
      expect(users.oauth2.providers.find((p: any) => p.name === 'google')).toMatchObject({ clientId: 'g' });
      expect(users.oauth2.providers.find((p: any) => p.name === 'microsoft')).toMatchObject({
        clientId: 'm',
        authURL: 'https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize',
        tokenURL: 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token',
      });
      const s = await h2.admin.settings.getAll();
      expect(s.meta).toMatchObject({ appURL: 'https://ejemplo.test', appName: 'Thunderop', senderName: 'Thunderop' });
      expect(await new PocketBase(h2.url).send('/api/descarga/validar', { method: 'POST', body: { codigo: 'PRUEBA26' } }))
        .toEqual({ url: 'https://ejemplo.test/descargas/thunderop-setup.exe' });
    } finally { await h2.stop(); }
  });

  it('limpieza de sin confirmar', async () => {
    const h2 = await startPocketBase({ env: { CUENTAS_SIN_CONFIRMAR_HORAS: '0' } });
    try {
      const sin = (await h2.nuevoUsuario('sin', { incompleta: true })).authStore.record!;
      const con = (await h2.nuevoUsuario('con')).authStore.record!;
      await new PocketBase(h2.url).send('/api/cuenta/codigo', { method: 'POST', body: { email: con.email, tipo: 'restablecer' } });
      await h2.admin.send('/api/crons/cuentas-sin-confirmar', { method: 'POST' });
      for (let i = 0; i < 50 && !(await error(h2.admin.collection('users').getOne(sin.id))); i++) await new Promise((r) => setTimeout(r, 100));
      expect((await error(h2.admin.collection('users').getOne(sin.id)))?.status).toBe(404);
      await h2.admin.collection('users').getOne(con.id);
      // la fila del código guarda el tope de emisiones: la limpieza no la toca
      expect(await h2.admin.collection('codigos').getFullList({ filter: `user = "${con.id}"` })).toHaveLength(1);
    } finally { await h2.stop(); }
  });

  it('las rutas de mail propias de PocketBase no responden', async () => {
    const pb = await h.nuevoUsuario('pbmail');
    const sinConfirmar = (await h.nuevoUsuario('pbmail2', { incompleta: true })).authStore.record!;
    const yo = pb.authStore.record!;
    const anon = new PocketBase(h.url);
    const users = anon.collection('users');
    const intentos = [
      () => users.requestPasswordReset(yo.email),
      () => users.requestVerification(sinConfirmar.email),
      () => users.confirmPasswordReset('x', 'Abcdef1!', 'Abcdef1!'),
      () => users.confirmVerification('x'),
      () => users.requestOTP(yo.email),
      () => users.authWithOTP('x', '123456'),
      () => anon.collection('_pb_users_auth_').requestPasswordReset(yo.email),
      () => pb.collection('users').requestEmailChange('otro@test.local'),
      () => pb.collection('users').confirmEmailChange('x', 'x'),
    ];
    for (const p of intentos) expect((await error(p()))?.status).toBe(404);
    for (const id of [yo.id, sinConfirmar.id]) {
      expect(await h.admin.collection('codigos').getFullList({ filter: `user = "${id}"` })).toHaveLength(0);
    }
    // un superusuario las sigue teniendo (a una cuenta ya confirmada no le manda nada)
    await h.admin.collection('users').requestVerification(yo.email);
  });

  it('mail único sin distinguir mayúsculas y sin aviso de inicio nuevo', async () => {
    const k = randomBytes(3).toString('hex');
    const pass = 'Abcdef1!';
    const datos = (email: string, username: string) => ({
      email, username, password: pass, passwordConfirm: pass, name: 'Ana', nacimiento: '2000-01-01', terminos: 1,
    });
    const u = await new PocketBase(h.url).collection('users').create(datos(`ana${k}@x.test`, `ana${k}`));
    const pub = await error(new PocketBase(h.url).collection('users').create(datos(`ANA${k}@x.test`, `ana2${k}`)));
    expect(pub?.status).toBe(400);
    const adm = await error(h.admin.collection('users').create({ ...datos(`Ana${k}@X.test`, `ana3${k}`), verified: true }));
    expect(adm?.status).toBe(400);
    expect(adm.response.data?.email?.code).toBe('validation_not_unique');
    // el mail guardado con otras mayúsculas (como podría quedar desde Google/Microsoft) se sigue encontrando
    await h.admin.collection('users').update(u.id, { email: `AnA${k}@x.TEST` });
    await new PocketBase(h.url).send('/api/cuenta/codigo', { method: 'POST', body: { email: `ana${k}@x.test`, tipo: 'verificar' } });
    expect(await h.admin.collection('codigos').getFullList({ filter: `user = "${u.id}"` })).toHaveLength(1);
    expect((await h.admin.collections.getOne('users')).authAlert.enabled).toBe(false);
  });

  it('SMTP_PORT inválido no rompe el arranque', async () => {
    const h2 = await startPocketBase({ env: { SMTP_HOST: 'smtp.test', SMTP_PORT: 'abc', SMTP_USER: 'u', SMTP_PASS: 'p', APP_URL: 'https://ejemplo.test' } });
    try {
      const s = await h2.admin.settings.getAll();
      expect(s.smtp.enabled).toBe(false);
      expect(s.meta.appURL).toBe('https://ejemplo.test');
    } finally { await h2.stop(); }
    const h3 = await startPocketBase({ env: { SMTP_HOST: 'smtp.test', SMTP_PORT: '465', SMTP_USER: 'u', SMTP_PASS: 'p' } });
    try {
      expect((await h3.admin.settings.getAll()).smtp).toMatchObject({ enabled: true, host: 'smtp.test', port: 465, tls: true });
    } finally { await h3.stop(); }
  });

  it('cambiar la contraseña con PATCH pide la misma fuerza', async () => {
    const pass = 'Abcdef1!';
    const k = randomBytes(3).toString('hex');
    const email = `clave-${k}@test.local`;
    await h.admin.collection('users').create({
      email, username: `clave${k}`, password: pass, passwordConfirm: pass, name: 'Clave', verified: true, invitado: true,
      terminos: 1, perfilCompleto: true, nacimiento: '1996-01-01',
    });
    const pb = new PocketBase(h.url);
    await pb.collection('users').authWithPassword(email, pass);
    const id = pb.authStore.record!.id;
    const e = await error(pb.collection('users').update(id, { oldPassword: pass, password: 'debilita', passwordConfirm: 'debilita' }));
    expect(e?.status).toBe(400);
    expect(e?.response?.message).toMatch(/8 caracteres/);
    await pb.collection('users').update(id, { oldPassword: pass, password: 'Otra-123', passwordConfirm: 'Otra-123' });
    await new PocketBase(h.url).collection('users').authWithPassword(email, 'Otra-123');
  });

  it('completar dos veces a la vez: gana una sola', async () => {
    const pass = 'Abcdef1!';
    const k = randomBytes(3).toString('hex');
    const email = `par-${k}@test.local`;
    await h.admin.collection('users').create({
      email, username: `tmp${k}`, password: pass, passwordConfirm: pass, name: 'Oauth', verified: true, invitado: true,
    });
    const pb = new PocketBase(h.url);
    pb.autoCancellation(false);
    await pb.collection('users').authWithPassword(email, pass);
    const nombres = [`pa${k}`, `pb${k}`];
    const rs = await Promise.allSettled(nombres.map((username) => pb.send('/api/cuenta/completar', {
      method: 'POST', body: { username, nacimiento: '2000-01-01', terminos: 1 },
    })));
    const ok = rs.map((r) => r.status === 'fulfilled');
    expect(ok.filter(Boolean)).toHaveLength(1);
    expect((await h.admin.collection('users').getOne(pb.authStore.record!.id)).username).toBe(nombres[ok.indexOf(true)]);
  });
});

describe('desactivar la cuenta', () => {
  it('cierra las sesiones, no recibe solicitudes y se reactiva al entrar', async () => {
    const a = await h.nuevoUsuario('ana');
    const b = await h.nuevoUsuario('beto');
    const yo = a.authStore.record!;
    await expect(a.collection('users').update(yo.id, { desactivada: true })).rejects.toMatchObject({ status: 404 });
    await a.send('/api/cuenta/desactivar', { method: 'POST' });
    await expect(a.collection('users').authRefresh()).rejects.toMatchObject({ status: 401 });
    expect((await h.admin.collection('users').getOne(yo.id)).desactivada).toBe(true);
    await expect(b.send('/api/amigos/solicitar', { method: 'POST', body: { username: yo.username } })).rejects.toMatchObject({ status: 400 });
    const pass = randomBytes(8).toString('hex');
    await h.admin.collection('users').update(yo.id, { password: pass, passwordConfirm: pass });
    await a.collection('users').authWithPassword(yo.email, pass);
    expect((await h.admin.collection('users').getOne(yo.id)).desactivada).toBe(false);
  });
});
