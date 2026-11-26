/// <reference path="../pb_data/types.d.ts" />
// Tarjeta de perfil: estado personalizado ("Jugando Fortnite"), portada, juegos favoritos, redes y cumpleaños visible.
// `cumple` (MM-DD) lo calcula perfil.pb.js desde `nacimiento` (oculto) cuando `mostrarCumple` está prendido: la edad nunca sale.
migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  users.fields.add(new TextField({ name: "actividad", max: 60 }));
  users.fields.add(new FileField({ name: "portada", maxSelect: 1, maxSize: 5 * 1024 * 1024,
    mimeTypes: ["image/png", "image/jpeg", "image/webp", "image/gif"], thumbs: ["600x200"] }));
  users.fields.add(new JSONField({ name: "juegos", maxSize: 1000 }));
  users.fields.add(new JSONField({ name: "redes", maxSize: 1000 }));
  users.fields.add(new BoolField({ name: "mostrarCumple" }));
  users.fields.add(new TextField({ name: "cumple", pattern: "^(\\d{2}-\\d{2})?$" }));
  app.save(users);
}, (app) => {
  const users = app.findCollectionByNameOrId("users");
  for (const c of ["actividad", "portada", "juegos", "redes", "mostrarCumple", "cumple"]) users.fields.removeByName(c);
  app.save(users);
});
