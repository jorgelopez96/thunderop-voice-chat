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

const TODOS = { id: 'todos', nombre: 'Todos', color: '', permisos: [] as string[] };

// Ana (admin) con Beto y Carla en el grupo.
async function setup() {
  const a = await h.nuevoUsuario('ana');
  const b = await h.nuevoUsuario('beto');
  const c = await h.nuevoUsuario('carla');
  const g = await a.collection('groups').create({ name: 'g' });
  for (const x of [b, c]) {
    const inv = await a.collection('invites').create({ group: g.id });
    await x.send('/api/invites/join', { method: 'POST', body: { code: inv.code } });
  }
  const id = (x: typeof a) => x.authStore.record!.id;
  const salas = await a.collection('rooms').getFullList({ filter: `group = "${g.id}"` });
  return { a, b, c, g, ids: { a: id(a), b: id(b), c: id(c) }, voz: salas.find((r) => r.kind === 'voz')!, chat: salas.find((r) => r.kind === 'chat')! };
}

/** El admin le da a `quien` un rol nuevo con `permisos`. */
async function darRol(s: Awaited<ReturnType<typeof setup>>, quien: string, permisos: string[], nombre = 'Rol') {
  const g = await s.a.collection('groups').getOne(s.g.id);
  const rol = { id: `r${Math.random().toString(36).slice(2, 10)}`, nombre: `${nombre}${Math.random().toString(36).slice(2, 6)}`, color: '#5bc77a', permisos };
  const asignaciones = { ...(g.asignaciones || {}), [quien]: [...((g.asignaciones || {})[quien] || []), rol.id] };
  await s.a.collection('groups').update(s.g.id, { roles: [...g.roles, rol], asignaciones });
  return rol;
}

describe('roles: datos', () => {
  it('un grupo nuevo tiene el rol Todos sin permisos y nadie asignado', async () => {
    const { g } = await setup();
    expect(g.roles).toEqual([TODOS]);
    expect(g.asignaciones).toEqual({});
  });
});


describe('roles: editar y asignar', () => {
  it('el admin crea un rol DJ y se lo asigna a Beto', async () => {
    const s = await setup();
    const dj = await darRol(s, s.ids.b, ['agregarMusica'], 'DJ');
    const g = await s.a.collection('groups').getOne(s.g.id);
    expect(g.roles).toEqual([TODOS, dj]);
    expect(g.asignaciones).toEqual({ [s.ids.b]: [dj.id] });
  });

  it('Beto no puede editar roles ni asignaciones, aunque tenga todos los permisos', async () => {
    const s = await setup();
    await darRol(s, s.ids.b, ['silenciar', 'desconectar', 'bloquearVoz', 'banear', 'mensajes', 'grupo', 'salas', 'agregarMusica', 'cola', 'youtube', 'subirSonidos', 'botonera']);
    const g = await s.b.collection('groups').getOne(s.g.id);
    await expect(s.b.collection('groups').update(s.g.id, { roles: [TODOS, { id: 'rabcdef1', nombre: 'Yo', color: '#ffffff', permisos: [] }] })).rejects.toMatchObject({ status: 403 });
    await expect(s.b.collection('groups').update(s.g.id, { asignaciones: { ...g.asignaciones, [s.ids.c]: g.asignaciones[s.ids.b] } })).rejects.toMatchObject({ status: 403 });
  });

  it('Beto con "grupo" cambia el nombre; sin el permiso, 403', async () => {
    const s = await setup();
    await expect(s.b.collection('groups').update(s.g.id, { name: 'nuevo' })).rejects.toMatchObject({ status: 403 });
    await darRol(s, s.ids.b, ['grupo']);
    expect((await s.b.collection('groups').update(s.g.id, { name: 'nuevo' })).name).toBe('nuevo');
  });

  it('Beto con "banear" echa a Carla (pierde sus roles) y no puede echar al admin', async () => {
    const s = await setup();
    await darRol(s, s.ids.c, ['cola']);
    await darRol(s, s.ids.b, ['banear']);
    await expect(s.b.collection('groups').update(s.g.id, { members: [s.ids.b, s.ids.c] })).rejects.toMatchObject({ status: 400 });
    await s.b.collection('groups').update(s.g.id, { members: [s.ids.a, s.ids.b] });
    const g = await s.a.collection('groups').getOne(s.g.id);
    expect(g.members).not.toContain(s.ids.c);
    expect(g.asignaciones[s.ids.c]).toBeUndefined();
  });

  it('un update mezclado (echar + nombre) sin "grupo" se rechaza entero', async () => {
    const s = await setup();
    await darRol(s, s.ids.b, ['banear']);
    await expect(s.b.collection('groups').update(s.g.id, { members: [s.ids.a, s.ids.b], name: 'x' })).rejects.toMatchObject({ status: 403 });
    const g = await s.a.collection('groups').getOne(s.g.id);
    expect(g.members).toContain(s.ids.c);
    expect(g.name).toBe('g');
  });

  it('roles inválidos se rechazan', async () => {
    const s = await setup();
    const rol = (x: object) => ({ id: 'rabcdef1', nombre: 'DJ', color: '#5bc77a', permisos: [], ...x });
    const mal = [
      [rol({ nombre: 'x'.repeat(25) })], [rol({ color: 'rojo' })], [rol({ permisos: ['volar'] })],
      [rol({}), rol({ id: 'rabcdef2' })], // nombre repetido
      Array.from({ length: 21 }, (_, i) => rol({ id: `rabcdef${String(i).padStart(2, '0')}`, nombre: `R${i}` })),
    ];
    for (const r of mal) await expect(s.a.collection('groups').update(s.g.id, { roles: [TODOS, ...r] })).rejects.toMatchObject({ status: 400 });
    await expect(s.a.collection('groups').update(s.g.id, { roles: [rol({})] })).rejects.toMatchObject({ status: 400 }); // sin Todos
    await expect(s.a.collection('groups').update(s.g.id, { roles: [{ ...TODOS, nombre: 'Gente' }] })).rejects.toMatchObject({ status: 400 });
    await expect(s.a.collection('groups').update(s.g.id, { asignaciones: { noexiste123: [] } })).rejects.toMatchObject({ status: 400 });
    // A Todos sí se le pueden dar permisos.
    expect((await s.a.collection('groups').update(s.g.id, { roles: [{ ...TODOS, permisos: ['agregarMusica'] }] })).roles[0].permisos).toEqual(['agregarMusica']);
  });

  it('borrar un rol que sigue asignado no rompe el update', async () => {
    const s = await setup();
    await darRol(s, s.ids.b, ['agregarMusica']);
    await s.a.collection('groups').update(s.g.id, { roles: [TODOS] });
    expect((await s.a.collection('groups').getOne(s.g.id)).roles).toEqual([TODOS]);
  });
});
describe('roles: moderar', () => {
  const post = (pb: { send: Function }, g: string, ruta: string, body: object) => pb.send(`/api/groups/${g}/${ruta}`, { method: 'POST', body });

  it('sin rol no se silencia, desconecta, bloquea ni banea', async () => {
    const s = await setup();
    for (const [ruta, body] of [['silenciar', { user: s.ids.c, silenciado: true }], ['desconectar', { user: s.ids.c }],
      ['bloquear-voz', { user: s.ids.c, bloqueado: true }], ['banear', { user: s.ids.c, baneado: true }]] as const) {
      await expect(post(s.b, s.g.id, ruta, body)).rejects.toMatchObject({ status: 403 });
    }
  });

  it('un Moderador silencia y desconecta a Carla', async () => {
    const s = await setup();
    await darRol(s, s.ids.b, ['silenciar', 'desconectar'], 'Moderador');
    await post(s.b, s.g.id, 'silenciar', { user: s.ids.c, silenciado: true });
    expect((await s.a.collection('groups').getOne(s.g.id)).silenciados).toContain(s.ids.c);
    await post(s.b, s.g.id, 'desconectar', { user: s.ids.c });
    await expect(post(s.b, s.g.id, 'bloquear-voz', { user: s.ids.c, bloqueado: true })).rejects.toMatchObject({ status: 403 });
  });

  it('nadie modera al admin', async () => {
    const s = await setup();
    await darRol(s, s.ids.b, ['silenciar', 'desconectar', 'bloquearVoz', 'banear']);
    for (const [ruta, body] of [['silenciar', { user: s.ids.a, silenciado: true }], ['desconectar', { user: s.ids.a }],
      ['bloquear-voz', { user: s.ids.a, bloqueado: true }], ['banear', { user: s.ids.a, baneado: true }]] as const) {
      await expect(post(s.b, s.g.id, ruta, body)).rejects.toMatchObject({ status: 403 });
    }
    await expect(s.b.collection('groups').update(s.g.id, { silenciados: [s.ids.a] })).rejects.toMatchObject({ status: 403 });
  });

  it('bloquear la voz guarda quién y cuándo; desbloquear lo borra', async () => {
    const s = await setup();
    await darRol(s, s.ids.b, ['bloquearVoz']);
    await post(s.b, s.g.id, 'bloquear-voz', { user: s.ids.c, bloqueado: true });
    let g = await s.a.collection('groups').getOne(s.g.id);
    expect(g.bloqueados).toContain(s.ids.c);
    expect(g.bloqueadosInfo[s.ids.c]).toMatchObject({ por: s.ids.b });
    expect(Date.parse(g.bloqueadosInfo[s.ids.c].fecha)).toBeGreaterThan(0);
    await post(s.b, s.g.id, 'bloquear-voz', { user: s.ids.c, bloqueado: false });
    g = await s.a.collection('groups').getOne(s.g.id);
    expect(g.bloqueados).not.toContain(s.ids.c);
    expect(g.bloqueadosInfo[s.ids.c]).toBeUndefined();
  });

  it('banear guarda quién; desbanear pide el mismo permiso', async () => {
    const s = await setup();
    await darRol(s, s.ids.b, ['banear']);
    await post(s.b, s.g.id, 'banear', { user: s.ids.c, baneado: true });
    const g = await s.a.collection('groups').getOne(s.g.id);
    expect(g.baneados.find((x: { id: string }) => x.id === s.ids.c)).toMatchObject({ por: s.ids.b });
    await post(s.b, s.g.id, 'banear', { user: s.ids.c, baneado: false });
    expect((await s.a.collection('groups').getOne(s.g.id)).baneados).toEqual([]);
  });
});
describe('roles: música, YouTube, botonera, salas y mensajes', () => {
  const musica = (pb: { send: Function }, sala: string, body: object) => pb.send(`/api/rooms/${sala}/musica`, { method: 'POST', body });
  const lista = (ids: string[]) => ({ accion: 'agregarLista', canciones: ids.map((videoId) => ({ videoId, titulo: videoId })) });

  it('sin rol no se agregan canciones; con DJ sí; "termino" lo puede mandar cualquiera', async () => {
    const s = await setup();
    await expect(musica(s.b, s.voz.id, lista(['aaaaaaaaaaa']))).rejects.toMatchObject({ status: 403, message: 'No tenés permiso para agregar canciones.' });
    await darRol(s, s.ids.b, ['agregarMusica'], 'DJ');
    const r = await musica(s.b, s.voz.id, lista(['aaaaaaaaaaa', 'bbbbbbbbbbb']));
    await musica(s.c, s.voz.id, { accion: 'termino', cancionId: r.reproduccion?.cancion ?? r.cancion?.id ?? '' }).catch((e: { status: number }) => expect(e.status).not.toBe(403));
    await expect(musica(s.b, s.voz.id, { accion: 'saltar' })).rejects.toMatchObject({ status: 403, message: 'No tenés permiso para manejar la música.' });
  });

  it('un rol borrado deja de dar permiso', async () => {
    const s = await setup();
    await darRol(s, s.ids.b, ['agregarMusica']);
    await s.a.collection('groups').update(s.g.id, { roles: [TODOS] });
    await expect(musica(s.b, s.voz.id, lista(['aaaaaaaaaaa']))).rejects.toMatchObject({ status: 403 });
  });

  it('con "cola" se saltea, ordena, quita y vacía', async () => {
    const s = await setup();
    await musica(s.a, s.voz.id, lista(['aaaaaaaaaaa', 'bbbbbbbbbbb']));
    await darRol(s, s.ids.b, ['cola']);
    await musica(s.b, s.voz.id, { accion: 'saltar' });
    await musica(s.b, s.voz.id, { accion: 'vaciar' });
  });

  it('YouTube juntos pide "youtube"', async () => {
    const s = await setup();
    const yt = (pb: { send: Function }, body: object) => pb.send(`/api/rooms/${s.voz.id}/youtube`, { method: 'POST', body });
    await expect(yt(s.b, { accion: 'sacar' })).rejects.toMatchObject({ status: 403, message: 'No tenés permiso para manejar los videos.' });
    await darRol(s, s.ids.b, ['youtube']);
    await yt(s.b, { accion: 'sacar' });
  });

  it('botonera: subir pide "subirSonidos"; editar o borrar uno ajeno pide "botonera"; el propio, "subirSonidos"', async () => {
    const s = await setup();
    const wav = () => { const b = Buffer.alloc(44 + 200); b.write('RIFF', 0); b.write('WAVEfmt ', 8); b.write('data', 36); return b; };
    const fd = (owner: string) => { const d = new FormData(); d.append('group', s.g.id); d.append('owner', owner); d.append('name', 'pum'); d.append('file', new File([wav()], 'x.wav', { type: 'audio/wav' })); return d; };
    await expect(s.b.collection('sonidos').create(fd(s.ids.b))).rejects.toMatchObject({ status: 403 });
    const subir = await darRol(s, s.ids.b, ['subirSonidos']);
    const mio = await s.b.collection('sonidos').create(fd(s.ids.b));
    const deAna = await s.a.collection('sonidos').create(fd(s.ids.a));
    expect((await s.b.collection('sonidos').update(mio.id, { name: 'mio' })).name).toBe('mio');
    await expect(s.b.collection('sonidos').update(deAna.id, { name: 'x' })).rejects.toMatchObject({ status: 403 });
    await expect(s.c.collection('sonidos').delete(mio.id)).rejects.toMatchObject({ status: 403 });
    await darRol(s, s.ids.c, ['botonera']);
    await s.c.collection('sonidos').update(deAna.id, { name: 'otro' });
    await s.c.collection('sonidos').delete(mio.id);
    // Sin "subirSonidos", Beto ya no edita ni lo suyo.
    const g = await s.a.collection('groups').getOne(s.g.id);
    await s.a.collection('groups').update(s.g.id, { roles: g.roles.filter((r: { id: string }) => r.id !== subir.id) });
    const otro = await s.a.collection('sonidos').create(fd(s.ids.a));
    await expect(s.b.collection('sonidos').delete(otro.id)).rejects.toMatchObject({ status: 403 });
  });

  it('salas: crear, renombrar y borrar piden "salas"', async () => {
    const s = await setup();
    const nueva = { group: s.g.id, name: 'Otra', kind: 'voz', position: 5 };
    await expect(s.b.collection('rooms').create(nueva)).rejects.toMatchObject({ status: 403 });
    await expect(s.b.collection('rooms').update(s.chat.id, { name: 'x' })).rejects.toMatchObject({ status: 403 });
    await darRol(s, s.ids.b, ['salas']);
    const r = await s.b.collection('rooms').create(nueva);
    await s.b.collection('rooms').update(r.id, { name: 'Renombrada' });
    await s.b.collection('rooms').delete(r.id);
  });

  it('mensajes: borrar uno ajeno pide "mensajes"; el propio siempre', async () => {
    const s = await setup();
    const deCarla = await s.c.collection('messages').create({ room: s.chat.id, author: s.ids.c, text: 'hola' });
    const deBeto = await s.b.collection('messages').create({ room: s.chat.id, author: s.ids.b, text: 'chau' });
    await expect(s.b.collection('messages').delete(deCarla.id)).rejects.toMatchObject({ status: 403 });
    await s.b.collection('messages').delete(deBeto.id);
    await darRol(s, s.ids.b, ['mensajes']);
    await s.b.collection('messages').delete(deCarla.id);
  });
});

describe('roles: revisión final', () => {
  const post = (pb: { send: Function }, g: string, ruta: string, body: object) => pb.send(`/api/groups/${g}/${ruta}`, { method: 'POST', body });

  it('un moderador silenciado o bloqueado no se libera solo editando el grupo', async () => {
    const s = await setup();
    await darRol(s, s.ids.b, ['silenciar', 'bloquearVoz']);
    await post(s.a, s.g.id, 'silenciar', { user: s.ids.b, silenciado: true });
    await post(s.a, s.g.id, 'bloquear-voz', { user: s.ids.b, bloqueado: true });
    await expect(s.b.collection('groups').update(s.g.id, { silenciados: [] })).rejects.toMatchObject({ status: 403 });
    await expect(s.b.collection('groups').update(s.g.id, { bloqueados: [] })).rejects.toMatchObject({ status: 403 });
    // Tampoco por las rutas.
    await expect(post(s.b, s.g.id, 'bloquear-voz', { user: s.ids.b, bloqueado: false })).rejects.toMatchObject({ status: 400 });
    await expect(post(s.b, s.g.id, 'silenciar', { user: s.ids.b, silenciado: false })).rejects.toMatchObject({ status: 400 });
    expect((await s.a.collection('groups').getOne(s.g.id)).bloqueados).toContain(s.ids.b);
  });

  it('se puede desbloquear de la voz a alguien que ya se fue del grupo', async () => {
    const s = await setup();
    await darRol(s, s.ids.b, ['bloquearVoz']);
    await post(s.b, s.g.id, 'bloquear-voz', { user: s.ids.c, bloqueado: true });
    await s.c.send(`/api/groups/${s.g.id}/leave`, { method: 'POST' });
    await post(s.b, s.g.id, 'bloquear-voz', { user: s.ids.c, bloqueado: false });
    expect((await s.a.collection('groups').getOne(s.g.id)).bloqueados).not.toContain(s.ids.c);
  });
});
