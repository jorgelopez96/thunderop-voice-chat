/// <reference path="../pb_data/types.d.ts" />
// `groups.bloqueados`: miembros que el dueño sacó de la voz y no pueden volver a entrar hasta que los deje (solo lo cambia el dueño).
migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  const groups = app.findCollectionByNameOrId("groups");
  groups.fields.add(new RelationField({ name: "bloqueados", collectionId: users.id, maxSelect: 50 }));
  app.save(groups);
}, (app) => {
  const groups = app.findCollectionByNameOrId("groups");
  groups.fields.removeByName("bloqueados");
  app.save(groups);
});
