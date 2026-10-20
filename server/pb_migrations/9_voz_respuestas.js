/// <reference path="../pb_data/types.d.ts" />
// Responder un mensaje: `respondeA` apunta a otro mensaje de la misma sala (o del mismo privado). Lo valida messages.pb.js.
// Si se borra el original, la respuesta queda sin cita (no se borra en cascada).
migrate((app) => {
  for (const nombre of ["messages", "privados"]) {
    const col = app.findCollectionByNameOrId(nombre);
    col.fields.add(new RelationField({ name: "respondeA", collectionId: col.id, maxSelect: 1, cascadeDelete: false }));
    app.save(col);
  }
}, (app) => {
  for (const nombre of ["messages", "privados"]) {
    const col = app.findCollectionByNameOrId(nombre);
    col.fields.removeByName("respondeA");
    app.save(col);
  }
});
