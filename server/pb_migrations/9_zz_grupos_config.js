/// <reference path="../pb_data/types.d.ts" />
// `groups.descripcion` (la edita el dueño), `ingresos` ({usuario: fecha} de cuando entró) y `baneados`
// ([{id, name, username, fecha}]: el baneado deja de ver el grupo, así que sus datos se guardan acá).
// `ingresos` y `baneados` solo los escribe el servidor.
migrate((app) => {
  const groups = app.findCollectionByNameOrId("groups");
  groups.fields.add(new TextField({ name: "descripcion", max: 300 }));
  groups.fields.add(new JSONField({ name: "ingresos", maxSize: 20000 }));
  groups.fields.add(new JSONField({ name: "baneados", maxSize: 50000 }));
  app.save(groups);
  for (const g of app.findRecordsByFilter("groups", "id != ''", "", 0, 0)) {
    const ingresos = {};
    g.getStringSlice("members").forEach((u) => (ingresos[u] = g.getString("created")));
    g.set("ingresos", ingresos);
    app.save(g);
  }
}, (app) => {
  const groups = app.findCollectionByNameOrId("groups");
  ["descripcion", "ingresos", "baneados"].forEach((n) => groups.fields.removeByName(n));
  app.save(groups);
});
