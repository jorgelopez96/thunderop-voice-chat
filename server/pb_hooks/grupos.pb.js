/// <reference path="../pb_data/types.d.ts" />
// Hooks de `groups`: dueño/miembros forzados al crear + salas por defecto; al editar,
// `members` solo puede achicarse y debe seguir incluyendo al dueño.
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
  }
  e.next();
}, "groups");

// Quien sale o es echado (update del dueño o /leave) pierde sus invitaciones de ese grupo.
onRecordAfterUpdateSuccess((e) => {
  const antes = e.record.original().getStringSlice("members");
  const despues = e.record.getStringSlice("members");
  antes.filter((u) => !despues.includes(u)).forEach((u) => {
    e.app.findRecordsByFilter("invites", "group = {:g} && created_by = {:u}", "", 0, 0, { g: e.record.id, u })
      .forEach((inv) => e.app.delete(inv));
  });
  e.next();
}, "groups");
