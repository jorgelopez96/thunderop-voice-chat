/// <reference path="../pb_data/types.d.ts" />
// Un mensaje necesita texto o archivo (solo se exige a usuarios; los superusers pueden crear libremente).
onRecordCreateRequest((e) => {
  const esUsuario = e.auth && e.auth.collection().name === "users";
  if (esUsuario && e.record.getString("text").trim() === "" && e.record.getUnsavedFiles("file").length === 0) {
    throw new BadRequestError("El mensaje necesita texto o un archivo.");
  }
  e.next();
}, "messages");
