/// <reference path="../pb_data/types.d.ts" />
// `users.desactivada`: la cuenta se desactivó a pedido del dueño; vuelve a activarse sola al iniciar sesión.
migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  users.fields.add(new BoolField({ name: "desactivada" }));
  users.updateRule += " && @request.body.desactivada:isset = false";
  app.save(users);
}, (app) => {
  const users = app.findCollectionByNameOrId("users");
  users.fields.removeByName("desactivada");
  users.updateRule = users.updateRule.replace(" && @request.body.desactivada:isset = false", "");
  app.save(users);
});
