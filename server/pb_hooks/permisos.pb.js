/// <reference path="../pb_data/types.d.ts" />
// Permisos de roles (roles.js) sobre salas, mensajes y sonidos. Las reglas de esas colecciones solo piden ser
// miembro (9_zzz_roles_colecciones.js); acá se exige el permiso. Los superusers pasan siempre.


["onRecordCreateRequest", "onRecordUpdateRequest", "onRecordDeleteRequest"].forEach((h) => {
  globalThis[h]((e) => {
    if (!e.hasSuperuserAuth()) {
      const roles = require(`${__hooks}/roles.js`);
      roles.exigir(e.app.findRecordById("groups", e.record.getString("group")), e.auth.id, "salas", "manejar las salas");
    }
    e.next();
  }, "rooms");
});

// Borrar un mensaje ajeno pide "mensajes"; el propio, nunca.
onRecordDeleteRequest((e) => {
  if (!e.hasSuperuserAuth() && e.record.getString("author") !== e.auth.id) {
    const roles = require(`${__hooks}/roles.js`);
    const sala = e.app.findRecordById("rooms", e.record.getString("room"));
    roles.exigir(e.app.findRecordById("groups", sala.getString("group")), e.auth.id, "mensajes", "borrar mensajes de otros");
  }
  e.next();
}, "messages");

// Subir pide "subirSonidos". Editar o borrar: cualquiera con "botonera"; el propio, con "subirSonidos".
onRecordCreateRequest((e) => {
  if (!e.hasSuperuserAuth()) {
    const roles = require(`${__hooks}/roles.js`);
    roles.exigir(e.app.findRecordById("groups", e.record.getString("group")), e.auth.id, "subirSonidos", "subir sonidos");
  }
  e.next();
}, "sonidos");

["onRecordUpdateRequest", "onRecordDeleteRequest"].forEach((h) => {
  globalThis[h]((e) => {
    if (!e.hasSuperuserAuth()) {
      const roles = require(`${__hooks}/roles.js`);
      const g = e.app.findRecordById("groups", e.record.getString("group"));
      const propio = e.record.getString("owner") === e.auth.id && roles.puede(g, e.auth.id, "subirSonidos");
      if (!propio) roles.exigir(g, e.auth.id, "botonera", "editar la botonera");
    }
    e.next();
  }, "sonidos");
});
