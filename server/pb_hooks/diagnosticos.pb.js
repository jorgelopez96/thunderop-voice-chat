/// <reference path="../pb_data/types.d.ts" />
// Diagnósticos de transmisión: tope por usuario y por hora (DIAGNOSTICOS_POR_HORA, 20 si no está) y limpieza diaria
// de los que pasaron DIAGNOSTICOS_DIAS días (30 si no está).
onRecordCreateRequest((e) => {
  if (!e.auth || e.hasSuperuserAuth()) return e.next();
  const max = parseInt($os.getenv("DIAGNOSTICOS_POR_HORA"), 10);
  const desde = new Date(Date.now() - 60 * 60 * 1000).toISOString().replace("T", " ");
  const ultimos = e.app.findRecordsByFilter("diagnosticos", "user = {:u} && created >= {:d}", "", 0, 0, { u: e.auth.id, d: desde }).length;
  if (ultimos >= (max >= 0 ? max : 20)) throw new TooManyRequestsError("Demasiados diagnósticos, probá más tarde.");
  e.next();
}, "diagnosticos");

cronAdd("diagnosticos-viejos", "0 4 * * *", () => {
  const d = parseFloat($os.getenv("DIAGNOSTICOS_DIAS"));
  const limite = new Date(Date.now() - (d >= 0 ? d : 30) * 24 * 60 * 60 * 1000).toISOString().replace("T", " ");
  for (const r of $app.findRecordsByFilter("diagnosticos", "created < {:l}", "", 0, 0, { l: limite })) {
    try { $app.delete(r); } catch (err) { $app.logger().error("diagnosticos-viejos", "id", r.id, "error", String(err)); }
  }
});
