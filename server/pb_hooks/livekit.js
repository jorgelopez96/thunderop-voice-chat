/// <reference path="../pb_data/types.d.ts" />
// Helper de voz compartido (LiveKit + chequeo de miembro) (no es *.pb.js: se carga con require dentro de cada handler).

// Lee las variables LIVEKIT_*; si falta alguna, 503.
function config() {
  const c = {
    url: $os.getenv("LIVEKIT_URL"),
    apiUrl: $os.getenv("LIVEKIT_API_URL"),
    key: $os.getenv("LIVEKIT_API_KEY"),
    secret: $os.getenv("LIVEKIT_API_SECRET"),
  };
  if (!c.url || !c.apiUrl || !c.key || !c.secret) {
    throw new ApiError(503, "La voz no está configurada en el servidor.");
  }
  return c;
}

// JWT HS256 de LiveKit. createJWT solo agrega `exp`; `nbf` e `iss` van acá.
function token(c, claims, segundos) {
  const payload = Object.assign({ iss: c.key, nbf: Math.floor(Date.now() / 1000) }, claims);
  return $security.createJWT(payload, c.secret, segundos);
}

// POST a la RoomService (Twirp) con un token de admin de `room` (+ roomCreate, que DeleteRoom exige;
// el token no sale del servidor). Devuelve el JSON;
// si LiveKit no responde 200, tira un Error con `status` = código de LiveKit.
function roomService(c, method, body, room) {
  const res = $http.send({
    url: `${c.apiUrl}/twirp/livekit.RoomService/${method}`,
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token(c, { video: { roomAdmin: true, roomCreate: true, room } }, 60)}`,
    },
    timeout: 10,
  });
  if (res.statusCode !== 200) {
    const err = new Error(`LiveKit ${method}: ${res.statusCode} ${toString(res.body)}`);
    err.status = res.statusCode;
    throw err;
  }
  return res.json;
}

// Llama `method` de la RoomService en cada sala de voz del grupo (o en `salas`, si se pasan ids).
// "not found" (404) no es error; cualquier otro fallo, o LiveKit sin configurar, se registra con warn
// y no corta: la operación de PocketBase ya está hecha.
function enSalasDeVoz(app, groupId, method, body, salas) {
  let c;
  try {
    c = config();
  } catch (_) {
    return;
  }
  salas = salas || app.findRecordsByFilter("rooms", "group = {:g} && kind = 'voz'", "", 0, 0, { g: groupId }).map((r) => r.id);
  salas.forEach((room) => {
    try {
      roomService(c, method, Object.assign({ room }, body), room);
    } catch (err) {
      if (err.status !== 404) app.logger().warn("LiveKit falló", "method", method, "room", room, "error", String(err));
    }
  });
}

// Base64 de un texto ASCII (la JSVM no trae btoa). Para el campo `data` de SendData.
function base64(texto) {
  const abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = "";
  for (let i = 0; i < texto.length; i += 3) {
    const [a, b, c] = [texto.charCodeAt(i), texto.charCodeAt(i + 1), texto.charCodeAt(i + 2)];
    const n = (a << 16) | ((b || 0) << 8) | (c || 0);
    out += abc[(n >> 18) & 63] + abc[(n >> 12) & 63] + (isNaN(b) ? "=" : abc[(n >> 6) & 63]) + (isNaN(c) ? "=" : abc[n & 63]);
  }
  return out;
}

// Busca el grupo y exige que `userId` sea miembro.
function grupoDeMiembro(app, groupId, userId) {
  let group;
  try {
    group = app.findRecordById("groups", groupId);
  } catch (_) {
    throw new NotFoundError("Grupo no encontrado.");
  }
  if (!group.getStringSlice("members").includes(userId)) {
    throw new ForbiddenError("No sos miembro de este grupo.");
  }
  return group;
}

// Busca la sala de voz `roomId` y exige que `userId` sea miembro de su grupo.
function salaDeVoz(app, roomId, userId) {
  let room;
  try {
    room = app.findRecordById("rooms", roomId);
  } catch (_) {
    throw new NotFoundError("Sala no encontrada.");
  }
  const group = grupoDeMiembro(app, room.getString("group"), userId);
  if (room.getString("kind") !== "voz") throw new BadRequestError("No es una sala de voz.");
  return { room, group };
}

// Sin micrófono para los demás: silenciado por el dueño o sin pista de micrófono abierta.
// `source` llega como nombre protobuf ("MICROPHONE") o número (2), según la versión de LiveKit.
function silenciado(p, silenciados) {
  if (silenciados.includes(p.identity)) return true;
  return !(p.tracks || []).some((t) => (t.source === "MICROPHONE" || t.source === 2) && !t.muted);
}

// Moderación del dueño sobre otro miembro del grupo de la ruta (`id`): valida y devuelve { group, user }.
function moderar(e) {
  const group = grupoDeMiembro(e.app, e.request.pathValue("id"), e.auth.id);
  if (group.getString("owner") !== e.auth.id) throw new ForbiddenError("Solo el dueño puede hacer esto.");
  const user = e.requestInfo().body.user;
  if (typeof user !== "string" || !user) throw new BadRequestError("Falta el usuario.");
  if (user === e.auth.id) throw new BadRequestError("No podés hacerte esto a vos mismo.");
  if (!group.getStringSlice("members").includes(user)) throw new BadRequestError("Ese usuario no es miembro del grupo.");
  return { group, user };
}

module.exports = { config, token, roomService, enSalasDeVoz, grupoDeMiembro, salaDeVoz, silenciado, base64, moderar };
