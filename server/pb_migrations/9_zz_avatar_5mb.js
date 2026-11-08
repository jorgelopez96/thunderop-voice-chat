/// <reference path="../pb_data/types.d.ts" />
// Foto de perfil hasta 5 MB (antes 2): se pidió para poder poner GIFs animados.
migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  users.fields.getByName("avatar").maxSize = 5 * 1024 * 1024;
  app.save(users);
}, (app) => {
  const users = app.findCollectionByNameOrId("users");
  users.fields.getByName("avatar").maxSize = 2 * 1024 * 1024;
  app.save(users);
});
