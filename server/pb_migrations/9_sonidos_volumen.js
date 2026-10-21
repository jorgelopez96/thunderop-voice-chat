/// <reference path="../pb_data/types.d.ts" />
// Volumen base de cada sonido (en %, lo elige quien lo sube; vacío = 100). Quien lo subió o el dueño del grupo
// pueden cambiarle el nombre y el volumen, nunca el archivo, el grupo ni el dueño.
migrate((app) => {
  const sonidos = app.findCollectionByNameOrId("sonidos");
  sonidos.fields.add(new NumberField({ name: "volumen", min: 5, max: 200, onlyInt: true }));
  sonidos.updateRule = "(owner = @request.auth.id || group.owner = @request.auth.id)"
    + " && @request.body.file:isset = false && @request.body.group:isset = false && @request.body.owner:isset = false";
  app.save(sonidos);
}, (app) => {
  const sonidos = app.findCollectionByNameOrId("sonidos");
  sonidos.fields.removeByName("volumen");
  sonidos.updateRule = null;
  app.save(sonidos);
});
