/// <reference path="../pb_data/types.d.ts" />
// El mail es único sin distinguir mayúsculas (así PocketBase encuentra la cuenta aunque Google/Microsoft lo mande
// con otras mayúsculas) y se apaga el aviso en inglés de "inicio desde un lugar nuevo".
// PocketBase conserva el índice con este nombre porque sigue siendo único sobre la sola columna `email`.
const NOMBRE = "idx_email__pb_users_auth_";
const indice = (collate) => `CREATE UNIQUE INDEX \`${NOMBRE}\` ON \`users\` (\`email\`${collate}) WHERE \`email\` != ''`;

migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  users.indexes = users.indexes.filter((i) => !i.includes(NOMBRE)).concat([indice(" COLLATE NOCASE")]);
  users.authAlert.enabled = false;
  app.save(users);
}, (app) => {
  const users = app.findCollectionByNameOrId("users");
  users.indexes = users.indexes.filter((i) => !i.includes(NOMBRE)).concat([indice("")]);
  users.authAlert.enabled = true;
  app.save(users);
});
