# Servidor (PocketBase 0.40.5)

- `npm install` y `node scripts/descargar.mjs` (deja `pocketbase.exe` y `livekit-server.exe`, no se commitean).
- `.\pocketbase.exe serve --migrationsDir pb_migrations --hooksDir pb_hooks` -> http://127.0.0.1:8090
- Datos: carpeta `pb_data/` (copiarla para mudar el servidor).
- Tests: `npm test` (levanta una instancia temporal en `.tmp/` por suite).
- Desarrollo con voz: `npm run dev` levanta LiveKit (7880) y PocketBase (8090); la primera vez crea `.env.local` con las claves de LiveKit (no se commitea). Ctrl+C cierra ambos.
