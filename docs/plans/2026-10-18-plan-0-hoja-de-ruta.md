# Hoja de ruta — App de voz para amigos

Spec: `docs/specs/2026-10-18-diseno-inicial.md`

El spec cubre varios subsistemas independientes. Por eso hay un plan por etapa, y cada etapa termina con algo que funciona y se puede probar. El plan detallado de cada etapa se escribe cuando termina la anterior, con lo que se aprendió.

| # | Etapa | Resultado verificable | Depende de |
|---|-------|-----------------------|------------|
| 1 | **Prueba técnica de pantalla compartida** (`plan-1`) | Informe con números: códec y codificador real, resolución y fps logrados, pérdida de FPS del juego y RAM de la app. Decisión: seguir con WebView2 o agregar módulo nativo. | — |
| 2 | Base: servidor PocketBase + app Tauri con cuentas, grupos (1 creado por usuario), invitaciones, salas y chat (texto, imágenes, videos cortos) y moderación del creador | Dos cuentas en un grupo chatean en tiempo real; el creador echa a alguien y borra un mensaje | 1 (para fijar el armazón de la app) |
| 3 | Voz: salas de voz con LiveKit, elección de entrada y salida, micrófono siempre abierto, RNNoise activable, volumen por persona, silenciar (creador) | 3 personas hablan en una sala; la supresión de ruido se nota al activarla | 2 |
| 4 | Pantalla compartida integrada (720p/1080p, 30/60) por el camino que decida la etapa 1 | Se transmite dentro de una sala de voz y se cumple el criterio de <10% de FPS | 1, 3 |
| 5 | Botonera (sonidos de ≤10 s) y música de YouTube sincronizada con cola compartida | Cola compartida: pausar, reanudar, saltar y quitar desde cualquier cliente; quien entra se engancha en el segundo correcto | 3 |
| 6 | Despliegue en Oracle Always Free (LiveKit + PocketBase + Caddy/TLS) y guía para el usuario | Los amigos se conectan desde sus casas; la mudanza documentada es "copiar carpeta + cambiar config" | 2–5 |
