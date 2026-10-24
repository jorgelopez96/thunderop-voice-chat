/// <reference path="../pb_data/types.d.ts" />
// Diagnósticos de transmisión: el registro que la app sube cuando algo falla. Solo se crean (a nombre de uno mismo);
// leerlos es cosa del superusuario. El prefijo `9_zz_` va después de `9_zz_cuentas*` por el orden alfabético.
const LIMITE = { label: "diagnosticos:create", maxRequests: 3, duration: 60 };

migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  const diagnosticos = new Collection({ type: "base", name: "diagnosticos" });
  diagnosticos.fields.add(new RelationField({ name: "user", required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true }));
  diagnosticos.fields.add(new TextField({ name: "version", max: 20 }));
  diagnosticos.fields.add(new NumberField({ name: "codigo", onlyInt: true }));
  diagnosticos.fields.add(new TextField({ name: "contenido", max: 65536 }));
  diagnosticos.fields.add(new AutodateField({ name: "created", onCreate: true, onUpdate: false }));
  diagnosticos.createRule = '@request.auth.collectionName = "users" && @request.body.user = @request.auth.id';
  app.save(diagnosticos);

  const settings = app.settings();
  settings.rateLimits.enabled = true;
  settings.rateLimits.rules = settings.rateLimits.rules.filter((r) => r.label !== LIMITE.label).concat(LIMITE);
  app.save(settings);
}, (app) => {
  const settings = app.settings();
  settings.rateLimits.rules = settings.rateLimits.rules.filter((r) => r.label !== LIMITE.label);
  app.save(settings);
  app.delete(app.findCollectionByNameOrId("diagnosticos"));
});
