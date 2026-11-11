/// <reference path="../pb_data/types.d.ts" />
// Hooks de `invites` + rutas para unirse y salir de un grupo.
onRecordCreateRequest((e) => {
  const esUsuario = e.auth && e.auth.collection().name === "users";
  if (esUsuario) e.record.set("created_by", e.auth.id);
  // los usuarios nunca eligen código ni vencimiento; los superusers pueden, o se generan si faltan
  if (esUsuario || !e.record.getString("code")) {
    e.record.set("code", $security.randomStringWithAlphabet(10, "abcdefghijklmnopqrstuvwxyz0123456789"));
  }
  if (esUsuario || e.record.getString("expires") === "") {
    e.record.set("expires", new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().replace("T", " "));
  }
  e.next();
}, "invites");

routerAdd("POST", "/api/invites/join", (e) => {
  const code = (e.requestInfo().body.code || "").toString();
  let invite;
  try {
    invite = e.app.findFirstRecordByFilter("invites", "code = {:code} && expires > @now", { code });
  } catch (_) {
    throw new NotFoundError("Invitación inválida o vencida.");
  }
  const group = e.app.findRecordById("groups", invite.getString("group"));
  if ((JSON.parse(group.getString("baneados") || "null") || []).some((b) => b.id === e.auth.id)) {
    throw new ForbiddenError("No podés entrar a este grupo.");
  }
  // En una transacción y releyendo: dos que entran a la vez no se pisan (antes podía quedar uno solo).
  e.app.runInTransaction((tx) => {
    const g = tx.findRecordById("groups", group.id);
    const members = g.getStringSlice("members");
    if (members.includes(e.auth.id)) return;
    if (members.length >= 50) throw new BadRequestError("El grupo está lleno.");
    const ingresos = JSON.parse(g.getString("ingresos") || "null") || {};
    ingresos[e.auth.id] = new Date().toISOString();
    g.set("members", [...members, e.auth.id]);
    g.set("ingresos", ingresos);
    tx.save(g);
  });
  return e.json(200, { group: group.id });
}, $apis.requireAuth());

routerAdd("POST", "/api/groups/{id}/leave", (e) => {
  let group;
  try {
    group = e.app.findRecordById("groups", e.request.pathValue("id"));
  } catch (_) {
    throw new NotFoundError("Grupo no encontrado.");
  }
  const members = group.getStringSlice("members");
  if (!members.includes(e.auth.id)) throw new NotFoundError("Grupo no encontrado.");
  if (group.getString("owner") === e.auth.id) throw new BadRequestError("El dueño no puede salir: borrá el grupo.");
  e.app.runInTransaction((tx) => {
    const g = tx.findRecordById("groups", group.id);
    g.set("members", g.getStringSlice("members").filter((m) => m !== e.auth.id));
    tx.save(g);
  });
  return e.json(200, { ok: true });
}, $apis.requireAuth());

// Lo que muestra la tarjeta de una invitación en el chat: el grupo (nombre, foto, cuántos son) y si ya sos parte.
// Quien tiene el código igual puede entrar: mostrar el nombre antes no abre nada nuevo. Vencida o inventada: 404.
routerAdd("GET", "/api/invites/{code}/vista", (e) => {
  const code = String(e.request.pathValue("code") || "").trim().toLowerCase();
  let invite;
  try {
    invite = e.app.findFirstRecordByFilter("invites", "code = {:code} && expires > @now", { code });
  } catch (_) {
    throw new NotFoundError("La invitación venció o no existe.");
  }
  const g = e.app.findRecordById("groups", invite.getString("group"));
  const foto = g.getString("foto");
  return e.json(200, {
    grupo: { id: g.id, name: g.getString("name"), miembros: g.getStringSlice("members").length, foto: foto ? `/api/files/${g.collection().id}/${g.id}/${foto}` : "" },
    miembro: g.getStringSlice("members").includes(e.auth.id),
  });
}, $apis.requireAuth("users"));
