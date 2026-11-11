/// <reference path="../pb_data/types.d.ts" />
// Hooks de `groups`: dueño/miembros forzados al crear + salas por defecto + el rol "Todos"; al editar, cada campo
// pide su permiso (pb_hooks/roles.js) y `members` solo puede achicarse y debe seguir incluyendo al dueño.
onRecordCreateRequest((e) => {
  const roles = require(`${__hooks}/roles.js`);
  // los superusers conservan los valores que mandan
  if (e.auth && e.auth.collection().name === "users") {
    if (e.app.countRecords("groups", $dbx.hashExp({ owner: e.auth.id })) >= 10) throw new BadRequestError("Llegaste al máximo de 10 grupos creados.");
    e.record.set("owner", e.auth.id);
    e.record.set("members", [e.auth.id]);
    e.record.set("ingresos", { [e.auth.id]: new Date().toISOString() });
    e.record.set("baneados", []);
    e.record.set("roles", [roles.ROL_TODOS()]);
    e.record.set("asignaciones", {});
    e.record.set("bloqueadosInfo", {});
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

// Qué permiso pide cambiar cada campo. `null`: solo el dueño. `false`: nadie (lo escribe el servidor).
// Un campo que no está acá también es solo del dueño.
onRecordUpdateRequest((e) => {
  if (!e.hasSuperuserAuth()) {
    const roles = require(`${__hooks}/roles.js`);
    const PIDE = {
      name: ["grupo", "editar el grupo"], descripcion: ["grupo", "editar el grupo"], foto: ["grupo", "editar el grupo"],
      chatsArriba: ["salas", "manejar las salas"], members: ["banear", "echar gente"],
      // Silenciar y bloquear van por sus rutas (que no dejan hacérselo a uno mismo): editarlos directo, solo el dueño.
      silenciados: null, bloqueados: null, roles: null, asignaciones: null, ingresos: false, baneados: false, bloqueadosInfo: false,
    };
    const antes = e.record.original();
    const owner = antes.getString("owner");
    const valor = (r, n) => { try { return JSON.stringify(r.get(n)); } catch (_) { return r.getString(n); } };
    const cambiados = e.record.collection().fields.map((f) => f.getName())
      .filter((n) => !["id", "created", "updated", "owner"].includes(n) && valor(e.record, n) !== valor(antes, n));
    for (const n of cambiados) {
      const p = PIDE[n];
      if (p === false) throw new ForbiddenError("Eso lo maneja el servidor.");
      if (e.auth.id === owner) continue;
      if (!p) throw new ForbiddenError("Eso solo lo puede cambiar el admin del grupo.");
      roles.exigir(antes, e.auth.id, p[0], p[1]);
    }

    const miembrosAntes = antes.getStringSlice("members");
    const despues = e.record.getStringSlice("members");
    if (!despues.every((id) => miembrosAntes.includes(id))) {
      throw new BadRequestError("No se pueden agregar miembros directamente.");
    }
    if (!despues.includes(owner)) throw new BadRequestError("El dueño debe seguir siendo miembro.");
    // Nadie silencia ni bloquea al admin.
    if (["silenciados", "bloqueados"].some((c) => e.record.getStringSlice(c).includes(owner) && !antes.getStringSlice(c).includes(owner))) {
      throw new ForbiddenError("No podés hacerle esto al admin del grupo.");
    }
    if (cambiados.includes("roles")) {
      const err = roles.validarRoles(roles.json(e.record, "roles", null));
      if (err) throw new BadRequestError(err);
    }
    if (cambiados.includes("asignaciones")) {
      const err = roles.validarAsignaciones(roles.json(e.record, "asignaciones", null), despues);
      if (err) throw new BadRequestError(err);
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
  // Quien sale pierde también sus roles y su registro de bloqueo de voz (si vuelve, vuelve sin roles).
  const roles = require(`${__hooks}/roles.js`);
  const silenciados = e.record.getStringSlice("silenciados");
  const asig = roles.json(e.record, "asignaciones", {});
  const info = roles.json(e.record, "bloqueadosInfo", {});
  if (silenciados.some((u) => fuera.includes(u)) || fuera.some((u) => u in asig || u in info)) {
    // este save vuelve a disparar el hook, pero sin cambio de members no hace nada
    const g = e.app.findRecordById("groups", e.record.id);
    g.set("silenciados", silenciados.filter((u) => !fuera.includes(u)));
    fuera.forEach((u) => { delete asig[u]; delete info[u]; });
    g.set("asignaciones", asig);
    g.set("bloqueadosInfo", info);
    e.app.save(g);
  }
  e.next();
}, "groups");

// Admin o quien tenga "banear": banea (lo echa y no puede volver a entrar con invitaciones) o desbanea.
routerAdd("POST", "/api/groups/{id}/banear", (e) => {
  const lk = require(`${__hooks}/livekit.js`);
  const body = e.requestInfo().body;
  if (typeof body.baneado !== "boolean") throw new BadRequestError("Falta baneado.");
  let group, user;
  if (body.baneado) ({ group, user } = lk.moderar(e, "banear", "banear"));
  else {
    // El baneado ya no es miembro: no pasa por moderar.
    group = lk.grupoDeMiembro(e.app, e.request.pathValue("id"), e.auth.id);
    require(`${__hooks}/roles.js`).exigir(group, e.auth.id, "banear", "desbanear");
    user = String(body.user || "");
  }
  const lista = (JSON.parse(group.getString("baneados") || "null") || []).filter((b) => b.id !== user);
  if (body.baneado) {
    const u = e.app.findRecordById("users", user);
    lista.push({ id: user, name: u.getString("name"), username: u.getString("username"), fecha: new Date().toISOString(), por: e.auth.id });
    group.set("members", group.getStringSlice("members").filter((m) => m !== user));
  }
  group.set("baneados", lista);
  e.app.save(group);
  return e.json(200, { ok: true });
}, $apis.requireAuth("users"));
