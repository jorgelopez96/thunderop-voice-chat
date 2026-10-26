/// <reference path="../pb_data/types.d.ts" />
// Cada uno puede crear varios grupos (antes uno solo por dueño). El tope de 10 lo pone el hook de grupos.pb.js.
migrate((app) => {
  const groups = app.findCollectionByNameOrId("groups");
  groups.indexes = ["CREATE INDEX idx_groups_owner ON groups (owner)"];
  app.save(groups);
}, (app) => {
  const groups = app.findCollectionByNameOrId("groups");
  groups.indexes = ["CREATE UNIQUE INDEX idx_groups_owner ON groups (owner)"];
  app.save(groups);
});
