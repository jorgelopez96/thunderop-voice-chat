/// <reference path="../pb_data/types.d.ts" />
// Con roles, cualquier miembro puede intentar editar el grupo: cada campo pide su permiso en el hook de grupos.pb.js.
migrate((app) => {
  const groups = app.findCollectionByNameOrId("groups");
  groups.updateRule = "members.id ?= @request.auth.id && @request.body.owner:isset = false";
  app.save(groups);
}, (app) => {
  const groups = app.findCollectionByNameOrId("groups");
  groups.updateRule = "owner = @request.auth.id && @request.body.owner:isset = false";
  app.save(groups);
});
