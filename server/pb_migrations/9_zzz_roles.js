/// <reference path="../pb_data/types.d.ts" />
// Roles por grupo (ver pb_hooks/roles.js): `roles` [{id, nombre, color, permisos}] con "todos" siempre presente,
// `asignaciones` {usuario: [ids de rol]} y `bloqueadosInfo` {usuario: {por, fecha}} de quien se bloqueó de la voz.
// Los grupos que ya existen arrancan solo con "Todos", sin permisos.
migrate((app) => {
  const groups = app.findCollectionByNameOrId("groups");
  groups.fields.add(new JSONField({ name: "roles", maxSize: 20000 }));
  groups.fields.add(new JSONField({ name: "asignaciones", maxSize: 20000 }));
  groups.fields.add(new JSONField({ name: "bloqueadosInfo", maxSize: 20000 }));
  app.save(groups);
  for (const g of app.findRecordsByFilter("groups", "id != ''", "", 0, 0)) {
    g.set("roles", [{ id: "todos", nombre: "Todos", color: "", permisos: [] }]);
    g.set("asignaciones", {});
    g.set("bloqueadosInfo", {});
    app.saveNoValidate(g); // un grupo viejo con algún dato fuera de las reglas no tiene que trabar el arranque
  }
}, (app) => {
  const groups = app.findCollectionByNameOrId("groups");
  ["roles", "asignaciones", "bloqueadosInfo"].forEach((n) => groups.fields.removeByName(n));
  app.save(groups);
});
