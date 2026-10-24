/// <reference path="../pb_data/types.d.ts" />
// Cuentas: usuario único y fijo (entra con usuario o mail), fecha de nacimiento oculta, invitación, versión de
// términos aceptada y colección `codigos` (códigos de mail, solo el servidor las toca). El nombre pasa a ser repetible.
// El prefijo `9_zz_` va último: PocketBase ordena por nombre y esto necesita `users` ya con todo lo anterior.
const CAMPOS = ["username", "nacimiento", "invitado", "terminos", "terminosFecha", "perfilCompleto"];
const LIMITES = [
  { label: "/api/cuenta/codigo", maxRequests: 3, duration: 60 },
  { label: "/api/cuenta/", maxRequests: 20, duration: 60 },
  { label: "/api/descarga/validar", maxRequests: 5, duration: 60 },
];

migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  users.fields.add(new TextField({ name: "username", required: true, pattern: "^[a-z0-9._]{3,20}$" }));
  users.fields.add(new DateField({ name: "nacimiento", hidden: true }));
  users.fields.add(new BoolField({ name: "invitado", hidden: true }));
  users.fields.add(new NumberField({ name: "terminos", onlyInt: true }));
  users.fields.add(new DateField({ name: "terminosFecha" }));
  users.fields.add(new BoolField({ name: "perfilCompleto" }));
  users.indexes = users.indexes.filter((i) => !i.includes("idx_users_name_nocase"));
  app.save(users);

  // Cuentas que ya existen: usuario sacado del nombre (sin repetir) y entran como invitadas, sin trabarse.
  const usados = new Set();
  for (const u of app.findRecordsByFilter("users", "id != ''", "created", 0, 0)) {
    const base = (u.getString("name").toLowerCase().replace(/[^a-z0-9._]/g, "") + "usuario").slice(0, 17);
    let username = base;
    for (let n = 2; usados.has(username); n++) username = base.slice(0, 20 - String(n).length) + n;
    usados.add(username);
    u.set("username", username);
    u.set("invitado", true);
    app.saveNoValidate(u);
  }

  const dueno = "id = @request.auth.id";
  users.indexes.push("CREATE UNIQUE INDEX idx_users_username ON users (username COLLATE NOCASE)");
  users.passwordAuth.identityFields = ["email", "username"];
  users.updateRule = dueno + CAMPOS.concat(["verified", "email"]).map((c) => ` && @request.body.${c}:isset = false`).join("");
  app.save(users);

  const codigos = new Collection({ type: "base", name: "codigos" });
  codigos.fields.add(new RelationField({ name: "user", required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true }));
  codigos.fields.add(new SelectField({ name: "tipo", required: true, maxSelect: 1, values: ["verificar", "restablecer"] }));
  codigos.fields.add(new TextField({ name: "hash" }));
  codigos.fields.add(new DateField({ name: "expira" }));
  codigos.fields.add(new NumberField({ name: "intentos", onlyInt: true }));
  // reglas en null: solo los hooks del servidor las leen y escriben
  app.save(codigos);

  const settings = app.settings();
  settings.rateLimits.enabled = true;
  settings.rateLimits.rules = settings.rateLimits.rules.filter((r) => !LIMITES.some((l) => l.label === r.label)).concat(LIMITES);
  app.save(settings);
}, (app) => {
  const settings = app.settings();
  settings.rateLimits.rules = settings.rateLimits.rules.filter((r) => !LIMITES.some((l) => l.label === r.label));
  app.save(settings);

  app.delete(app.findCollectionByNameOrId("codigos"));
  const users = app.findCollectionByNameOrId("users");
  users.updateRule = "id = @request.auth.id";
  users.passwordAuth.identityFields = ["email"];
  users.indexes = users.indexes.filter((i) => !i.includes("idx_users_username"));
  for (const c of CAMPOS) users.fields.removeByName(c);
  users.indexes.push("CREATE UNIQUE INDEX idx_users_name_nocase ON users (name COLLATE NOCASE)");
  app.save(users);
});
