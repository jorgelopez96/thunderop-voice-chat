/// <reference path="../pb_data/types.d.ts" />
// Perfil simple en `users`: nombre, avatar, color, estado + reglas.
migrate((app) => {
  const users = app.findCollectionByNameOrId("users");

  // `name` ya existe en la colección base: se reemplaza por uno requerido 1-32
  users.fields.removeByName("name");
  users.fields.removeByName("avatar");
  users.fields.add(new TextField({ name: "name", required: true, min: 1, max: 32 }));
  users.fields.add(new FileField({
    name: "avatar",
    maxSelect: 1,
    maxSize: 2 * 1024 * 1024,
    mimeTypes: ["image/png", "image/jpeg", "image/webp", "image/gif"],
    thumbs: ["64x64"],
  }));
  users.fields.add(new TextField({ name: "color", pattern: "^#[0-9a-f]{6}$" }));
  users.fields.add(new TextField({ name: "status", max: 80 }));

  users.listRule = null;
  users.viewRule = '@request.auth.id != ""';
  users.updateRule = "id = @request.auth.id";
  users.deleteRule = "id = @request.auth.id";

  app.save(users);
}, (app) => {
  const users = app.findCollectionByNameOrId("users");
  users.fields.removeByName("color");
  users.fields.removeByName("status");
  app.save(users);
});
