/// <reference path="../pb_data/types.d.ts" />
// Hooks de `groups`: dueño/miembros forzados al crear + salas por defecto; al editar,
// `members` solo puede achicarse y debe seguir incluyendo al dueño; `silenciados` solo lo cambia el dueño.
onRecordCreateRequest((e) => {
  // los superusers conservan los valores que mandan
  if (e.auth && e.auth.collection().name === "users") {
    e.record.set("owner", e.auth.id);
    e.record.set("members", [e.auth.id]);
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
  }
  e.next();
}, "groups");

// Quien sale o es echado (update del dueño o /leave) pierde sus invitaciones de ese grupo,
// sale de `silenciados` y es sacado de las salas de voz en LiveKit.
onRecordAfterUpdateSuccess((e) => {
  const lk = require(`${__hooks}/livekit.js`);
  const antes = e.record.original().getStringSlice("members");
  const despues = e.record.getStringSlice("members");
  const fuera = antes.filter((u) => !despues.includes(u));
  fuera.forEach((u) => {
    e.app.findRecordsByFilter("invites", "group = {:g} && created_by = {:u}", "", 0, 0, { g: e.record.id, u })
      .forEach((inv) => e.app.delete(inv));
    lk.enSalasDeVoz(e.app, e.record.id, "RemoveParticipant", { identity: u });
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
