/// <reference path="../pb_data/types.d.ts" />
// `users.bloqueados` ([{id, name, username, fecha}], oculto: solo lo leen y escriben las rutas de social.pb.js)
// y `groups.chatsArriba` (el dueño elige si los chats van antes que las salas de voz).
migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  users.fields.add(new JSONField({ name: "bloqueados", maxSize: 50000, hidden: true }));
  app.save(users);
  const groups = app.findCollectionByNameOrId("groups");
  groups.fields.add(new BoolField({ name: "chatsArriba" }));
  app.save(groups);
}, (app) => {
  const users = app.findCollectionByNameOrId("users");
  users.fields.removeByName("bloqueados");
  app.save(users);
  const groups = app.findCollectionByNameOrId("groups");
  groups.fields.removeByName("chatsArriba");
  app.save(groups);
});
