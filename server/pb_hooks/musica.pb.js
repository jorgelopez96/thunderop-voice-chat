/// <reference path="../pb_data/types.d.ts" />
// Música sincronizada por sala de voz: cola en `canciones`, estado en `reproducciones`.
// Agregar pide "agregarMusica" y manejar la cola, "cola" (roles.js). Posición = pausaS ?? (ahora - inicioMs) / 1000.
// La cola va por `orden` (único por sala, creciente al agregar); la siguiente es la primera en espera.
// Cada acción corre en una transacción, así varios `termino` del mismo tema avanzan una sola vez.

// Solo lectura: estado actual (null si la sala nunca tuvo música) y la hora del servidor, para que el cliente mida su desfase.
routerAdd("GET", "/api/rooms/{id}/musica", (e) => {
  const lk = require(`${__hooks}/livekit.js`);
  const { room } = lk.salaDeVoz(e.app, e.request.pathValue("id"), e.auth.id);
  let rep = null;
  try {
    rep = e.app.findFirstRecordByData("reproducciones", "room", room.id);
  } catch (_) { /* sin música todavía */ }
  return e.json(200, { reproduccion: rep, ahora: Date.now() });
}, $apis.requireAuth("users"));

routerAdd("POST", "/api/rooms/{id}/musica", (e) => {
  const lk = require(`${__hooks}/livekit.js`);
  const { room, group } = lk.salaDeVoz(e.app, e.request.pathValue("id"), e.auth.id);

  const body = e.requestInfo().body;
  const accion = body.accion;
  const cancionId = typeof body.cancionId === "string" ? body.cancionId : "";
  if (!["agregar", "agregarLista", "pausar", "reanudar", "saltar", "termino", "error", "quitar", "vaciar", "ordenar"].includes(accion)) {
    throw new BadRequestError("Acción desconocida.");
  }
  // `termino` y `error` los manda la app sola al terminar o fallar un tema: no piden permiso.
  const roles = require(`${__hooks}/roles.js`);
  if (accion === "agregar" || accion === "agregarLista") roles.exigir(group, e.auth.id, "agregarMusica", "agregar canciones");
  else if (accion !== "termino" && accion !== "error") roles.exigir(group, e.auth.id, "cola", "manejar la música");

  // Link de YouTube → id de 11 caracteres. El host tiene que ser exacto (nada de youtube.com.evil.com).
  let videoId, titulo, nuevas = [];
  if (accion === "agregarLista") {
    // Lista de reproducción: los ids y títulos los arma la app (IFrame API + oEmbed). Hasta 200, como la API.
    const canciones = Array.isArray(body.canciones) ? body.canciones : [];
    if (!canciones.length || canciones.length > 200) throw new BadRequestError("La lista tiene que tener entre 1 y 200 temas.");
    for (const c of canciones) {
      const id = c && typeof c.videoId === "string" ? c.videoId : "";
      if (!/^[A-Za-z0-9_-]{11}$/.test(id)) throw new BadRequestError("La lista tiene un video inválido.");
      const t = c && typeof c.titulo === "string" ? c.titulo.trim().slice(0, 200) : "";
      nuevas.push({ videoId: id, titulo: t || "Video de YouTube" });
    }
  }
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
    nuevas = [{ videoId, titulo }];
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
      const sig = tx.findRecordsByFilter("canciones", "room = {:r} && estado = 'cola'", "orden,created", 1, 0, { r: room.id });
      sonar(sig[0]);
    };

    if (nuevas.length) {
      const col = tx.findCollectionByNameOrId("canciones");
      const ultima = tx.findRecordsByFilter("canciones", "room = {:r}", "-orden", 1, 0, { r: room.id })[0];
      const base = ultima ? ultima.getInt("orden") + 1 : 0;
      let primera = null;
      nuevas.forEach((n, i) => {
        const c = new Record(col);
        c.set("room", room.id);
        c.set("videoId", n.videoId);
        c.set("titulo", n.titulo);
        c.set("agregadoPor", e.auth.id);
        c.set("estado", "cola");
        c.set("orden", base + i);
        tx.save(c);
        primera = primera || c;
      });
      if (!actual) sonar(primera);
    } else if (accion === "pausar") {
      if (actual && pausaS == null) rep.set("pausaS", Math.max(0, (ahora - rep.getInt("inicioMs")) / 1000));
    } else if (accion === "reanudar") {
      if (pausaS != null) {
        rep.set("inicioMs", Math.round(ahora - pausaS * 1000));
        rep.set("pausaS", null);
      }
    } else if (accion === "vaciar") {
      // Quitar todas: borra la cola y corta la que suena.
      tx.findRecordsByFilter("canciones", "room = {:r} && estado = 'cola'", "", 0, 0, { r: room.id }).forEach((c) => tx.delete(c));
      if (actual) {
        const c = tx.findRecordById("canciones", actual);
        c.set("estado", "hecha");
        tx.save(c);
        sonar(null);
      }
    } else if (accion === "ordenar") {
      // Nuevo orden de la que suena y las que esperan: se reparten los mismos lugares que ya ocupaban
      // (las que dieron error quedan donde estaban). Tiene que ser exactamente esa cola, si no alguien la cambió antes.
      const ids = Array.isArray(body.ids) ? body.ids : [];
      const cola = tx.findRecordsByFilter("canciones", "room = {:r} && (estado = 'cola' || estado = 'sonando')", "orden,created", 0, 0, { r: room.id });
      const porId = new Map(cola.map((c) => [c.id, c]));
      if (ids.length !== cola.length || new Set(ids).size !== ids.length || !ids.every((id) => porId.has(id))) {
        throw new BadRequestError("La cola cambió mientras la ordenabas. Probá de nuevo.");
      }
      const lugares = cola.map((c) => c.getInt("orden"));
      ids.forEach((id, i) => {
        const c = porId.get(id);
        if (c.getInt("orden") !== lugares[i]) {
          c.set("orden", lugares[i]);
          tx.save(c);
        }
      });
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
