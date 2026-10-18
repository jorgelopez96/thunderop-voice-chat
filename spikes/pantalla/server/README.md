# Servidor LiveKit local (prueba)

1. Bajar `livekit_1.13.10_windows_amd64.zip` de https://github.com/livekit/livekit/releases/tag/v1.13.10 y descomprimirlo en esta carpeta. El `.exe` no se commitea.
2. Arrancar: `./livekit-server.exe --dev --bind 127.0.0.1` (escucha en el puerto 7880; credenciales `devkey` / `secret`).
3. En otra terminal, desde `spikes/pantalla`: `node scripts/token-server.mjs` (tokens en el puerto 7890).
