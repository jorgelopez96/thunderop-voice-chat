/// <reference path="../pb_data/types.d.ts" />
// `videos`: el video de YouTube que mira la sala de voz junta (uno por sala). Solo lo escribe el hook de /api/rooms/{id}/youtube.
// `videoId` vacío = sin video. `pausaS` es JSON para poder ser null (igual que en `reproducciones`).
migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  const rooms = app.findCollectionByNameOrId("rooms");
  const miembro = "room.group.members.id ?= @request.auth.id";

  const videos = new Collection({ type: "base", name: "videos" });
  videos.fields.add(new RelationField({ name: "room", required: true, collectionId: rooms.id, maxSelect: 1, cascadeDelete: true }));
  videos.fields.add(new TextField({ name: "videoId", max: 11, pattern: "^[A-Za-z0-9_-]*$" }));
  videos.fields.add(new TextField({ name: "titulo", max: 200 }));
  videos.fields.add(new RelationField({ name: "puestoPor", collectionId: users.id, maxSelect: 1 }));
  videos.fields.add(new NumberField({ name: "inicioMs", onlyInt: true }));
  videos.fields.add(new JSONField({ name: "pausaS", maxSize: 64 }));
  videos.indexes = ["CREATE UNIQUE INDEX idx_videos_room ON videos (room)"];
  videos.listRule = miembro;
  videos.viewRule = miembro;
  app.save(videos);
}, (app) => {
  app.delete(app.findCollectionByNameOrId("videos"));
});
