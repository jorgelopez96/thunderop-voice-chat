/// <reference path="../pb_data/types.d.ts" />
// Música sincronizada por sala de voz: cola en `canciones`, estado en `reproducciones`.
// Cualquier miembro del grupo la maneja. Posición = pausaS ?? (ahora - inicioMs) / 1000.
// Cada acción corre en una transacción, así varios `termino` del mismo tema avanzan una sola vez.

routerAdd("POST", "/api/rooms/{id}/musica", (e) => {
  const lk = require(`${__hooks}/livekit.js`);
  let room;
  try {
    room = e.app.findRecordById("rooms", e.request.pathValue("id"));
  } catch (_) {
    throw new NotFoundError("Sala no encontrada.");
  }
  lk.grupoDeMiembro(e.app, room.getString("group"), e.auth.id);
  if (room.getString("kind") !== "voz") throw new BadRequestError("No es una sala de voz.");

  const body = e.requestInfo().body;
  const accion = body.accion;
  const cancionId = typeof body.cancionId === "string" ? body.cancionId : "";
  if (!["agregar", "pausar", "reanudar", "saltar", "termino", "error", "quitar"].includes(accion)) {
    throw new BadRequestError("Acción desconocida.");
  }

  // Link de YouTube → id de 11 caracteres. El host tiene que ser exacto (nada de youtube.com.evil.com).
  let videoId, titulo;
  if (accion === "agregar") {
    const m = /^(?:https?:\/\/)?([^\/?#]+)(\/[^?#]*)?(?:\?([^#]*))?/i.exec(typeof body.url === "string" ? body.url.trim() : "");
    const host = m ? m[1].toLowerCase() : "";
    const path = (m && m[2]) || "/";
    const v = ((m && m[3]) || "").split("&").filter((p) => p.indexOf("v=") === 0).map((p) => p.slice(2))[0];
    if (host === "youtu.be") videoId = path.slice(1);
    else if (["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com"].includes(host)) {
      if (path === "/watch") videoId = v;
      else if (path.indexOf("/shorts/") === 0) videoId = path.slice(8);
    }
    if (!/^[A-Za-z0-9_-]{11}$/.test(videoId || "")) throw new BadRequestError("Ese link no es de YouTube.");

    // Título por oEmbed, fuera de la transacción (no trabar la base mientras esperamos a YouTube).
    titulo = "Video de YouTube";
    try {
      const watch = encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`);
      const res = $http.send({
        url: `${$os.getenv("YOUTUBE_OEMBED") || "https://www.youtube.com/oembed"}?url=${watch}&format=json`,
        method: "GET",
        timeout: 5,
      });
      const t = res.statusCode === 200 && res.json && res.json.title;
      if (typeof t === "string" && t.trim()) titulo = t.trim().slice(0, 200);
    } catch (_) { /* queda el genérico */ }
  }

  let rep, ahora;
  e.app.runInTransaction((tx) => {
    ahora = Date.now();
    try {
      rep = tx.findFirstRecordByData("reproducciones", "room", room.id);
    } catch (_) {
      rep = new Record(tx.findCollectionByNameOrId("reproducciones"));
      rep.set("room", room.id);
      rep.set("pausaS", null);
    }
    const actual = rep.getString("actual");
    const p = rep.getString("pausaS"); // JSON crudo: "", "null" o el número
    const pausaS = p && p !== "null" ? Number(p) : null;

    // Arranca `c` (o deja vacío) con margen de 1,5 s para que los clientes carguen el video.
    const sonar = (c) => {
      rep.set("actual", c ? c.id : "");
      rep.set("inicioMs", ahora + 1500);
      rep.set("pausaS", null);
      if (c) {
        c.set("estado", "sonando");
        tx.save(c);
      }
    };
    // Cierra la actual con `estado` y pasa a la siguiente de la cola, si hay.
    const avanzar = (estado) => {
      const c = tx.findRecordById("canciones", actual);
      c.set("estado", estado);
      tx.save(c);
      const sig = tx.findRecordsByFilter("canciones", "room = {:r} && estado = 'cola'", "created", 1, 0, { r: room.id });
      sonar(sig[0]);
    };

    if (accion === "agregar") {
      const c = new Record(tx.findCollectionByNameOrId("canciones"));
      c.set("room", room.id);
      c.set("videoId", videoId);
      c.set("titulo", titulo);
      c.set("agregadoPor", e.auth.id);
      c.set("estado", "cola");
      tx.save(c);
      if (!actual) sonar(c);
    } else if (accion === "pausar") {
      if (actual && pausaS == null) rep.set("pausaS", Math.max(0, (ahora - rep.getInt("inicioMs")) / 1000));
    } else if (accion === "reanudar") {
      if (pausaS != null) {
        rep.set("inicioMs", Math.round(ahora - pausaS * 1000));
        rep.set("pausaS", null);
      }
    } else if (cancionId && cancionId === actual) {
      // saltar, termino, error y quitar de la actual; el id viejo de otro cliente no hace nada
      avanzar(accion === "error" ? "error" : "hecha");
    } else if (accion === "quitar" && cancionId) {
      const c = tx.findRecordsByFilter("canciones", "id = {:id} && room = {:r} && estado = 'cola'", "", 1, 0, { id: cancionId, r: room.id });
      if (c[0]) tx.delete(c[0]);
    }
    tx.save(rep);
  });
  return e.json(200, { reproduccion: rep, ahora });
}, $apis.requireAuth("users"));
