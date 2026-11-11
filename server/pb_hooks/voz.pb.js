/// <reference path="../pb_data/types.d.ts" />
// Rutas de voz: token de LiveKit para una sala, presencia por grupo y moderación (admin o con permiso, ver roles.js).
// Al borrar una sala de voz se borra también en LiveKit.

routerAdd("POST", "/api/rooms/{id}/token", (e) => {
  const lk = require(`${__hooks}/livekit.js`);
  const c = lk.config();
  const { room, group } = lk.salaDeVoz(e.app, e.request.pathValue("id"), e.auth.id);
  if (group.getStringSlice("bloqueados").includes(e.auth.id)) throw new ForbiddenError("El dueño no te deja entrar a la voz por ahora.");
  // Un moderador te desconectó mientras el celular tenía la app congelada: la app intenta volver sola (`vuelta`) y no
  // tiene que poder. Entrar a mano sí. La marca la deja /desconectar en la memoria del servidor por 10 minutos.
  const clave = `sacado:${group.id}:${e.auth.id}`;
  const cuando = e.app.store().get(clave);
  if (cuando) {
    e.app.store().remove(clave);
    if ((e.requestInfo().body || {}).vuelta === true && Date.now() - cuando < 10 * 60_000) throw new ApiError(409, "Te desconectaron de la llamada.");
  }

  const video = { room: room.id, roomJoin: true, canSubscribe: true, canPublish: true, canPublishData: true, canUpdateOwnMetadata: true };
  if (group.getStringSlice("silenciados").includes(e.auth.id)) {
    video.canPublishSources = ["camera", "screen_share", "screen_share_audio"];
  }
  const token = lk.token(c, { sub: e.auth.id, name: e.auth.getString("name"), video }, 600);
  return e.json(200, { token, url: c.url });
}, $apis.requireAuth("users"));

// Token del transmisor nativo de la app: otra identidad (`<usuario>.pantalla`, LiveKit no deja dos conexiones con la
// misma) que solo publica la pantalla. La app la muestra como la transmisión de su dueño.
routerAdd("POST", "/api/rooms/{id}/token-pantalla", (e) => {
  const lk = require(`${__hooks}/livekit.js`);
  const c = lk.config();
  const { room, group } = lk.salaDeVoz(e.app, e.request.pathValue("id"), e.auth.id);
  if (group.getStringSlice("bloqueados").includes(e.auth.id)) throw new ForbiddenError("El dueño no te deja entrar a la voz por ahora.");

  const video = { room: room.id, roomJoin: true, canSubscribe: false, canPublish: true, canPublishData: false, canPublishSources: ["screen_share"] };
  const token = lk.token(c, { sub: `${e.auth.id}.pantalla`, name: `${e.auth.getString("name")} (pantalla)`, video }, 600);
  return e.json(200, { token, url: c.url });
}, $apis.requireAuth("users"));

routerAdd("GET", "/api/groups/{id}/voz", (e) => {
  const lk = require(`${__hooks}/livekit.js`);
  const c = lk.config();
  const group = lk.grupoDeMiembro(e.app, e.request.pathValue("id"), e.auth.id);
  const salas = e.app.findRecordsByFilter("rooms", "group = {:g} && kind = 'voz'", "position", 0, 0, { g: group.id });
  const silenciados = group.getStringSlice("silenciados");
  const res = {};
  salas.forEach((r) => {
    // LiveKit responde 200 { participants: [] } (o sin el campo) para una sala que no existe
    const participantes = lk.roomService(c, "ListParticipants", { room: r.id }, r.id).participants || [];
    res[r.id] = participantes.filter((p) => !p.identity.endsWith(".pantalla")).map((p) => lk.persona(p, silenciados));
  });
  return e.json(200, res);
}, $apis.requireAuth("users"));

// Dueño silencia (o no) a un miembro: guarda `silenciados` y actualiza el permiso en vivo.
routerAdd("POST", "/api/groups/{id}/silenciar", (e) => {
  const lk = require(`${__hooks}/livekit.js`);
  if (typeof e.requestInfo().body.silenciado !== "boolean") throw new BadRequestError("Faltan datos: user y silenciado.");
  const { group, user } = lk.moderar(e, "silenciar", "silenciar");
  const body = e.requestInfo().body;

  // Se relee y se guarda en una transacción: dos silencios a la vez (o uno y un cambio de roles) no se pisan.
  e.app.runInTransaction((tx) => {
    const g = tx.findRecordById("groups", group.id);
    const otros = g.getStringSlice("silenciados").filter((u) => u !== user);
    g.set("silenciados", body.silenciado ? otros.concat(user) : otros);
    tx.save(g);
  });

  // Enums de TrackSource en su nombre protobuf (Twirp JSON); vacío = todas las fuentes.
  const canPublishSources = body.silenciado ? ["CAMERA", "SCREEN_SHARE", "SCREEN_SHARE_AUDIO"] : [];
  lk.enSalasDeVoz(e.app, group.id, "UpdateParticipant", {
    identity: user,
    permission: { canSubscribe: true, canPublish: true, canPublishData: true, canUpdateOwnMetadata: true, canPublishSources },
  });
  return e.json(200, { ok: true });
}, $apis.requireAuth("users"));

// Dueño saca a un miembro de la llamada (puede volver a entrar; para que no hable, está silenciar).
routerAdd("POST", "/api/groups/{id}/desconectar", (e) => {
  const lk = require(`${__hooks}/livekit.js`);
  const { group, user } = lk.moderar(e, "desconectar", "desconectar");
  e.app.store().set(`sacado:${group.id}:${user}`, Date.now());
  lk.enSalasDeVoz(e.app, group.id, "RemoveParticipant", { identity: user });
  return e.json(200, { ok: true });
}, $apis.requireAuth("users"));

// Dueño mueve a un miembro a otra sala de voz del grupo: le avisa por LiveKit (topic "mover", sin remitente = servidor)
// y su app se cambia sola. Si no está en ninguna llamada, no pasa nada.
routerAdd("POST", "/api/groups/{id}/mover", (e) => {
  const lk = require(`${__hooks}/livekit.js`);
  const { group, user } = lk.moderar(e, "desconectar", "mover de sala");
  const sala = e.requestInfo().body.sala;
  let destino = null;
  try { destino = e.app.findRecordById("rooms", typeof sala === "string" ? sala : ""); } catch (_) { destino = null; }
  if (!destino || destino.getString("group") !== group.id || destino.getString("kind") !== "voz") throw new BadRequestError("Esa sala de voz no es de este grupo.");
  const data = lk.base64(JSON.stringify({ sala: destino.id, nombre: destino.getString("name") }));
  // Solo a la sala donde está (SendData a una sala sin gente da 503).
  const c = lk.config();
  for (const r of e.app.findRecordsByFilter("rooms", "group = {:g} && kind = 'voz'", "", 0, 0, { g: group.id })) {
    let ps = [];
    try { ps = lk.roomService(c, "ListParticipants", { room: r.id }, r.id).participants || []; } catch (_) { continue; }
    if (ps.some((p) => p.identity === user)) { lk.roomService(c, "SendData", { room: r.id, data, kind: "RELIABLE", destinationIdentities: [user], topic: "mover" }, r.id); break; }
  }
  return e.json(200, { ok: true });
}, $apis.requireAuth("users"));

// Dueño bloquea (lo saca y no lo deja volver a la voz) o desbloquea a un miembro.
routerAdd("POST", "/api/groups/{id}/bloquear-voz", (e) => {
  const lk = require(`${__hooks}/livekit.js`);
  const roles = require(`${__hooks}/roles.js`);
  const si = e.requestInfo().body.bloqueado;
  if (typeof si !== "boolean") throw new BadRequestError("Falta bloqueado.");
  let group, user;
  if (si) ({ group, user } = lk.moderar(e, "bloquearVoz", "bloquear la voz"));
  else {
    // Desbloquear no pide que siga en el grupo: el que se fue también tiene que poder volver a la voz.
    group = lk.grupoDeMiembro(e.app, e.request.pathValue("id"), e.auth.id);
    roles.exigir(group, e.auth.id, "bloquearVoz", "desbloquear la voz");
    user = String(e.requestInfo().body.user || "");
    if (!user) throw new BadRequestError("Falta el usuario.");
    if (user === e.auth.id) throw new BadRequestError("No podés hacerte esto a vos mismo.");
  }
  e.app.runInTransaction((tx) => {
    const g = tx.findRecordById("groups", group.id);
    const otros = g.getStringSlice("bloqueados").filter((u) => u !== user);
    g.set("bloqueados", si ? otros.concat(user) : otros);
    // Quién y cuándo, para la lista de Bloqueados (aparte: las apps viejas leen `bloqueados` como lista de ids).
    const info = roles.json(g, "bloqueadosInfo", {});
    if (si) info[user] = { por: e.auth.id, fecha: new Date().toISOString() }; else delete info[user];
    g.set("bloqueadosInfo", info);
    tx.save(g);
  });
  if (si) {
    lk.enSalasDeVoz(e.app, group.id, "RemoveParticipant", { identity: user });
    lk.enSalasDeVoz(e.app, group.id, "RemoveParticipant", { identity: `${user}.pantalla` });
  }
  return e.json(200, { ok: true });
}, $apis.requireAuth("users"));

onRecordAfterDeleteSuccess((e) => {
  if (e.record.getString("kind") === "voz") {
    const lk = require(`${__hooks}/livekit.js`);
    lk.enSalasDeVoz(e.app, e.record.getString("group"), "DeleteRoom", {}, [e.record.id]);
  }
  e.next();
}, "rooms");
