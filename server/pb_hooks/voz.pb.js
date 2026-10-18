/// <reference path="../pb_data/types.d.ts" />
// Rutas de voz: token de LiveKit para una sala y presencia por grupo.

routerAdd("POST", "/api/rooms/{id}/token", (e) => {
  const lk = require(`${__hooks}/livekit.js`);
  const c = lk.config();
  let room;
  try {
    room = e.app.findRecordById("rooms", e.request.pathValue("id"));
  } catch (_) {
    throw new NotFoundError("Sala no encontrada.");
  }
  const group = lk.grupoDeMiembro(e.app, room.getString("group"), e.auth.id);
  if (room.getString("kind") !== "voz") throw new BadRequestError("No es una sala de voz.");

  const video = { room: room.id, roomJoin: true, canSubscribe: true, canPublish: true, canPublishData: true };
  if (group.getStringSlice("silenciados").includes(e.auth.id)) {
    video.canPublishSources = ["camera", "screen_share", "screen_share_audio"];
  }
  const token = lk.token(c, { sub: e.auth.id, name: e.auth.getString("name"), video }, 600);
  return e.json(200, { token, url: c.url });
}, $apis.requireAuth("users"));

routerAdd("GET", "/api/groups/{id}/voz", (e) => {
  const lk = require(`${__hooks}/livekit.js`);
  const c = lk.config();
  const group = lk.grupoDeMiembro(e.app, e.request.pathValue("id"), e.auth.id);
  const salas = e.app.findRecordsByFilter("rooms", "group = {:g} && kind = 'voz'", "position", 0, 0, { g: group.id });
  const res = {};
  salas.forEach((r) => {
    // LiveKit responde 200 { participants: [] } (o sin el campo) para una sala que no existe
    const participantes = lk.roomService(c, "ListParticipants", { room: r.id }, r.id).participants || [];
    res[r.id] = participantes.map((p) => ({ id: p.identity, name: p.name }));
  });
  return e.json(200, res);
}, $apis.requireAuth("users"));
