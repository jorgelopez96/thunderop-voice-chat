/// <reference path="../pb_data/types.d.ts" />
// La cola pasa a ordenarse por `orden` (para poder reordenarla): numera lo que ya hay en cada sala según el orden de antes (created, orden).
migrate((app) => {
  app.db().newQuery(`UPDATE canciones SET orden = (SELECT n FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY room ORDER BY created, orden, id) - 1 AS n FROM canciones) r WHERE r.id = canciones.id)`).execute();
}, () => {});
