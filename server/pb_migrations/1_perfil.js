/// <reference path="../pb_data/types.d.ts" />
// Perfil simple en `users`: nombre, avatar, color, estado + reglas.
// `name` y `avatar` ya existen: se modifican en sitio (quitar un campo borra sus datos).
migrate((app) => {
  const users = app.findCollectionByNameOrId("users");

  const name = users.fields.getByName("name");
  name.required = true;
  name.min = 1;
  name.max = 32;

  const avatar = users.fields.getByName("avatar");
  avatar.maxSize = 2 * 1024 * 1024;
  avatar.mimeTypes = ["image/png", "image/jpeg", "image/webp", "image/gif"];
  avatar.thumbs = ["64x64"];

  users.fields.add(new TextField({ name: "color", pattern: "^#[0-9a-f]{6}$" }));
  users.fields.add(new TextField({ name: "status", max: 80 }));

  users.listRule = null;
  users.viewRule = '@request.auth.id != ""';
  users.updateRule = "id = @request.auth.id";
  users.deleteRule = "id = @request.auth.id";

  app.save(users);
}, (app) => {
  const users = app.findCollectionByNameOrId("users");

  // valores por defecto de la colección base de PocketBase
  const name = users.fields.getByName("name");
  name.required = false;
  name.min = 0;
  name.max = 255;

  const avatar = users.fields.getByName("avatar");
  avatar.maxSize = 0;
  avatar.mimeTypes = ["image/jpeg", "image/png", "image/svg+xml", "image/gif", "image/webp"];
  avatar.thumbs = null;

  users.fields.removeByName("color");
  users.fields.removeByName("status");

  users.listRule = "id = @request.auth.id";
  users.viewRule = "id = @request.auth.id";
  users.updateRule = "id = @request.auth.id";
  users.deleteRule = "id = @request.auth.id";

  app.save(users);
});
