/// <reference path="../pb_data/types.d.ts" />
// Tarjeta de perfil: valida juegos y redes, y arma `cumple` (MM-DD) desde `nacimiento` solo si el dueño lo quiere mostrar.
onRecordUpdateRequest((e) => {
  const r = require(`${__hooks}/reglas.js`);
  const json = (c) => { const s = e.record.getString(c); return s && s !== "null" ? JSON.parse(s) : null; };
  const mal = r.errorJuegos(json("juegos")) || r.errorRedes(json("redes"));
  if (mal) throw new BadRequestError(mal);
  const nacimiento = e.record.getString("nacimiento"); // "1996-03-14 00:00:00.000Z"
  e.record.set("cumple", e.record.getBool("mostrarCumple") && nacimiento ? nacimiento.slice(5, 10) : "");
  e.next();
}, "users");

// Código para bajar Thunderop desde la web: cualquier cuenta lo puede pasar para invitar a alguien.
routerAdd("GET", "/api/invitacion", (e) => {
  const codigo = String($os.getenv("THUNDEROP_CODIGO") || "").trim();
  return e.json(200, { codigo });
}, $apis.requireAuth("users"));
