/// <reference path="../pb_data/types.d.ts" />
// `canciones` (la cola de cada sala de voz, ordenada por `created`) y `reproducciones` (qué suena y desde cuándo, una por sala).
// Solo las escribe el hook de /api/rooms/{id}/musica; los miembros del grupo las leen.
// `pausaS` es JSON para poder ser null (un número de PocketBase vacío vale 0, y 0 es una pausa válida).
migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  const rooms = app.findCollectionByNameOrId("rooms");
  const miembro = "room.group.members.id ?= @request.auth.id";

  const canciones = new Collection({ type: "base", name: "canciones" });
  canciones.fields.add(new RelationField({ name: "room", required: true, collectionId: rooms.id, maxSelect: 1, cascadeDelete: true }));
  canciones.fields.add(new TextField({ name: "videoId", required: true, min: 11, max: 11, pattern: "^[A-Za-z0-9_-]+$" }));
  canciones.fields.add(new TextField({ name: "titulo", max: 200 }));
  canciones.fields.add(new RelationField({ name: "agregadoPor", collectionId: users.id, maxSelect: 1 }));
  canciones.fields.add(new SelectField({ name: "estado", required: true, maxSelect: 1, values: ["cola", "sonando", "hecha", "error"] }));
  canciones.fields.add(new AutodateField({ name: "created", onCreate: true }));
  canciones.listRule = miembro;
  canciones.viewRule = miembro;
  app.save(canciones);

  const reproducciones = new Collection({ type: "base", name: "reproducciones" });
  reproducciones.fields.add(new RelationField({ name: "room", required: true, collectionId: rooms.id, maxSelect: 1, cascadeDelete: true }));
  reproducciones.fields.add(new RelationField({ name: "actual", collectionId: canciones.id, maxSelect: 1 }));
  reproducciones.fields.add(new NumberField({ name: "inicioMs", onlyInt: true }));
  reproducciones.fields.add(new JSONField({ name: "pausaS", maxSize: 64 }));
  reproducciones.indexes = ["CREATE UNIQUE INDEX idx_reproducciones_room ON reproducciones (room)"];
  reproducciones.listRule = miembro;
  reproducciones.viewRule = miembro;
  app.save(reproducciones);
}, (app) => {
  app.delete(app.findCollectionByNameOrId("reproducciones"));
  app.delete(app.findCollectionByNameOrId("canciones"));
});
