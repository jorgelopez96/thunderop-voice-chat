/// <reference path="../pb_data/types.d.ts" />
// Rutas de voz: token de LiveKit para una sala, presencia por grupo y silenciar (dueño).
// Al borrar una sala de voz se borra también en LiveKit.

routerAdd("POST", "/api/rooms/{id}/token", (e) => {
  const lk = require(`${__hooks}/livekit.js`);
  const c = lk.config();
  const { room, group } = lk.salaDeVoz(e.app, e.request.pathValue("id"), e.auth.id);
  if (group.getStringSlice("bloqueados").includes(e.auth.id)) throw new ForbiddenError("El dueño no te deja entrar a la voz por ahora.");

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
    res[r.id] = participantes.filter((p) => !p.identity.endsWith(".pantalla")).map((p) => ({ id: p.identity, name: p.name, silenciado: lk.silenciado(p, silenciados) }));
  });
  return e.json(200, res);
}, $apis.requireAuth("users"));

// Dueño silencia (o no) a un miembro: guarda `silenciados` y actualiza el permiso en vivo.
routerAdd("POST", "/api/groups/{id}/silenciar", (e) => {
  const lk = require(`${__hooks}/livekit.js`);
  const group = lk.grupoDeMiembro(e.app, e.request.pathValue("id"), e.auth.id);
  if (group.getString("owner") !== e.auth.id) throw new ForbiddenError("Solo el dueño puede silenciar.");
  const body = e.requestInfo().body;
  const user = body.user;
  if (typeof user !== "string" || typeof body.silenciado !== "boolean") {
    throw new BadRequestError("Faltan datos: user y silenciado.");
  }
  if (user === e.auth.id) throw new BadRequestError("No te podés silenciar a vos mismo.");
  if (!group.getStringSlice("members").includes(user)) throw new BadRequestError("Ese usuario no es miembro del grupo.");

  const otros = group.getStringSlice("silenciados").filter((u) => u !== user);
  group.set("silenciados", body.silenciado ? otros.concat(user) : otros);
  e.app.save(group);

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
  const group = lk.grupoDeMiembro(e.app, e.request.pathValue("id"), e.auth.id);
  if (group.getString("owner") !== e.auth.id) throw new ForbiddenError("Solo el dueño puede desconectar.");
  const user = e.requestInfo().body.user;
  if (typeof user !== "string" || !user) throw new BadRequestError("Falta el usuario.");
  if (user === e.auth.id) throw new BadRequestError("No te podés desconectar a vos mismo desde acá.");
  if (!group.getStringSlice("members").includes(user)) throw new BadRequestError("Ese usuario no es miembro del grupo.");
  lk.enSalasDeVoz(e.app, group.id, "RemoveParticipant", { identity: user });
  return e.json(200, { ok: true });
}, $apis.requireAuth("users"));

// Dueño mueve a un miembro a otra sala de voz del grupo: le avisa por LiveKit (topic "mover", sin remitente = servidor)
// y su app se cambia sola. Si no está en ninguna llamada, no pasa nada.
routerAdd("POST", "/api/groups/{id}/mover", (e) => {
  const lk = require(`${__hooks}/livekit.js`);
  const { group, user } = lk.moderar(e);
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
  const { group, user } = lk.moderar(e);
  const si = e.requestInfo().body.bloqueado;
  if (typeof si !== "boolean") throw new BadRequestError("Falta bloqueado.");
  const otros = group.getStringSlice("bloqueados").filter((u) => u !== user);
  group.set("bloqueados", si ? otros.concat(user) : otros);
  e.app.save(group);
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
