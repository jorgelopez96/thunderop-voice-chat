/// <reference path="../pb_data/types.d.ts" />
// Tope de códigos emitidos por cuenta y tipo: `emitidos` cuenta dentro de una ventana de 1 hora que empieza en `ventana`.
migrate((app) => {
  const codigos = app.findCollectionByNameOrId("codigos");
  codigos.fields.add(new NumberField({ name: "emitidos", onlyInt: true }));
  codigos.fields.add(new DateField({ name: "ventana" }));
  app.save(codigos);
}, (app) => {
  const codigos = app.findCollectionByNameOrId("codigos");
  codigos.fields.removeByName("emitidos");
  codigos.fields.removeByName("ventana");
  app.save(codigos);
});
