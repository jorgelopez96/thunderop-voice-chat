/// <reference path="../pb_data/types.d.ts" />
// `users.inactivo`: hace rato que no toca la PC. Lo pone solo el latido; con "Disponible" se ve "Ausente".
migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  users.fields.add(new BoolField({ name: "inactivo" }));
  app.save(users);
}, (app) => {
  const users = app.findCollectionByNameOrId("users");
  users.fields.removeByName("inactivo");
  app.save(users);
});
