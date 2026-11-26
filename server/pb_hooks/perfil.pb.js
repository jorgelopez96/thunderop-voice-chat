/// <reference path="../pb_data/types.d.ts" />
// Tarjeta de perfil: valida juegos y redes, y arma `cumple` (MM-DD) desde `nacimiento` solo si el dueño lo quiere mostrar.
// También al crear la cuenta: si no, un registro armado a mano podría traer un cumpleaños inventado o redes inválidas.
onRecordCreateRequest((e) => {
  const mal = require(`${__hooks}/reglas.js`).errorPerfil(e.record);
  if (mal) throw new BadRequestError(mal);
  e.record.set("mostrarCumple", false);
  e.record.set("cumple", "");
  e.next();
}, "users");

onRecordUpdateRequest((e) => {
  const mal = require(`${__hooks}/reglas.js`).errorPerfil(e.record);
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
