/// <reference path="../pb_data/types.d.ts" />
// Un mensaje necesita texto o archivo (solo se exige a usuarios; los superusers pueden crear libremente).
onRecordCreateRequest((e) => {
  const esUsuario = e.auth && e.auth.collection().name === "users";
  if (esUsuario && e.record.getString("text").trim() === "" && e.record.getUnsavedFiles("file").length === 0) {
    throw new BadRequestError("El mensaje necesita texto o un archivo.");
  }
  e.next();
}, "messages");

// Las reacciones arrancan vacías: solo las cambia /api/reaccionar.
onRecordCreateRequest((e) => {
  e.record.set("reacciones", {});
  e.next();
}, "messages", "privados");

// Pone o saca mi reacción. Puede reaccionar quien puede ver el mensaje; en una transacción para no pisar reacciones simultáneas.
routerAdd("POST", "/api/reaccionar", (e) => {
  const { coleccion, id, emoji } = e.requestInfo().body;
  if (coleccion !== "messages" && coleccion !== "privados") throw new BadRequestError("Colección inválida.");
  if (typeof emoji !== "string" || !emoji || emoji.length > 16) throw new BadRequestError("Emoji inválido.");
  const yo = e.auth.id;
  e.app.runInTransaction((tx) => {
    let m;
    try { m = tx.findRecordById(coleccion, id); } catch { throw new NotFoundError("El mensaje ya no existe."); }
    if (!tx.canAccessRecord(m, e.requestInfo(), m.collection().viewRule)) throw new NotFoundError("El mensaje ya no existe.");
    const r = JSON.parse(m.getString("reacciones") || "{}") || {};
    const lista = r[emoji] || [];
    if (lista.includes(yo)) r[emoji] = lista.filter((u) => u !== yo);
    else {
      if (!r[emoji] && Object.keys(r).length >= 20) throw new BadRequestError("Ya hay demasiadas reacciones distintas.");
      r[emoji] = [...lista, yo];
    }
    if (!r[emoji].length) delete r[emoji];
    m.set("reacciones", r);
    tx.saveNoValidate(m);
  });
  return e.json(200, {});
}, $apis.requireAuth("users"));

// Una respuesta solo puede citar un mensaje de la misma sala (messages) o de la misma conversación (privados).
onRecordCreateRequest((e) => {
  const id = e.record.getString("respondeA");
  if (id) {
    const col = e.record.collection().name;
    let o = null;
    try { o = e.app.findRecordById(col, id); } catch { o = null; }
    const par = (r) => [r.getString("author"), r.getString("para")].sort().join();
    const mismo = o && (col === "messages" ? o.getString("room") === e.record.getString("room") : par(o) === par(e.record));
    if (!mismo) throw new BadRequestError("El mensaje que respondés no está en este chat.");
  }
  e.next();
}, "messages", "privados");
