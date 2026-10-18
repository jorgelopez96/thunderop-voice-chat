# Servidor LiveKit local (prueba)

1. Bajar `livekit_1.13.10_windows_amd64.zip` de https://github.com/livekit/livekit/releases/tag/v1.13.10 y descomprimirlo en esta carpeta. El `.exe` no se commitea.
2. Generar un secreto aleatorio y usarlo en las dos terminales. No usar `devkey: secret`: es público y cualquier página web abierta podría firmar tokens y ver la pantalla.

   ```bash
   export LIVEKIT_KEYS="prueba: $(node -e "console.log(require('crypto').randomBytes(24).toString('hex'))")"
   ```
3. Arrancar: `./livekit-server.exe --bind 127.0.0.1 --keys "$LIVEKIT_KEYS"` (puerto 7880; TCP 7881; UDP 7882).
4. En otra terminal, con la misma `LIVEKIT_KEYS`, desde `spikes/pantalla`: `node scripts/token-server.mjs` (tokens en el puerto 7890; solo responde a `localhost:1420` y a la app).
