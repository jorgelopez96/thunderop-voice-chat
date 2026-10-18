# Etapa 5 — Botonera y música de YouTube: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dentro de una sala de voz:
- Cualquiera aprieta un sonido de la botonera del grupo y lo escuchan todos los de la sala.
- Hay una cola de YouTube compartida. Todos escuchan la misma canción en el mismo segundo, quien entra se engancha donde va, y cualquiera pausa, reanuda, salta o quita.

**Architecture:**
- **Botonera:**
  - Colección `sonidos` en PocketBase (archivo de audio por grupo).
  - Al apretar, el cliente manda un mensaje de datos de LiveKit (`publishData`, confiable, topic `botonera`, `{ id }`) a la sala.
  - Cada cliente (incluido el que apretó) baja el archivo de PocketBase una vez, lo cachea decodificado y lo reproduce en el `AudioContext` de la voz con su propio volumen de botonera.
  - El audio no viaja por WebRTC.
- **Música:**
  - El estado vive en PocketBase: colección `canciones` (la cola de cada sala de voz) y `reproducciones` (una por sala: canción actual, momento de inicio y pausa).
  - Solo se modifica por rutas del servidor (`POST /api/rooms/{id}/musica`), que serializan la máquina de estados. El servidor también resuelve el título con el oEmbed de YouTube.
  - Cada cliente conectado a esa sala de voz se suscribe por realtime y reproduce con el **reproductor oficial de YouTube** (IFrame API) en su propia app. Calcula su posición con `ahora - inicio` y corrige si se desvía.
  - Ningún audio de YouTube se descarga ni se retransmite (spec).
  - El reproductor solo existe mientras hay cola y estás en esa sala.
- La música suena dentro de la app, así que la captura de pantalla (que excluye el árbol de la app) no la retransmite.

**Tech Stack:** PocketBase 0.40.5 (JSVM, realtime), livekit-client 2.23 (data messages), YouTube IFrame Player API, Web Audio, Vitest, Playwright (Edge) y Tauri 2.

**Spec:** `docs/specs/2026-10-18-diseno-inicial.md` (secciones "Botonera de sonidos" y "Música", y la decisión del redactor sobre YouTube). Hoja de ruta: `docs/plans/2026-10-18-plan-0-hoja-de-ruta.md` (fila 5).

## Global Constraints

- Todo el texto de la UI y los errores van en español rioplatense.
- **Sonidos:**
  - Duración máxima **10 s**, validada en el cliente al decodificar, antes de subir.
  - Archivo de hasta **1 MB**, con MIME `audio/mpeg`, `audio/ogg`, `audio/wav`, `audio/x-wav` o `audio/webm`.
  - Nombre de 1 a 32 caracteres.
  - Tope de **50 sonidos por grupo** (hook).
  - Los suben los miembros. Borra quien lo subió o el dueño del grupo.
- El mensaje de botonera se manda solo estando conectado a la sala de voz y lo reciben solo los de esa sala.
- **Música:**
  - Controlar la cola (agregar, pausar, reanudar, saltar, quitar) lo puede hacer cualquier miembro del grupo.
  - Los controles se muestran solo en la vista de la sala de voz.
- `reproducciones`: `inicioMs` es el instante (epoch ms, reloj del servidor) en que la canción actual estaría en el segundo 0. En pausa, `pausaS` guarda la posición en segundos; reproduciendo, vale `null`.
  - Posición = `pausaS ?? (ahoraServidor - inicioMs) / 1000`.
  - El cliente estima `ahoraServidor` con el desfase medido contra el header `Date` o un campo `ahora` que devuelve la ruta.
- Tolerancia de sincronización: si el reproductor local se desvía más de **2 s**, hace `seekTo`. Se chequea cada 5 s y al volver a "reproduciendo" (por ejemplo, después de un anuncio).
- Una canción que no se puede reproducir embebida (errores 2, 5, 100, 101 y 150 del reproductor) se marca `error` en la cola ("No se puede reproducir acá") y se salta sola.
- **Volúmenes:** el de la música y el de la botonera son aparte del de las voces. Se guardan en prefs (`localStorage['dm.voz']`, dentro de try/catch) como `volMusica` (0–100, default 50) y `volBotonera` (0–1, default 0.8).
- **Pruebas:** ninguna puede reproducir audio audible en la PC del usuario.
  - Navegadores extra con `--mute-audio`.
  - En la app, el reproductor de YouTube de prueba arranca con `mute()`.
  - Ver memoria `pruebas-audio-silenciadas`.
- El CSP solo se abre a lo mínimo que YouTube necesite, y en `csp` y `devCsp` a la vez.

## Review Focus

1. **Dos personas aprietan "saltar" a la vez** (o "terminó" llega duplicado de varios clientes): avanza una sola canción. Test en la Task 3 (`terminó` con id viejo no hace nada).
2. **Alguien entra a la sala a mitad de canción:** arranca en la posición correcta (±2 s), y en pausa queda pausado en el segundo guardado. Unit test de `posicion()` en la Task 5 y E2E en la Task 7.
3. **Se vacía la cola:** el reproductor se destruye y deja de consumir. Test en la Task 7 (`__musica.reproductor === false`).
4. **Un link inválido o que no es de YouTube:** "Ese link no es de YouTube." y nada se agrega. Test en la Task 3.
5. **Spam de botonera:** apretar muchas veces no acumula decenas de sonidos superpuestos en los demás. Tope local: máximo 3 reproducciones simultáneas de botonera por cliente, y las que sobran se descartan. Unit test en la Task 4.

---

### Task 1: Verificar el reproductor de YouTube dentro de Tauri (prueba corta)

**Files:**
- Modify (si hace falta): `app/src-tauri/tauri.conf.json` (CSP), `app/src-tauri/src/lib.rs` (el `on_navigation` no debe bloquear el iframe; solo debe bloquear la ventana principal).
- Create: `docs/spikes/2026-10-18-youtube-en-tauri.md`.

- [ ] **Step 1:** En una página temporal de la app (que no se commitea), cargar la IFrame API (`https://www.youtube.com/iframe_api`) y crear un reproductor **silenciado** (`playerVars: { mute: 1 }`, `mute()` en `onReady`) con un video público embebible. Probar en `tauri dev` y en el build de release (`http://tauri.localhost`), con una carpeta de WebView2 aparte (`WEBVIEW2_USER_DATA_FOLDER`) y CDP en otro puerto, sin tocar la app del usuario.
- [ ] **Step 2:** Anotar si el video llega a `PLAYING` y `getCurrentTime()` avanza. Si falla (por ejemplo, el error 153 por falta de Referer u origen), probar el plan B: servir una página `reproductor.html` desde `server/pb_public/` (PocketBase la sirve en `http://127.0.0.1:8090/reproductor.html`) y embeber ese iframe, que habla con la app por `postMessage` (`play`, `pause`, `seek`, `volumen`, eventos `estado` y `tiempo`).
- [ ] **Step 3:** Ajustar el CSP mínimo (`script-src` + `frame-src` para YouTube, o solo `frame-src` para el plan B) y verificar que `on_navigation` no bloquea la navegación del subframe. Si la bloquea, limitar el chequeo a la ventana principal.
- [ ] **Step 4:** Escribir el resultado en `docs/spikes/2026-10-18-youtube-en-tauri.md`: camino elegido, CSP y limitaciones. Commit `docs: youtube embebido en tauri`, más los cambios de CSP y `lib.rs` si los hubo, en `fix(app): ...`.

**Interfaces:**
- Produces: la decisión **A (IFrame API directa)** o **B (página puente en pb_public)** y el CSP. La Task 5 implementa la interfaz `Reproductor` sobre el camino elegido.

### Task 2: Servidor — botonera

**Files:**
- Create: `server/pb_migrations/10_sonidos.js`, con la colección `sonidos`:
  - `group` (relación con `groups`, requerida, cascade).
  - `name` (texto de 1 a 32).
  - `file` (archivo, 1 MB, MIME de Global Constraints).
  - `owner` (relación con `users`, requerida).
  - Reglas: list y view para `group.members.id ?= @request.auth.id`; create para miembros con `owner = @request.auth.id`; delete para `owner = @request.auth.id || group.owner = @request.auth.id`; update nula.
- Create: `server/pb_hooks/sonidos.pb.js`: en `onRecordCreateRequest` de `sonidos`, si el grupo ya tiene 50, devuelve 400 "El grupo ya tiene 50 sonidos.".
- Test: `server/tests/sonidos.test.ts`.

- [ ] **Step 1:** Tests:
  - `'un miembro sube un sonido'`.
  - `'alguien de afuera no puede subir ni ver'` (403/404).
  - `'archivo de más de 1 MB se rechaza'`.
  - `'un archivo que no es audio se rechaza'`.
  - `'otro miembro no puede borrar un sonido ajeno'`.
  - `'el dueño del grupo puede borrar cualquiera'`.
  - `'tope de 50 por grupo'`.
- [ ] **Step 2:** `cd server && npm test`. Esperado: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** `npm test`. Esperado: verde.
- [ ] **Step 5:** Commit `feat(server): botonera de sonidos por grupo`.

### Task 3: Servidor — cola y estado de la música

**Files:**
- Create: `server/pb_migrations/11_musica.js`:
  - `canciones`:
    - `room`: relación con `rooms`, requerida, cascade.
    - `videoId`: texto de exactamente 11 caracteres.
    - `titulo`: texto de hasta 200 caracteres.
    - `agregadoPor`: relación con `users`.
    - `estado`: select `cola | sonando | hecha | error`.
    - `created`: autodate, define el orden.
  - `reproducciones`:
    - `room`: relación con `rooms`, única.
    - `actual`: relación con `canciones`, nullable.
    - `inicioMs`: número.
    - `pausaS`: número, nullable.
  - En ambas colecciones: list y view para miembros del grupo de la sala; create, update y delete solo por el servidor (reglas nulas).
- Create: `server/pb_hooks/musica.pb.js`: `POST /api/rooms/{id}/musica` con body `{ accion, url?, cancionId? }`. Se exige que la sala sea `kind = 'voz'` y que el usuario sea miembro del grupo; si no, 403. Todo corre dentro de una transacción (`$app.runInTransaction`). Devuelve `{ reproduccion, ahora }`.
  - `agregar`:
    - Parsear `url`. Valen `youtube.com/watch?v=`, `youtu.be/`, `youtube.com/shorts/`, `music.youtube.com/watch?v=` y `m.youtube.com`, ignorando los demás parámetros. Si no hay un id de 11 caracteres `[A-Za-z0-9_-]`, 400 "Ese link no es de YouTube.".
    - Título por oEmbed (`$http.send` a `${YOUTUBE_OEMBED || 'https://www.youtube.com/oembed'}?url=...&format=json`, timeout 5 s). Si falla, `titulo = 'Video de YouTube'`.
    - Si no hay `actual`, la canción pasa a `sonando`, con `actual` = la canción, `inicioMs = ahora + 1500` (margen para cargar) y `pausaS = null`.
  - `pausar`: si está sonando, `pausaS = posición actual`.
  - `reanudar`: si `pausaS != null`, `inicioMs = ahora - pausaS*1000` y `pausaS = null`.
  - `saltar` (con `cancionId` = la actual que el cliente ve): solo si coincide con `actual`. Marca `hecha` y avanza a la siguiente en `cola` por `created`; si no hay, `actual = null`.
  - `terminó` (`cancionId`): igual que `saltar`. Por ser idempotente, el duplicado de otro cliente no hace nada.
  - `error` (`cancionId`): igual, pero marca `error`.
  - `quitar` (`cancionId`): si es la actual, equivale a `saltar`; si está en `cola`, la borra.
- Modify: `server/scripts/dev.mjs`: nada (oEmbed usa el default).
- Test: `server/tests/musica.test.ts`. El harness levanta un servidor HTTP local de stub para oEmbed y pasa `YOUTUBE_OEMBED` por env a PocketBase. Revisar si `startPocketBase({ env })` ya lo permite.

- [ ] **Step 1:** Tests:
  - `'agregar el primer link arranca a sonar con título del oEmbed'`.
  - `'agregar con oEmbed caído usa el título genérico'`.
  - `'link inválido da 400 con el mensaje'`, con varios formatos válidos e inválidos, incluido `https://youtube.com.evil.com/watch?v=...`.
  - `'pausar y reanudar conservan la posición'`, que usa `ahora` devuelto con una tolerancia de 1,5 s.
  - `'terminó duplicado avanza una sola vez'`.
  - `'saltar con id viejo no hace nada'`.
  - `'error marca la canción y salta'`.
  - `'quitar una de la cola la borra'`.
  - `'la última que termina deja actual vacío'`.
  - `'alguien de afuera recibe 403'`.
  - `'en una sala de chat da 400'`.
- [ ] **Step 2:** `npm test`. Esperado: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** `npm test`. Esperado: verde.
- [ ] **Step 5:** Commit `feat(server): cola de música sincronizada por sala de voz`.

### Task 4: Cliente — motor de botonera

**Files:**
- Create: `app/src/lib/botonera.svelte.ts`:
  - `sonidos(grupoId)`: lista reactiva con suscripción realtime a `sonidos` del grupo.
  - `subir(grupoId, nombre, archivo: File)`:
    - Decodifica con `decodeAudioData` para medir la duración. Si pasa de 10 s, "El sonido dura más de 10 segundos.".
    - Valida tamaño y tipo, con los mismos mensajes que el servidor.
    - Sube con `pb.collection('sonidos').create`.
  - `borrar(id)`.
  - `tocar(id)`: si estás en voz, `room.localParticipant.publishData(encode({ id }), { reliable: true, topic: 'botonera' })` y también lo reproduce localmente.
  - Al recibir `DataReceived` con topic `botonera`, reproduce el id.
  - Reproducción: cache `Map<id, AudioBuffer>`; `AudioBufferSourceNode` → `GainNode(volBotonera)` → `ctx.destination`, con el mismo `AudioContext` de la voz.
  - Tope de **3** fuentes simultáneas: las que sobran se descartan.
- Modify: `app/src/lib/voz.svelte.ts`: exponer lo mínimo que la botonera necesita (el contexto, la sala y un hook para `DataReceived`). Sin lógica de botonera adentro.
- Modify: `app/src/lib/prefs.ts`: `volBotonera` (0–1, default 0.8) y `volMusica` (0–100, default 50), validados.
- Test: `app/src/lib/botonera.test.ts` (lógica pura: `validarSonido({ duracion, tamaño, tipo })` → mensaje o `''`, y `class Limite(3)` con `intentar()`/`liberar()`), más tests de prefs.

- [ ] **Step 1:** Tests:
  - `'más de 10 s se rechaza'`.
  - `'más de 1 MB se rechaza'`.
  - `'tipo no permitido se rechaza'`.
  - `'válido da vacío'`.
  - `'el límite deja 3 y descarta el cuarto'`.
  - `'liberar deja lugar'`.
  - Prefs de volúmenes.
- [ ] **Step 2:** `cd app && npm test`. Esperado: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** `npm test && npm run check`. Esperado: verde y 0 errores.
- [ ] **Step 5:** Commit `feat(app): motor de botonera`.

### Task 5: Cliente — motor de música

**Files:**
- Create: `app/src/lib/musica/posicion.ts`:
  - `posicion(r: { inicioMs: number; pausaS: number | null }, ahoraServidorMs: number): number`.
  - `desfase(respuestaAhora: number, enviadoMs: number, recibidoMs: number): number`: estimación tipo NTP, `ahora - (enviado+recibido)/2`.
- Create: `app/src/lib/musica/posicion.test.ts`.
- Create: `app/src/lib/musica/reproductor.ts`:
  - Interfaz `Reproductor { cargar(videoId, desdeS): void; play(); pause(); seek(s); tiempo(): number; volumen(0-100); destruir(); onEstado(cb); onError(cb: (codigo) => void) }`.
  - Implementación según la decisión de la Task 1 (A: IFrame API; B: puente `postMessage`).
  - En DEV, si `globalThis.__ytFalso` existe, se usa un reproductor falso que avanza el tiempo con un reloj, para los E2E sin YouTube.
- Create: `app/src/lib/musica/musica.svelte.ts`:
  - Estado `musica = { cola: Cancion[], actual: Cancion | null, pausado: boolean, error: string }`.
  - `conectar(roomId)` (suscribe realtime a `canciones` y `reproducciones` de esa sala) y `desconectar()`.
  - `agregar(url)`, `pausar()`, `reanudar()`, `saltar()` y `quitar(id)` (POST a la ruta; usan `ahora` para el desfase).
  - Con `actual`, el reproductor existe: carga en `posicion()` y pausa si `pausaS`. Sin `actual`, `destruir()`.
  - Corrige el desvío cada 5 s y al volver a "reproduciendo": `seekTo` si la diferencia es mayor a 2 s.
  - Al terminar el video manda `terminó` con su `cancionId`; ante un error de embed manda `error`.
  - Volumen con `volMusica`.
  - Se conecta cuando entrás a una sala de voz y se desconecta en `limpiar()` de la voz.
  - `__musica` en DEV: `{ reproductor: boolean, tiempo(): number, videoId }`.
- Modify: `app/src/lib/voz.svelte.ts`: llamar a `conectar`/`desconectar` de la música al entrar o salir (o exponer un hook).

**Interfaces:**
- Consumes: Task 1 (camino elegido), Task 3 (ruta y colecciones).

- [ ] **Step 1:** `posicion.test.ts`:
  - `'reproduciendo calcula desde inicio'`.
  - `'en pausa devuelve pausaS'`.
  - `'antes del inicio da 0'` (no negativo).
  - `'desfase NTP'` (casos simples).
- [ ] **Step 2:** `npm test`. Esperado: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** `npm test && npm run check`. Esperado: verde y 0 errores.
- [ ] **Step 5:** Commit `feat(app): motor de música sincronizada`.

### Task 6: Interfaz de botonera y música

**Files:**
- Create: `app/src/lib/vistas/Botonera.svelte`:
  - Grilla de botones con el nombre de cada sonido. Clic → `tocar`, deshabilitado si no estás en voz.
  - Botón "+ Sonido" que abre un `<dialog>` con nombre y archivo (`accept="audio/*"`) y muestra los errores.
  - En cada sonido propio, o en todos si sos el dueño, un "Borrar" (`button.plano`).
  - Deslizador "Volumen de la botonera".
- Create: `app/src/lib/vistas/Musica.svelte`:
  - Campo "Pegá un link de YouTube" y botón "Agregar".
  - La canción actual con su título y los botones "Pausar"/"Reanudar" y "Saltar".
  - La cola con "Quitar" en cada una; las que fallaron muestran "No se puede reproducir acá".
  - El reproductor, visible y chico (≈ 200×113, sin taparlo, por las condiciones de YouTube).
  - Deslizador "Volumen de la música".
- Modify: `app/src/lib/vistas/Voz.svelte`: debajo de las tarjetas, dos secciones plegables, "Botonera" y "Música". El estado plegado se guarda por usuario en `localStorage`.

- [ ] **Step 1:** Implementar con los tokens de `app.css`, sin adornos (la pasada visual es más adelante).
- [ ] **Step 2:** `npm run check`. Esperado: 0 errores.
- [ ] **Step 3:** Commit `feat(app): botonera y música en la sala de voz`.

### Task 7: E2E y verificación en la app de escritorio

**Files:**
- Create: `app/e2e/botonera.spec.ts` y `app/e2e/musica.spec.ts`. Para la música, `page.addInitScript(() => { globalThis.__ytFalso = true })`. El servidor de los E2E usa un stub de oEmbed: `global-setup` levanta un HTTP local y pasa `YOUTUBE_OEMBED`.
- Modify: `app/e2e/global-setup.ts`.

- [ ] **Step 1:** Test `'un sonido de la botonera lo escuchan los de la sala'`:
  - Ana sube un WAV de 1 s generado.
  - Ana y Beto están en "🔊 General" y Ana lo aprieta.
  - El contador DEV `__botonera.reproducidos` de Beto sube en 1 y el de Caro (que no está en la sala) no cambia.
  - Un archivo de 11 s da el error de duración.
- [ ] **Step 2:** Test `'cola de música compartida'`:
  - Ana agrega dos links. Beto ve la cola y la canción actual.
  - Beto pausa y Ana ve "Reanudar". Ana reanuda.
  - Caro entra tarde y su `__musica.tiempo()` está a ±2 s del de Ana.
  - Beto salta y todos pasan a la segunda canción.
  - Cuando termina la segunda, `__musica.reproductor` es `false` en todos (Review Focus 3).
  - Un link inválido muestra "Ese link no es de YouTube.".
- [ ] **Step 3:** `npx playwright test`. Esperado: todos verdes, corridos en serie.
- [ ] **Step 4:** Verificar en la app de escritorio (release, carpeta de WebView2 aparte, `--mute-audio`, sin tocar la app del usuario) con un video real de YouTube:
  - Carga y avanza.
  - `seekTo` funciona.
  - Un video no embebible se salta solo y queda marcado.
  - Anotar la RAM con el reproductor y sin él.
- [ ] **Step 5:** Commit `test(app): e2e de botonera y música`.
