/// <reference path="../pb_data/types.d.ts" />
// Se llama 9_social_* para correr después de 9_social.js, que crea `privados`.
// Editar mensajes: solo el autor y solo el texto (lo controla el hook de messages.pb.js, que además marca `editado`).
migrate((app) => {
  const reglas = { messages: "author = @request.auth.id && room.group.members.id ?= @request.auth.id", privados: "author = @request.auth.id" };
  for (const [nombre, regla] of Object.entries(reglas)) {
    const col = app.findCollectionByNameOrId(nombre);
    col.fields.add(new DateField({ name: "editado" }));
    col.updateRule = regla;
    app.save(col);
  }
}, (app) => {
  for (const nombre of ["messages", "privados"]) {
    const col = app.findCollectionByNameOrId(nombre);
    col.fields.removeByName("editado");
    col.updateRule = null;
    app.save(col);
  }
});
