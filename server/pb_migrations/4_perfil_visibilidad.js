/// <reference path="../pb_data/types.d.ts" />
// Perfiles visibles solo para uno mismo o compañeros de grupo (mismo registro de grupo).
// createRule "" = registro abierto (decisión del spec).
migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  users.listRule = null;
  users.createRule = "";
  users.viewRule = 'id = @request.auth.id || (@request.auth.id != "" && groups_via_members.members.id ?= @request.auth.id)';
  app.save(users);
}, (app) => {
  const users = app.findCollectionByNameOrId("users");
  users.createRule = "";
  users.viewRule = '@request.auth.id != ""';
  app.save(users);
});
