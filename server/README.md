# Servidor (PocketBase 0.40.5)

- `npm install` y `node scripts/descargar-pocketbase.mjs` (deja `pocketbase.exe`, no se commitea).
- `.\pocketbase.exe serve --migrationsDir pb_migrations --hooksDir pb_hooks` -> http://127.0.0.1:8090
- Datos: carpeta `pb_data/` (copiarla para mudar el servidor).
- Tests: `npm test` (levanta una instancia temporal en `.tmp/` por suite).
