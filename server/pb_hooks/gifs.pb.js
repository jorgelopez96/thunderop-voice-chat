/// <reference path="../pb_data/types.d.ts" />
// Buscador de GIFs (GIPHY). La clave vive en el servidor (GIPHY_KEY en thunderop.env), nunca en la app.
// Sin texto: los que están en tendencia. Devuelve solo lo que la app necesita.
routerAdd("GET", "/api/gifs", (e) => {
  const clave = $os.getenv("GIPHY_KEY");
  if (!clave) throw new ApiError(503, "Los GIFs todavía no están configurados en el servidor.");
  const q = String(e.request.url.query().get("q") || "").trim().slice(0, 50);
  const offset = Math.min(500, Math.max(0, parseInt(e.request.url.query().get("offset") || "0", 10) || 0));
  const base = $os.getenv("GIPHY_API") || "https://api.giphy.com";
  const url = q
    ? `${base}/v1/gifs/search?api_key=${clave}&q=${encodeURIComponent(q)}&limit=24&offset=${offset}&rating=pg-13&lang=es`
    : `${base}/v1/gifs/trending?api_key=${clave}&limit=24&offset=${offset}&rating=pg-13`;
  let res;
  try { res = $http.send({ url, method: "GET", timeout: 5 }); } catch (_) { throw new ApiError(502, "GIPHY no responde."); }
  if (res.statusCode !== 200 || !res.json) throw new ApiError(502, "GIPHY no responde.");
  const gifs = (res.json.data || []).map((g) => {
    const im = g.images || {};
    const grande = im.fixed_height || im.original || {};
    const chico = im.fixed_height_small || grande;
    return { id: g.id, titulo: String(g.title || "").slice(0, 100), url: grande.url, previa: chico.url };
  }).filter((g) => typeof g.url === "string" && /^https:\/\/media\d*\.giphy\.com\//.test(g.url));
  return e.json(200, { gifs });
}, $apis.requireAuth("users"));
