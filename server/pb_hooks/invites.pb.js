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
  const members = group.getStringSlice("members");
  if (!members.includes(e.auth.id)) {
    if (members.length >= 50) throw new BadRequestError("El grupo está lleno.");
    group.set("members", [...members, e.auth.id]);
    e.app.save(group);
  }
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
  group.set("members", members.filter((m) => m !== e.auth.id));
  e.app.save(group);
  return e.json(200, { ok: true });
}, $apis.requireAuth());
