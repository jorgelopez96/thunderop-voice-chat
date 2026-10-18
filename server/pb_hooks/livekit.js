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

// POST a la RoomService (Twirp) con un token de admin de `room`. Devuelve el JSON;
// si LiveKit no responde 200, tira un Error con `status` = código de LiveKit.
function roomService(c, method, body, room) {
  const res = $http.send({
    url: `${c.apiUrl}/twirp/livekit.RoomService/${method}`,
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token(c, { video: { roomAdmin: true, room } }, 60)}`,
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

module.exports = { config, token, roomService, grupoDeMiembro };
