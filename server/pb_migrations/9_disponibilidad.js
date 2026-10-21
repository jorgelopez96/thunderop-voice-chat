/// <reference path="../pb_data/types.d.ts" />
// Estado que elige cada uno en el menú del perfil. Vacío = disponible. Invisible: el latido no lo marca en línea.
migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  users.fields.add(new SelectField({ name: "disponibilidad", maxSelect: 1, values: ["disponible", "ausente", "ocupado", "invisible"] }));
  app.save(users);
}, (app) => {
  const users = app.findCollectionByNameOrId("users");
  users.fields.removeByName("disponibilidad");
  app.save(users);
});
