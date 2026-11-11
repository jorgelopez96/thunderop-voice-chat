// Roles y permisos de un grupo. El dueño (admin) puede todo; el resto suma los permisos del rol "todos" y de los
// roles que tenga en `asignaciones`. La misma lista de permisos está en app/src/lib/permisos.ts.

const PERMISOS = ["silenciar", "desconectar", "bloquearVoz", "banear", "mensajes", "grupo", "salas",
  "agregarMusica", "cola", "youtube", "subirSonidos", "botonera", "borrarSonidos"];
const MAX_ROLES = 20, MAX_NOMBRE = 24;
const ROL_TODOS = () => ({ id: "todos", nombre: "Todos", color: "", permisos: [] });

function json(group, campo, vacio) {
  try { return JSON.parse(group.getString(campo) || "null") || vacio; } catch (_) { return vacio; }
}

function permisosDe(group, userId) {
  if (group.getString("owner") === userId) return PERMISOS.slice();
  if (!group.getStringSlice("members").includes(userId)) return [];
  const roles = json(group, "roles", []);
  const mios = ["todos"].concat(json(group, "asignaciones", {})[userId] || []);
  const set = {};
  roles.filter((r) => r && mios.includes(r.id)).forEach((r) => (r.permisos || []).forEach((p) => { if (PERMISOS.includes(p)) set[p] = true; }));
  return Object.keys(set);
}

const puede = (group, userId, permiso) => permisosDe(group, userId).includes(permiso);

function exigir(group, userId, permiso, texto) {
  if (!puede(group, userId, permiso)) throw new ForbiddenError(`No tenés permiso para ${texto}.`);
}

// '' si `roles` es válido: "todos" primero e intacto (salvo sus permisos), hasta 20 más, nombres sin repetir, colores #rrggbb.
function validarRoles(roles) {
  if (!Array.isArray(roles) || !roles.length) return "Faltan los roles.";
  const t = roles[0];
  if (!t || t.id !== "todos" || t.nombre !== "Todos" || t.color !== "") return "El rol Todos no se puede borrar ni cambiar de nombre.";
  if (roles.length - 1 > MAX_ROLES) return `Puede haber hasta ${MAX_ROLES} roles.`;
  const nombres = {}, ids = {};
  for (let i = 0; i < roles.length; i++) {
    const r = roles[i];
    if (!r || typeof r !== "object") return "Rol inválido.";
    if (!Array.isArray(r.permisos) || r.permisos.some((p) => !PERMISOS.includes(p))) return "Permiso desconocido.";
    if (i === 0) continue;
    if (typeof r.id !== "string" || !/^[a-z0-9]{6,15}$/.test(r.id) || ids[r.id]) return "Rol inválido.";
    const nombre = typeof r.nombre === "string" ? r.nombre.trim() : "";
    if (!nombre || nombre.length > MAX_NOMBRE) return `El nombre del rol tiene que tener de 1 a ${MAX_NOMBRE} caracteres.`;
    if (nombre.toLowerCase() === "todos" || nombres[nombre.toLowerCase()]) return "Ya hay un rol con ese nombre.";
    if (typeof r.color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(r.color)) return "Color inválido.";
    nombres[nombre.toLowerCase()] = ids[r.id] = true;
  }
  return "";
}

// '' si cada clave es un miembro y cada valor una lista de ids (los que ya no existen se ignoran al calcular).
function validarAsignaciones(asig, members) {
  if (!asig || typeof asig !== "object" || Array.isArray(asig)) return "Asignaciones inválidas.";
  for (const u in asig) {
    if (!members.includes(u)) return "Solo se le pueden dar roles a miembros del grupo.";
    const l = asig[u];
    if (!Array.isArray(l) || l.length > MAX_ROLES || l.some((x) => typeof x !== "string" || x === "todos")) return "Asignaciones inválidas.";
  }
  return "";
}

/** Cada rol solo con sus cuatro campos (lo demás que mande alguien no se guarda). Llamar después de validarRoles. */
const limpiarRoles = (roles) => roles.map((r) => ({ id: r.id, nombre: r.id === "todos" ? "Todos" : r.nombre.trim(), color: r.color, permisos: r.permisos.slice() }));

module.exports = { limpiarRoles, PERMISOS, ROL_TODOS, json, permisosDe, puede, exigir, validarRoles, validarAsignaciones };
