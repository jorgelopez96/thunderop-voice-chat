/// <reference path="../pb_data/types.d.ts" />
// `sonidos`: la botonera del grupo. Audio de hasta 1 MB (la duración de 10 s se valida en el cliente); el tope de 50 por grupo está en el hook.
migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  const groups = app.findCollectionByNameOrId("groups");

  const sonidos = new Collection({ type: "base", name: "sonidos" });
  sonidos.fields.add(new RelationField({ name: "group", required: true, collectionId: groups.id, maxSelect: 1, cascadeDelete: true }));
  sonidos.fields.add(new TextField({ name: "name", required: true, min: 1, max: 32 }));
  sonidos.fields.add(new FileField({
    name: "file", required: true, maxSelect: 1, maxSize: 1024 * 1024,
    mimeTypes: ["audio/mpeg", "audio/ogg", "audio/wav", "audio/x-wav", "audio/webm"],
  }));
  sonidos.fields.add(new RelationField({ name: "owner", required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true }));
  sonidos.listRule = "group.members.id ?= @request.auth.id";
  sonidos.viewRule = "group.members.id ?= @request.auth.id";
  sonidos.createRule = "group.members.id ?= @request.auth.id && @request.body.owner = @request.auth.id";
  sonidos.updateRule = null;
  sonidos.deleteRule = "owner = @request.auth.id || group.owner = @request.auth.id";
  app.save(sonidos);
}, (app) => {
  app.delete(app.findCollectionByNameOrId("sonidos"));
});
