/// <reference path="../pb_data/types.d.ts" />
// `groups.silenciados`: miembros que no pueden publicar micrófono en voz (lo edita solo el dueño).
migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  const groups = app.findCollectionByNameOrId("groups");
  groups.fields.add(new RelationField({ name: "silenciados", collectionId: users.id, maxSelect: 50 }));
  app.save(groups);
}, (app) => {
  const groups = app.findCollectionByNameOrId("groups");
  groups.fields.removeByName("silenciados");
  app.save(groups);
});
