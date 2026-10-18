/// <reference path="../pb_data/types.d.ts" />
// `invites.created_by` con cascadeDelete: borrar la cuenta de quien creó invitaciones ya no falla.
const poner = (valor) => (app) => {
  const invites = app.findCollectionByNameOrId("invites");
  invites.fields.getByName("created_by").cascadeDelete = valor;
  app.save(invites);
};
migrate(poner(true), poner(false));
