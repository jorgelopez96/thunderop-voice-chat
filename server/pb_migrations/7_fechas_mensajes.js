/// <reference path="../pb_data/types.d.ts" />
// `messages.created`: PocketBase >= 0.23 no lo crea solo; hace falta un AutodateField explícito.
migrate((app) => {
  const messages = app.findCollectionByNameOrId("messages");
  messages.fields.add(new AutodateField({ name: "created", onCreate: true, onUpdate: false }));
  app.save(messages);
}, (app) => {
  const messages = app.findCollectionByNameOrId("messages");
  messages.fields.removeByName("created");
  app.save(messages);
});
