/// <reference path="../pb_data/types.d.ts" />
// Hooks de `groups`: dueño/miembros forzados al crear + salas por defecto; al editar,
// `members` solo puede achicarse y debe seguir incluyendo al dueño; `silenciados` solo lo cambia el dueño.
onRecordCreateRequest((e) => {
  // los superusers conservan los valores que mandan
  if (e.auth && e.auth.collection().name === "users") {
    if (e.app.countRecords("groups", $dbx.hashExp({ owner: e.auth.id })) >= 10) throw new BadRequestError("Llegaste al máximo de 10 grupos creados.");
    e.record.set("owner", e.auth.id);
    e.record.set("members", [e.auth.id]);
    e.record.set("ingresos", { [e.auth.id]: new Date().toISOString() });
    e.record.set("baneados", []);
  }
  e.next();

  const rooms = e.app.findCollectionByNameOrId("rooms");
  [["chat", 0], ["voz", 1]].forEach(([kind, position]) => {
    const r = new Record(rooms);
    r.set("group", e.record.id);
    r.set("name", "General");
    r.set("kind", kind);
    r.set("position", position);
    e.app.save(r);
  });
}, "groups");

onRecordUpdateRequest((e) => {
  if (!e.hasSuperuserAuth()) {
    const antes = e.record.original().getStringSlice("members");
    const despues = e.record.getStringSlice("members");
    if (!despues.every((id) => antes.includes(id))) {
      throw new BadRequestError("No se pueden agregar miembros directamente.");
    }
    if (!despues.includes(e.record.getString("owner"))) {
      throw new BadRequestError("El dueño debe seguir siendo miembro.");
    }
    const silenciados = (r) => JSON.stringify(r.getStringSlice("silenciados"));
    if (e.auth.id !== e.record.original().getString("owner") && silenciados(e.record) !== silenciados(e.record.original())) {
      throw new ForbiddenError("Solo el dueño puede silenciar.");
    }
    const bloqueados = (r) => JSON.stringify(r.getStringSlice("bloqueados"));
    if (e.auth.id !== e.record.original().getString("owner") && bloqueados(e.record) !== bloqueados(e.record.original())) {
      throw new ForbiddenError("Solo el dueño puede bloquear la voz.");
    }
    if (["ingresos", "baneados"].some((c) => e.record.getString(c) !== e.record.original().getString(c))) {
      throw new ForbiddenError("Eso lo maneja el servidor.");
    }
  }
  e.next();
}, "groups");

// Quien sale o es echado (update del dueño o /leave) pierde sus invitaciones de ese grupo,
// sale de `silenciados` y es sacado de las salas de voz en LiveKit (él y su transmisión).
onRecordAfterUpdateSuccess((e) => {
  const lk = require(`${__hooks}/livekit.js`);
  const antes = e.record.original().getStringSlice("members");
  const despues = e.record.getStringSlice("members");
  const fuera = antes.filter((u) => !despues.includes(u));
  fuera.forEach((u) => {
    e.app.findRecordsByFilter("invites", "group = {:g} && created_by = {:u}", "", 0, 0, { g: e.record.id, u })
      .forEach((inv) => e.app.delete(inv));
    lk.enSalasDeVoz(e.app, e.record.id, "RemoveParticipant", { identity: u });
    lk.enSalasDeVoz(e.app, e.record.id, "RemoveParticipant", { identity: `${u}.pantalla` });
  });
  const silenciados = e.record.getStringSlice("silenciados");
  if (silenciados.some((u) => fuera.includes(u))) {
    // este save vuelve a disparar el hook, pero sin cambio de members no hace nada
    const g = e.app.findRecordById("groups", e.record.id);
    g.set("silenciados", silenciados.filter((u) => !fuera.includes(u)));
    e.app.save(g);
  }
  e.next();
}, "groups");

// Dueño banea (lo echa y no puede volver a entrar con invitaciones) o desbanea.
routerAdd("POST", "/api/groups/{id}/banear", (e) => {
  const lk = require(`${__hooks}/livekit.js`);
  const body = e.requestInfo().body;
  if (typeof body.baneado !== "boolean") throw new BadRequestError("Falta baneado.");
  let group, user;
  if (body.baneado) ({ group, user } = lk.moderar(e));
  else {
    group = lk.grupoDeMiembro(e.app, e.request.pathValue("id"), e.auth.id);
    if (group.getString("owner") !== e.auth.id) throw new ForbiddenError("Solo el dueño puede hacer esto.");
    user = String(body.user || "");
  }
  const lista = (JSON.parse(group.getString("baneados") || "null") || []).filter((b) => b.id !== user);
  if (body.baneado) {
    const u = e.app.findRecordById("users", user);
    lista.push({ id: user, name: u.getString("name"), username: u.getString("username"), fecha: new Date().toISOString() });
    group.set("members", group.getStringSlice("members").filter((m) => m !== user));
  }
  group.set("baneados", lista);
  e.app.save(group);
  return e.json(200, { ok: true });
}, $apis.requireAuth("users"));
