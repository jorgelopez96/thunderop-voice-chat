/// <reference path="../pb_data/types.d.ts" />
// Vista previa de un link del chat: título, descripción e imagen (Open Graph). YouTube va por oEmbed.
// La pide la app (el navegador no puede leer otras páginas). El servidor nunca le pide nada a su propia red:
// solo https al puerto 443, el nombre se resuelve acá y se rechaza si alguna IP es interna, curl se conecta a esa
// misma IP (--resolve: un cambio de DNS en el medio no la cambia) y cada redirección se vuelve a revisar (vista.js).
routerAdd("GET", "/api/vista-previa", (e) => {
  const v = require(`${__hooks}/vista.js`);
  const url = String(e.request.url.query().get("url") || "").trim();
  const host = v.hostValido(url);
  if (!host) throw new BadRequestError("Link inválido.");
  const corto = (s, n) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, n) : "");

  // oEmbed siempre va a www.youtube.com (host fijo): no hace falta la revisión de IPs.
  if (["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"].includes(host)) {
    try {
      const res = $http.send({ url: `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`, method: "GET", timeout: 4 });
      if (res.statusCode === 200 && res.json) {
        return e.json(200, { titulo: corto(res.json.title, 200), descripcion: corto(res.json.author_name, 200), imagen: corto(res.json.thumbnail_url, 500), sitio: "YouTube" });
      }
    } catch (_) { /* sigue como cualquier página */ }
  }

  const html = v.traer(url);
  const meta = (prop) => {
    const r = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*>`, "i").exec(html);
    const c = r && /content=["']([^"']*)["']/i.exec(r[0]);
    return c ? c[1].replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'") : "";
  };
  const titulo = corto(meta("og:title") || (/<title[^>]*>([^<]*)<\/title>/i.exec(html) || [])[1], 200);
  let imagen = meta("og:image") || meta("twitter:image");
  if (imagen && !/^https:\/\//i.test(imagen)) imagen = /^\/\//.test(imagen) ? `https:${imagen}` : "";
  return e.json(200, { titulo, descripcion: corto(meta("og:description") || meta("description"), 300), imagen: corto(imagen, 500), sitio: corto(meta("og:site_name"), 80) || host });
}, $apis.requireAuth("users"));
