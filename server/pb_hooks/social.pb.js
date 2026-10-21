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
  if (u.getString("disponibilidad") === "invisible") return e.json(200, { visto: "" });
  u.set("visto", new DateTime());
  e.app.saveNoValidate(u);
  return e.json(200, { visto: u.getString("visto") });
}, $apis.requireAuth("users"));

// Solicitud de amistad por nombre (sin distinguir mayúsculas) o id. Si el otro ya me la había pedido, la acepta.
// En una transacción: dos solicitudes cruzadas a la vez dejan una sola amistad.
routerAdd("POST", "/api/amigos/solicitar", (e) => {
  const body = e.requestInfo().body;
  const yo = e.auth.id;
  let otro = null;
  try {
    if (typeof body.usuario === "string" && body.usuario) otro = e.app.findRecordById("users", body.usuario);
    else if (typeof body.nombre === "string" && body.nombre.trim()) {
      // Mismo criterio que el índice único (NOCASE): el `=` del filtro distingue mayúsculas.
      otro = new Record();
      e.app.recordQuery("users").andWhere($dbx.exp("name = {:n} COLLATE NOCASE", { n: body.nombre.trim() })).limit(1).one(otro);
    }
  } catch { otro = null; } // no existe
  if (!otro) throw new NotFoundError("No hay nadie con ese nombre.");
  if (otro.id === yo) throw new BadRequestError("No te podés agregar a vos mismo.");

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
