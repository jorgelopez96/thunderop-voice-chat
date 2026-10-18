/// <reference path="../pb_data/types.d.ts" />
// `messages`: texto y/o un archivo (imagen o video, 25 MB). Los límites de frecuencia ya están en 3_invites.js.
migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  const rooms = app.findCollectionByNameOrId("rooms");

  const messages = new Collection({ type: "base", name: "messages" });
  messages.fields.add(new RelationField({ name: "room", required: true, collectionId: rooms.id, maxSelect: 1, cascadeDelete: true }));
  messages.fields.add(new RelationField({ name: "author", required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true }));
  messages.fields.add(new TextField({ name: "text", max: 2000 }));
  messages.fields.add(new FileField({
    name: "file", maxSelect: 1, maxSize: 25 * 1024 * 1024,
    mimeTypes: ["image/png", "image/jpeg", "image/gif", "image/webp", "video/mp4", "video/webm"],
  }));
  messages.listRule = "room.group.members.id ?= @request.auth.id";
  messages.viewRule = "room.group.members.id ?= @request.auth.id";
  messages.createRule = 'room.group.members.id ?= @request.auth.id && room.kind = "chat" && @request.body.author = @request.auth.id';
  messages.updateRule = null;
  messages.deleteRule = "author = @request.auth.id || room.group.owner = @request.auth.id";
  app.save(messages);
}, (app) => {
  app.delete(app.findCollectionByNameOrId("messages"));
});
