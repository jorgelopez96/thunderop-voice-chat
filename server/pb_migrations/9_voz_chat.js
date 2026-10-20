/// <reference path="../pb_data/types.d.ts" />
// Cada sala de voz tiene su propio chat: `messages` acepta salas de cualquier tipo.
migrate((app) => {
  const messages = app.findCollectionByNameOrId("messages");
  messages.createRule = 'room.group.members.id ?= @request.auth.id && @request.body.author = @request.auth.id';
  app.save(messages);
}, (app) => {
  const messages = app.findCollectionByNameOrId("messages");
  messages.createRule = 'room.group.members.id ?= @request.auth.id && room.kind = "chat" && @request.body.author = @request.auth.id';
  app.save(messages);
});
