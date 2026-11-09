/// <reference path="../pb_data/types.d.ts" />
// Foto del grupo hasta 5 MB (antes 2), igual que la de perfil: para poder poner GIFs animados.
migrate((app) => {
  const groups = app.findCollectionByNameOrId("groups");
  groups.fields.getByName("foto").maxSize = 5 * 1024 * 1024;
  app.save(groups);
}, (app) => {
  const groups = app.findCollectionByNameOrId("groups");
  groups.fields.getByName("foto").maxSize = 2 * 1024 * 1024;
  app.save(groups);
});
