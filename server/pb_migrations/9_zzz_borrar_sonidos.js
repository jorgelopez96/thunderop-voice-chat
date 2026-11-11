/// <reference path="../pb_data/types.d.ts" />
// Permiso nuevo "borrarSonidos" (antes borrar iba con "botonera"): los roles que ya tenían "botonera" lo reciben,
// así nadie pierde lo que podía hacer.
migrate((app) => {
  for (const g of app.findRecordsByFilter("groups", "id != ''", "", 0, 0)) {
    let roles;
    try { roles = JSON.parse(g.getString("roles") || "[]"); } catch (_) { continue; }
    let cambio = false;
    for (const r of roles) if (r && Array.isArray(r.permisos) && r.permisos.includes("botonera") && !r.permisos.includes("borrarSonidos")) { r.permisos.push("borrarSonidos"); cambio = true; }
    if (cambio) { g.set("roles", roles); app.saveNoValidate(g); }
  }
}, () => {});
