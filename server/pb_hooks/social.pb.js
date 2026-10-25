/// <reference path="../pb_data/types.d.ts" />
// Hooks sociales. `fundador` solo lo cambia un superuser (panel de PocketBase).
// Latido: el cliente lo manda cada 45 s; en línea = `visto` de hace menos de 90 s.
onRecordCreateRequest((e) => {
  if (!e.hasSuperuserAuth()) e.record.set("fundador", false);
  e.next();
}, "users");

onRecordUpdateRequest((e) => {
  if (!e.hasSuperuserAuth()) {
    e.record.set("fundador", e.record.original().getBool("fundador"));
    e.record.set("visto", e.record.original().get("visto")); // solo lo cambia el latido
    if (e.record.getString("disponibilidad") === "invisible") e.record.set("visto", ""); // se ve desconectado al instante
  }
  e.next();
}, "users");

routerAdd("POST", "/api/latido", (e) => {
  const u = e.app.findRecordById("users", e.auth.id);
  if (u.getString("disponibilidad") === "invisible" || u.getBool("desactivada")) return e.json(200, { visto: "" });
  u.set("visto", new DateTime());
  e.app.saveNoValidate(u);
  return e.json(200, { visto: u.getString("visto") });
}, $apis.requireAuth("users"));

// Solicitud de amistad por usuario (normalizado) o id. Si el otro ya me la había pedido, la acepta.
// En una transacción: dos solicitudes cruzadas a la vez dejan una sola amistad.
routerAdd("POST", "/api/amigos/solicitar", (e) => {
  const body = e.requestInfo().body;
  const yo = e.auth.id;
  let otro = null;
  try {
    if (typeof body.usuario === "string" && body.usuario) otro = e.app.findRecordById("users", body.usuario);
    else if (typeof body.username === "string" && body.username.trim()) {
      const { normalizarUsuario } = require(`${__hooks}/reglas.js`);
      otro = e.app.findFirstRecordByData("users", "username", normalizarUsuario(body.username));
    }
  } catch { otro = null; } // no existe
  if (!otro) throw new NotFoundError("No hay nadie con ese usuario.");
  if (otro.id === yo) throw new BadRequestError("No te podés agregar a vos mismo.");
  if (otro.getBool("desactivada")) throw new BadRequestError("Esa cuenta está desactivada.");
  const { bloqueo } = require(`${__hooks}/reglas.js`);
  if (bloqueo(e.app, yo, otro.id)) throw new BadRequestError("No podés agregar a esta persona.");

  let amistad = null;
  e.app.runInTransaction((tx) => {
    const buscar = (de, para) => {
      try { return tx.findFirstRecordByFilter("amistades", "de = {:de} && para = {:para}", { de, para }); } catch { return null; }
    };
    const mia = buscar(yo, otro.id), suya = buscar(otro.id, yo);
    const existente = mia || suya;
    if (existente && existente.getString("estado") === "aceptada") throw new BadRequestError("Ya son amigos.");
    if (mia) throw new BadRequestError("Ya le mandaste una solicitud.");
    if (suya) {
      suya.set("estado", "aceptada");
      tx.save(suya);
      amistad = suya;
      return;
    }
    amistad = new Record(tx.findCollectionByNameOrId("amistades"));
    amistad.set("de", yo);
    amistad.set("para", otro.id);
    amistad.set("estado", "pendiente");
    tx.save(amistad);
  });
  return e.json(200, { amistad });
}, $apis.requireAuth("users"));

// Privados: solo entre amigos (aceptada, en cualquier sentido) y con texto o archivo. Sin amistad el historial queda.
onRecordCreateRequest((e) => {
  if (!e.hasSuperuserAuth()) {
    const yo = e.record.getString("author"), otro = e.record.getString("para");
    let amigos = false;
    try {
      e.app.findFirstRecordByFilter("amistades",
        "estado = 'aceptada' && ((de = {:yo} && para = {:otro}) || (de = {:otro} && para = {:yo}))", { yo, otro });
      amigos = true;
    } catch { /* no son amigos */ }
    if (!amigos) throw new ForbiddenError("Solo podés escribirle a tus amigos.");
    if (e.record.getString("text").trim() === "" && e.record.getUnsavedFiles("file").length === 0) {
      throw new BadRequestError("El mensaje necesita texto o un archivo.");
    }
  }
  e.next();
}, "privados");

// Bloquear: borra la amistad (en cualquier estado) y lo anota en `bloqueados` del que bloquea.
// Sin amistad ya no hay privados; `/api/amigos/solicitar` rechaza en los dos sentidos. `bloquear: false` desbloquea.
routerAdd("POST", "/api/amigos/bloquear", (e) => {
  const body = e.requestInfo().body;
  const yo = e.auth.id;
  if (typeof body.usuario !== "string" || typeof body.bloquear !== "boolean") throw new BadRequestError("Faltan datos: usuario y bloquear.");
  if (body.usuario === yo) throw new BadRequestError("No te podés bloquear a vos mismo.");
  e.app.runInTransaction((tx) => {
    const u = tx.findRecordById("users", yo);
    let lista = [];
    try { lista = JSON.parse(u.getString("bloqueados") || "[]") || []; } catch { lista = []; }
    lista = lista.filter((b) => b.id !== body.usuario);
    if (body.bloquear) {
      let otro;
      try { otro = tx.findRecordById("users", body.usuario); } catch { throw new NotFoundError("No existe ese usuario."); }
      lista.push({ id: otro.id, name: otro.getString("name"), username: otro.getString("username"), fecha: new DateTime().string() });
      tx.findRecordsByFilter("amistades", "(de = {:yo} && para = {:otro}) || (de = {:otro} && para = {:yo})", "", 0, 0, { yo, otro: otro.id })
        .forEach((a) => tx.delete(a));
    }
    u.set("bloqueados", lista);
    tx.saveNoValidate(u);
  });
  return e.json(200, { ok: true });
}, $apis.requireAuth("users"));

routerAdd("GET", "/api/amigos/bloqueados", (e) => {
  const u = e.app.findRecordById("users", e.auth.id);
  let lista = [];
  try { lista = JSON.parse(u.getString("bloqueados") || "[]") || []; } catch { lista = []; }
  return e.json(200, lista);
}, $apis.requireAuth("users"));
