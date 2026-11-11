/// <reference path="../pb_data/types.d.ts" />
// `users.verificado`: la tilde azul al lado del nombre. Solo la prende un superuser (hook de social.pb.js).
migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  users.fields.add(new BoolField({ name: "verificado" }));
  app.save(users);
}, (app) => {
  const users = app.findCollectionByNameOrId("users");
  users.fields.removeByName("verificado");
  app.save(users);
});
