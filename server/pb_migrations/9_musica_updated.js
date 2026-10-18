/// <reference path="../pb_data/types.d.ts" />
// `canciones.updated`: la app muestra en la cola los temas con error de los últimos 10 minutos.
// (Corre después de 9_musica.js: "." ordena antes que "_".)
migrate((app) => {
  const c = app.findCollectionByNameOrId("canciones");
  c.fields.add(new AutodateField({ name: "updated", onCreate: true, onUpdate: true }));
  app.save(c);
}, (app) => {
  const c = app.findCollectionByNameOrId("canciones");
  c.fields.removeByName("updated");
  app.save(c);
});
