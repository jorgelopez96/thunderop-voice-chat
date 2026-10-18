/// <reference path="../pb_data/types.d.ts" />
// `invites`: código y vencimiento los pone el hook; rate limit para unirse y para mensajes.
migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  const groups = app.findCollectionByNameOrId("groups");

  const invites = new Collection({ type: "base", name: "invites" });
  invites.fields.add(new RelationField({ name: "group", required: true, collectionId: groups.id, maxSelect: 1, cascadeDelete: true }));
  invites.fields.add(new TextField({ name: "code", required: true }));
  invites.fields.add(new RelationField({ name: "created_by", required: true, collectionId: users.id, maxSelect: 1 }));
  invites.fields.add(new DateField({ name: "expires", required: true }));
  invites.indexes = ["CREATE UNIQUE INDEX idx_invites_code ON invites (code)"];
  invites.listRule = "group.members.id ?= @request.auth.id";
  invites.viewRule = "group.members.id ?= @request.auth.id";
  invites.createRule = "group.members.id ?= @request.auth.id";
  invites.updateRule = null;
  invites.deleteRule = "group.owner = @request.auth.id || created_by = @request.auth.id";
  app.save(invites);

  const settings = app.settings();
  settings.rateLimits.enabled = true;
  const rules = settings.rateLimits.rules.filter((r) => r.label !== "/api/invites/join" && r.label !== "messages:create");
  rules.push({ label: "/api/invites/join", maxRequests: 5, duration: 60 });
  rules.push({ label: "messages:create", maxRequests: 20, duration: 10 });
  settings.rateLimits.rules = rules;
  app.save(settings);
}, (app) => {
  app.delete(app.findCollectionByNameOrId("invites"));
});
