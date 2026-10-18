/// <reference path="../pb_data/types.d.ts" />
// Tope de 50 sonidos por grupo.
onRecordCreateRequest((e) => {
  if ($app.countRecords("sonidos", $dbx.hashExp({ group: e.record.getString("group") })) >= 50) {
    throw new BadRequestError("El grupo ya tiene 50 sonidos.");
  }
  e.next();
}, "sonidos");
