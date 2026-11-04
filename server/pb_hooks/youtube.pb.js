/// <reference path="../pb_data/types.d.ts" />
// YouTube juntos: un video por sala de voz, en `videos`, que cualquier miembro del grupo maneja (como la música).
// Posición = pausaS ?? (ahora - inicioMs) / 1000. Sin video: `videoId` vacío.

// Solo lectura: el video actual (null si nunca hubo) y la hora del servidor, para que el cliente mida su desfase.
routerAdd("GET", "/api/rooms/{id}/youtube", (e) => {
  const lk = require(`${__hooks}/livekit.js`);
  const { room } = lk.salaDeVoz(e.app, e.request.pathValue("id"), e.auth.id);
  let video = null;
  try {
    video = e.app.findFirstRecordByData("videos", "room", room.id);
  } catch (_) { /* nunca hubo video */ }
  return e.json(200, { video, ahora: Date.now() });
}, $apis.requireAuth("users"));

routerAdd("POST", "/api/rooms/{id}/youtube", (e) => {
  const lk = require(`${__hooks}/livekit.js`);
  const { room } = lk.salaDeVoz(e.app, e.request.pathValue("id"), e.auth.id);

  const body = e.requestInfo().body;
  const accion = body.accion;
  if (!["poner", "pausar", "reanudar", "ir", "sacar"].includes(accion)) throw new BadRequestError("Acción desconocida.");

  const posS = body.posS;
  if (accion === "ir" && (typeof posS !== "number" || !isFinite(posS) || posS < 0 || posS > 86400)) throw new BadRequestError("Posición inválida.");

  let videoId, titulo;
  if (accion === "poner") {
    // Link → id de 11 caracteres. El host tiene que ser exacto (nada de youtube.com.evil.com).
    const m = /^(?:https?:\/\/)?([^\/?#]+)(\/[^?#]*)?(?:\?([^#]*))?/i.exec(typeof body.url === "string" ? body.url.trim() : "");
    const host = m ? m[1].toLowerCase() : "";
    const path = (m && m[2]) || "/";
    const v = ((m && m[3]) || "").split("&").filter((p) => p.indexOf("v=") === 0).map((p) => p.slice(2))[0];
    const tras = (pre) => (path.indexOf(pre) === 0 ? path.slice(pre.length).split("/")[0] : "");
    if (host === "youtu.be") videoId = path.slice(1);
    else if (["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com"].includes(host)) {
      videoId = path === "/watch" ? v : tras("/shorts/") || tras("/live/") || tras("/embed/");
    }
    if (!/^[A-Za-z0-9_-]{11}$/.test(videoId || "")) throw new BadRequestError("Ese link no es de un video de YouTube.");

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

  let video, ahora;
  e.app.runInTransaction((tx) => {
    ahora = Date.now();
    try {
      video = tx.findFirstRecordByData("videos", "room", room.id);
    } catch (_) {
      video = new Record(tx.findCollectionByNameOrId("videos"));
      video.set("room", room.id);
      video.set("videoId", "");
      video.set("pausaS", null);
    }
    const p = video.getString("pausaS"); // JSON crudo: "", "null" o el número
    const pausaS = p && p !== "null" ? Number(p) : null;
    const hay = !!video.getString("videoId");

    if (accion === "poner") {
      video.set("videoId", videoId);
      video.set("titulo", titulo);
      video.set("puestoPor", e.auth.id);
      video.set("inicioMs", ahora + 1500); // margen para que los clientes carguen el video
      video.set("pausaS", null);
    } else if (accion === "sacar") {
      video.set("videoId", "");
      video.set("titulo", "");
      video.set("pausaS", null);
    } else if (!hay) {
      // pausar, reanudar o ir sin video: nada
    } else if (accion === "pausar") {
      if (pausaS == null) video.set("pausaS", Math.max(0, (ahora - video.getInt("inicioMs")) / 1000));
    } else if (accion === "reanudar") {
      if (pausaS != null) {
        video.set("inicioMs", Math.round(ahora - pausaS * 1000));
        video.set("pausaS", null);
      }
    } else if (accion === "ir") {
      if (pausaS != null) video.set("pausaS", posS);
      else video.set("inicioMs", Math.round(ahora - posS * 1000));
    }
    tx.save(video);
  });
  return e.json(200, { video, ahora });
}, $apis.requireAuth("users"));
