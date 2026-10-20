/// <reference path="../pb_data/types.d.ts" />
// Reacciones con emoji en `messages` y `privados`: { "👍": ["idUsuario", ...] }. Solo las cambia /api/reaccionar.
// Se llama 9_social_* para correr después de 9_social.js, que crea `privados`.
migrate((app) => {
  for (const nombre of ["messages", "privados"]) {
    const col = app.findCollectionByNameOrId(nombre);
    col.fields.add(new JSONField({ name: "reacciones", maxSize: 20000 }));
    app.save(col);
  }
  const settings = app.settings();
  settings.rateLimits.rules = settings.rateLimits.rules.filter((r) => r.label !== "/api/reaccionar");
  settings.rateLimits.rules.push({ label: "/api/reaccionar", maxRequests: 30, duration: 10 });
  app.save(settings);
}, (app) => {
  for (const nombre of ["messages", "privados"]) {
    const col = app.findCollectionByNameOrId(nombre);
    col.fields.removeByName("reacciones");
    app.save(col);
  }
});
