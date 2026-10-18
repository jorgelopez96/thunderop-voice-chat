/// <reference path="../pb_data/types.d.ts" />
// `groups` (un grupo por dueño) y `rooms` (las salas por defecto las crea el hook).
migrate((app) => {
  const users = app.findCollectionByNameOrId("users");

  const groups = new Collection({ type: "base", name: "groups" });
  groups.fields.add(new TextField({ name: "name", required: true, min: 1, max: 40 }));
  groups.fields.add(new RelationField({ name: "owner", required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true }));
  groups.fields.add(new RelationField({ name: "members", collectionId: users.id, maxSelect: 50 }));
  groups.indexes = ["CREATE UNIQUE INDEX idx_groups_owner ON groups (owner)"];
  groups.listRule = "members.id ?= @request.auth.id";
  groups.viewRule = "members.id ?= @request.auth.id";
  groups.createRule = '@request.auth.id != ""';
  groups.updateRule = "owner = @request.auth.id && @request.body.owner:isset = false";
  groups.deleteRule = "owner = @request.auth.id";
  app.save(groups);

  const rooms = new Collection({ type: "base", name: "rooms" });
  rooms.fields.add(new RelationField({ name: "group", required: true, collectionId: groups.id, maxSelect: 1, cascadeDelete: true }));
  rooms.fields.add(new TextField({ name: "name", required: true, min: 1, max: 40 }));
  rooms.fields.add(new SelectField({ name: "kind", required: true, maxSelect: 1, values: ["voz", "chat"] }));
  rooms.fields.add(new NumberField({ name: "position" }));
  rooms.listRule = "group.members.id ?= @request.auth.id";
  rooms.viewRule = "group.members.id ?= @request.auth.id";
  rooms.createRule = "group.owner = @request.auth.id";
  rooms.updateRule = "group.owner = @request.auth.id && @request.body.group:isset = false";
  rooms.deleteRule = "group.owner = @request.auth.id";
  app.save(rooms);
}, (app) => {
  app.delete(app.findCollectionByNameOrId("rooms"));
  app.delete(app.findCollectionByNameOrId("groups"));
});
