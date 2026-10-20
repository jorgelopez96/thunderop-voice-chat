/// <reference path="../pb_data/types.d.ts" />
// Social: nombre único sin distinguir mayúsculas (renombra repetidos: "tetu" → "tetu2") `users.fundador` `users.visto` (latido), amistades, privados y `groups.foto`.
migrate((app) => {
  const vistos = new Set();
  const users = app.findRecordsByFilter("users", "id != ''", "created", 0, 0);
  for (const u of users) {
    const base = u.getString("name");
    let nombre = base;
    for (let n = 2; vistos.has(nombre.toLowerCase()); n++) nombre = base.slice(0, 32 - String(n).length) + n;
    vistos.add(nombre.toLowerCase());
    if (nombre !== base) { u.set("name", nombre); app.saveNoValidate(u); }
  }

  const col = app.findCollectionByNameOrId("users");
  col.indexes.push("CREATE UNIQUE INDEX idx_users_name_nocase ON users (name COLLATE NOCASE)");
  col.fields.add(new BoolField({ name: "fundador" }));
  col.fields.add(new DateField({ name: "visto" }));
  col.authToken.duration = 30 * 24 * 3600; // "Recordar mi cuenta": 30 días sin abrir la app
  app.save(col);

  // Amistades: se crean solo por /api/amigos/solicitar; `para` acepta; cualquiera de los dos borra.
  const parte = 'de = @request.auth.id || para = @request.auth.id';
  const amistades = new Collection({ type: "base", name: "amistades" });
  amistades.fields.add(new RelationField({ name: "de", required: true, collectionId: col.id, maxSelect: 1, cascadeDelete: true }));
  amistades.fields.add(new RelationField({ name: "para", required: true, collectionId: col.id, maxSelect: 1, cascadeDelete: true }));
  amistades.fields.add(new SelectField({ name: "estado", required: true, maxSelect: 1, values: ["pendiente", "aceptada"] }));
  amistades.fields.add(new AutodateField({ name: "created", onCreate: true }));
  amistades.indexes = ["CREATE UNIQUE INDEX idx_amistades_par ON amistades (de, para)"];
  amistades.listRule = parte;
  amistades.viewRule = parte;
  amistades.createRule = null;
  amistades.updateRule = 'para = @request.auth.id && estado = "pendiente" && @request.body.estado = "aceptada" && @request.body.de:isset = false && @request.body.para:isset = false';
  amistades.deleteRule = parte;
  app.save(amistades);

  // Perfil visible para: uno mismo, compañeros de grupo, quien recibe la solicitud (la campanita muestra nombre y foto)
  // y los amigos. Quien pide no ve al otro hasta que acepta: escribir un nombre no revela perfiles.
  // El alias `:yo` hace que las tres condiciones apliquen a la misma fila de amistades.
  const perfiles = app.findCollectionByNameOrId("users");
  perfiles.viewRule = 'id = @request.auth.id || (@request.auth.id != "" && (groups_via_members.members.id ?= @request.auth.id || amistades_via_de.para ?= @request.auth.id || (@collection.amistades:yo.de ?= @request.auth.id && @collection.amistades:yo.para ?= id && @collection.amistades:yo.estado ?= "aceptada")))';
  // El realtime de `users` ('*', usado por la presencia) exige listRule: misma visibilidad que viewRule, nunca todos.
  perfiles.listRule = perfiles.viewRule;
  app.save(perfiles);

  // Privados: mismos campos que `messages` (sin sala) para reutilizar el chat. El hook exige amistad aceptada.
  const privados = new Collection({ type: "base", name: "privados" });
  privados.fields.add(new RelationField({ name: "author", required: true, collectionId: col.id, maxSelect: 1, cascadeDelete: true }));
  privados.fields.add(new RelationField({ name: "para", required: true, collectionId: col.id, maxSelect: 1, cascadeDelete: true }));
  privados.fields.add(new TextField({ name: "text", max: 2000 }));
  privados.fields.add(new FileField({
    name: "file", maxSelect: 1, maxSize: 25 * 1024 * 1024,
    mimeTypes: ["image/png", "image/jpeg", "image/gif", "image/webp", "video/mp4", "video/webm"],
  }));
  privados.fields.add(new AutodateField({ name: "created", onCreate: true, onUpdate: false }));
  privados.indexes = ["CREATE INDEX idx_privados_par ON privados (author, para, created)"];
  privados.listRule = "author = @request.auth.id || para = @request.auth.id";
  privados.viewRule = "author = @request.auth.id || para = @request.auth.id";
  privados.createRule = "@request.body.author = @request.auth.id";
  privados.updateRule = null;
  privados.deleteRule = "author = @request.auth.id";
  app.save(privados);

  const groups = app.findCollectionByNameOrId("groups");
  groups.fields.add(new FileField({ name: "foto", maxSelect: 1, maxSize: 2 * 1024 * 1024, mimeTypes: ["image/png", "image/jpeg", "image/webp", "image/gif"], thumbs: ["480x270"] }));
  app.save(groups);

  // Límites: privados como los mensajes; solicitar amistad acotado (responde distinto si el nombre existe).
  const settings = app.settings();
  const rules = settings.rateLimits.rules.filter((r) => r.label !== "privados:create" && r.label !== "/api/amigos/solicitar");
  rules.push({ label: "privados:create", maxRequests: 20, duration: 10 });
  rules.push({ label: "/api/amigos/solicitar", maxRequests: 10, duration: 60 });
  settings.rateLimits.rules = rules;
  app.save(settings);
}, (app) => {
  app.delete(app.findCollectionByNameOrId("privados"));
  const groups = app.findCollectionByNameOrId("groups");
  groups.fields.removeByName("foto");
  app.save(groups);
  app.delete(app.findCollectionByNameOrId("amistades"));
  const col = app.findCollectionByNameOrId("users");
  col.viewRule = 'id = @request.auth.id || (@request.auth.id != "" && groups_via_members.members.id ?= @request.auth.id)';
  col.listRule = null;
  col.indexes = col.indexes.filter((i) => !i.includes("idx_users_name_nocase"));
  col.fields.removeByName("fundador");
  col.fields.removeByName("visto");
  col.authToken.duration = 604800;
  app.save(col);
});
