/// <reference path="../pb_data/types.d.ts" />
// Las canciones de una lista se guardan en el mismo milisegundo: `orden` desempata dentro de la tanda (cola = created, orden).
migrate((app) => {
  const canciones = app.findCollectionByNameOrId("canciones");
  canciones.fields.add(new NumberField({ name: "orden", onlyInt: true }));
  app.save(canciones);
}, (app) => {
  const canciones = app.findCollectionByNameOrId("canciones");
  canciones.fields.removeByName("orden");
  app.save(canciones);
});
