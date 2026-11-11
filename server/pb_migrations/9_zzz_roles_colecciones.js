/// <reference path="../pb_data/types.d.ts" />
// Con roles, salas, mensajes ajenos y sonidos pasan a pedir permiso en pb_hooks/permisos.pb.js: las reglas solo
// exigen ser miembro del grupo.
const MIEMBRO = "group.members.id ?= @request.auth.id";

migrate((app) => {
  const rooms = app.findCollectionByNameOrId("rooms");
  rooms.createRule = MIEMBRO;
  rooms.updateRule = `${MIEMBRO} && @request.body.group:isset = false`;
  rooms.deleteRule = MIEMBRO;
  app.save(rooms);

  const messages = app.findCollectionByNameOrId("messages");
  messages.deleteRule = "room.group.members.id ?= @request.auth.id";
  app.save(messages);

  const sonidos = app.findCollectionByNameOrId("sonidos");
  sonidos.updateRule = `${MIEMBRO} && @request.body.file:isset = false && @request.body.group:isset = false && @request.body.owner:isset = false`;
  sonidos.deleteRule = MIEMBRO;
  app.save(sonidos);
}, (app) => {
  const rooms = app.findCollectionByNameOrId("rooms");
  rooms.createRule = "group.owner = @request.auth.id";
  rooms.updateRule = "group.owner = @request.auth.id && @request.body.group:isset = false";
  rooms.deleteRule = "group.owner = @request.auth.id";
  app.save(rooms);

  const messages = app.findCollectionByNameOrId("messages");
  messages.deleteRule = "author = @request.auth.id || room.group.owner = @request.auth.id";
  app.save(messages);

  const sonidos = app.findCollectionByNameOrId("sonidos");
  sonidos.updateRule = "(owner = @request.auth.id || group.owner = @request.auth.id)"
    + " && @request.body.file:isset = false && @request.body.group:isset = false && @request.body.owner:isset = false";
  sonidos.deleteRule = "owner = @request.auth.id || group.owner = @request.auth.id";
  app.save(sonidos);
});
