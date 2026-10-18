# Etapa 4 — Pantalla compartida: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dentro de una sala de voz, cualquiera transmite su pantalla o una ventana en 720p o 1080p, a 30 o 60 fps, con el codificador de la GPU. El sonido de la PC se comparte solo, sin las voces de la llamada. Los demás eligen "Ver" para mirarla. La pérdida de FPS del juego de quien transmite tiene que quedar medida y por debajo de ~10%.

**Architecture:**
- **Video:** usa el camino que aprobó la etapa 1, `getDisplayMedia` de WebView2 publicado con `livekit-client` en H.264.
  - Un parche de `RTCPeerConnection.prototype.setRemoteDescription` reescribe el perfil de la respuesta remota (`42e0xx → 4200xx`). Así WebView2 codifica con la GPU (NVENC/AMF/QuickSync) y no con OpenH264.
  - El parche viene de `spikes/pantalla/src/sdp.ts`.
- **Audio:** un módulo nativo en Rust dentro de Tauri usa el crate `wasapi` 0.26.
  - Llama a `AudioClient::new_application_loopback_client(std::process::id(), false)`. Con `false`, el código del crate pide `PROCESS_LOOPBACK_MODE_EXCLUDE_TARGET_PROCESS_TREE`: captura todo el sonido de Windows **menos** el de nuestra app y sus hijos. La documentación del crate dice otra cosa; manda el código.
  - Verificado el 2026-10-18: el WebView2 de la app (`msedgewebview2.exe`) es hijo de `app.exe`. Por eso las voces de la llamada quedan excluidas.
  - El PCM (f32, 48 kHz, estéreo) llega al frontend por un `Channel` de Tauri. Un AudioWorklet con cola acotada lo pasa a una `MediaStreamTrack`, que se publica como `ScreenShareAudio`.
- **Ver:** la Room pasa a `autoSubscribe: false`. Los micrófonos se suscriben solos y la pantalla con su audio solo cuando el espectador toca "Ver", igual que en Discord. Así nadie paga la bajada de 12 Mbps sin quererlo.
- **Servidor:** no cambia. El token ya permite `screen_share` y `screen_share_audio`, y silenciar por el dueño no quita la pantalla (decisión de la etapa 3).

**Tech Stack:** Tauri 2, crate `wasapi` 0.26 (solo Windows), `@tauri-apps/api` ^2 (`Channel`, `invoke`, `getCurrentWindow`), `livekit-client` ^2.23, Vitest, Playwright (Edge) y PresentMon (medición, en D:).

**Spec:** `docs/specs/2026-10-18-diseno-inicial.md` (sección "Compartir pantalla" y anti-objetivos). Resultado de la etapa 1: `docs/spikes/2026-10-18-resultado-pantalla.md`. Hoja de ruta: `docs/plans/2026-10-18-plan-0-hoja-de-ruta.md` (fila 4).

## Global Constraints

- Todo el texto de la UI y los errores van en español rioplatense.
- Calidades permitidas y sus bitrates máximos, fijos:
  - 720p30: 3 Mbps.
  - 720p60: 5 Mbps.
  - 1080p30: 8 Mbps.
  - 1080p60: 12 Mbps.
  - Default 1080p60.
- Se publica con `videoCodec: 'h264'`, `simulcast: false`, `contentHint: 'motion'` y `screenShareEncoding: { maxBitrate, maxFramerate }`.
- El parche H.264 Baseline está activo por defecto. Una preferencia "Codificar con la GPU" (on por defecto) lo apaga para volver a OpenH264 si un espectador no puede decodificar.
- `getDisplayMedia` se pide **sin** audio (`audio: false`). El audio sale solo del módulo nativo.
- Si el módulo nativo no está disponible (navegador, E2E o Windows sin soporte de process loopback), se transmite solo el video. En Tauri se avisa "No se pudo compartir el sonido de la PC."; fuera de Tauri no se avisa.
- Una transmisión por persona. No hay tope por sala, porque la spec dice que transmiten 1 o 2 a la vez.
- Preferencias en `localStorage['dm.voz']`, como siempre dentro de try/catch: se suman `calidad: '720p30' | '720p60' | '1080p30' | '1080p60'` y `gpu: boolean`.
- No se instala nada en C:. PresentMon va en `D:\Herramientas\PresentMon\`.
- Ni los binarios ni las mediciones crudas (CSV) se commitean.

## Review Focus

1. **Se cierra la ventana compartida o se termina la captura desde Windows:** la transmisión se despublica y el hilo de audio nativo se detiene, sin dejar la captura abierta (se vio `NotReadableError` en la etapa 1 por capturas colgadas). Test en la Task 4 (`detenerAudio` es idempotente y se llama en `LocalTrackUnpublished`) y en el E2E de la Task 6 (detener → el espectador deja de ver).
2. **Salir de la voz, cambiar de sala, ser echado o cerrar sesión mientras transmitís:** se corta todo, video y audio nativo. Se verifica en la Task 6 (Ana sale de la sala transmitiendo y Beto deja de ver la tarjeta).
3. **Cancelar el selector de pantalla:** no aparece error ni queda estado "transmitiendo". Unit test en la Task 4 (`NotAllowedError` → sin error) y verificación en la Task 6.
4. **El espectador entra a la sala cuando la transmisión ya empezó:** ve el botón "Ver". Test E2E en la Task 6 (Caro entra tarde).
5. **El audio nativo no está o falla:** se transmite el video igual y, en Tauri, aparece el aviso. Fuera de Tauri queda cubierto por todo el E2E; en Tauri se verifica en la Task 7.

---

### Task 1: Parche H.264 y preferencias de transmisión

**Files:**
- Create: `app/src/lib/sdp.ts`, que copia `useBaselineH264(sdp: string): string` y `installBaselineH264Patch(enabled: () => boolean): void` de `spikes/pantalla/src/sdp.ts`, con sus comentarios. El `ponytail:` del spike se reemplaza por: "parche global: todas las RTCPeerConnection de la app son de LiveKit; si eso cambia, filtrar por sender de video".
- Create: `app/src/lib/sdp.test.ts`, copiando los tests de `spikes/pantalla/src/sdp.test.ts`.
- Modify: `app/src/lib/prefs.ts`:
  - `PrefsVoz` suma `calidad: Calidad` (default `'1080p60'`) y `gpu: boolean` (default `true`). Un valor guardado inválido cae al default.
  - Exporta `type Calidad = '720p30' | '720p60' | '1080p30' | '1080p60'` y `CALIDADES: Record<Calidad, { ancho: number; alto: number; fps: number; mbps: number }>` con los valores de Global Constraints.
- Modify: `app/src/lib/prefs.test.ts`.

**Interfaces:**
- Produces: `installBaselineH264Patch`, `Calidad`, `CALIDADES` y `leerPrefs().calidad/.gpu` para las Tasks 4 y 5.

- [ ] **Step 1:** Tests nuevos en `prefs.test.ts`:
  - `'calidad y gpu tienen defaults'`: `leerPrefs()` sin nada → `calidad: '1080p60'` y `gpu: true`.
  - `'calidad inválida cae al default'`: guardado `{ calidad: '4k' }` → `'1080p60'`.
  - `'gpu false se respeta'`.
- [ ] **Step 2:** `cd app && npm test`. Esperado: FAIL en los 3 nuevos; los de `sdp.test.ts` pasan apenas se copian.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** `npm test && npm run check`. Esperado: verde y 0 errores.
- [ ] **Step 5:** Commit `feat(app): parche h264 baseline y preferencias de transmisión`.

### Task 2: Captura nativa del sonido de la PC (Rust)

**Files:**
- Modify: `app/src-tauri/Cargo.toml`: `[target.'cfg(windows)'.dependencies] wasapi = "0.26"`.
- Create: `app/src-tauri/src/audio.rs`:
  - `#[tauri::command] fn iniciar_audio(canal: tauri::ipc::Channel<tauri::ipc::InvokeResponseBody>, estado: tauri::State<Captura>) -> Result<(), String>`.
  - `#[tauri::command] fn detener_audio(estado: tauri::State<Captura>)`.
  - `pub struct Captura(Mutex<Option<(Arc<AtomicBool>, JoinHandle<()>)>>)`.
  - `iniciar_audio` primero detiene una captura previa, porque es idempotente. Después abre el cliente **en el hilo nuevo** y espera por un `mpsc` el resultado de la inicialización. Un fallo vuelve como `Err` con el texto del error de wasapi: lo registra el frontend, el usuario no lo ve.
  - El hilo hace `initialize_mta()` y `new_application_loopback_client(std::process::id(), false)` (excluye nuestro árbol de procesos).
  - Formato: `WaveFormat::new(32, 32, &SampleType::Float, 48000, 2, None)`, con `initialize_client(&fmt, &Direction::Capture, &StreamMode::EventsShared { autoconvert: true, buffer_duration_hns: 200_000 })`.
  - Lazo: `wait_for_event(100)`. El timeout no es error, porque sin sonido no llegan eventos. Lee todos los paquetes disponibles y manda cada lote como `InvokeResponseBody::Raw(bytes)` (f32 LE intercalado) mientras la bandera siga en `true`.
  - Si `canal.send` falla (la ventana se fue), el hilo termina.
  - `detener_audio` baja la bandera y hace `join`. Si no hay captura, no hace nada.
  - Fuera de Windows (`cfg(not(windows))`), `iniciar_audio` devuelve `Err("no disponible")`.
- Modify: `app/src-tauri/src/lib.rs`: `mod audio;`, `.manage(audio::Captura::default())` y `.invoke_handler(tauri::generate_handler![audio::iniciar_audio, audio::detener_audio])`.
- Test: `app/src-tauri/tests/captura.rs`, o `#[cfg(test)]` en `audio.rs` si la función de captura se separa del `Channel`. La lógica de captura se expone como `pub fn capturar(parar: Arc<AtomicBool>, mut enviar: impl FnMut(Vec<u8>) -> bool) -> Result<(), String>` (sin Tauri), así los tests la llaman directo.

**Interfaces:**
- Produces: los comandos `iniciar_audio(canal)` y `detener_audio()` para la Task 3. Cada mensaje del canal es un `ArrayBuffer` con muestras f32 intercaladas en estéreo a 48 kHz.

- [ ] **Step 1:** Tests `#[ignore]` (necesitan dispositivo de audio; se corren a mano con `cargo test -- --ignored`):
  - `captura_sonido_ajeno`:
    - Genera un WAV de 440 Hz de 3 s en un temporal, con un helper de encabezado WAV escrito a mano y sin dependencias.
    - Lo reproduce con un proceso **fuera de nuestro árbol**: `powershell -NoProfile -Command "Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{CommandLine='powershell -NoProfile -Command (New-Object Media.SoundPlayer ''<wav>'').PlaySync()'}"`. WMI crea el proceso con otro padre.
    - Captura 2 s con `capturar` y afirma RMS > 0,01.
  - `excluye_sonido_propio`:
    - Reproduce el mismo tono **desde este proceso** con un `AudioClient` de render de `wasapi` en otro hilo.
    - Captura 2 s y afirma RMS < 0,001. Solo vale con la PC en silencio; el test lo dice en su mensaje de fallo.
- [ ] **Step 2:** `cd app/src-tauri && cargo test -- --ignored`. Esperado: FAIL (no compila: `capturar` no existe).
- [ ] **Step 3:** Implementar `audio.rs` y registrar los comandos.
- [ ] **Step 4:** `cargo test -- --ignored` (con la PC en silencio) y `cargo build`. Esperado: 2 passed y compila. Si el crate devuelve otro formato o falla `initialize_client`, ajustar con `systematic-debugging`. No cambiar a modo INCLUDE: rompe el requisito de excluir las voces.
- [ ] **Step 5:** Commit `feat(app): captura nativa del sonido de la pc sin la propia app`.

### Task 3: Puente de audio nativo → pista WebRTC

**Files:**
- Create: `app/src/lib/colaPcm.ts`, con `class ColaPcm`:
  - `constructor(maxMuestras: number)`.
  - `meter(lote: Float32Array): void`, que si se pasa del máximo descarta lo más viejo para acotar la latencia.
  - `sacar(destino: Float32Array): void`, que rellena con ceros si falta.
  - `get largo(): number`.
  - Trabaja con muestras intercaladas.
- Create: `app/src/lib/colaPcm.test.ts`.
- Create: `app/src/lib/pcm.worklet.ts`, un `AudioWorkletProcessor` `'pcm-entrada'`:
  - Recibe `Float32Array` por `port.onmessage`.
  - Usa `ColaPcm` con un máximo de 0,1 s (9600 muestras intercaladas).
  - Desintercala a 2 canales en `process()`.
  - Se carga con `import url from './pcm.worklet.ts?worker&url'`. Si Vite no lo empaqueta así, usar el mismo mecanismo que `@sapphi-red/web-noise-suppressor` en `ruido.ts`.
- Create: `app/src/lib/audioPantalla.ts`:
  - `export async function iniciarAudioPantalla(ctx: AudioContext): Promise<MediaStreamTrack | null>`. Devuelve `null` sin tirar si no es Tauri (`!('__TAURI_INTERNALS__' in globalThis)`) o si `invoke('iniciar_audio')` falla; en ese caso registra con `console.warn`.
  - `export async function detenerAudioPantalla(): Promise<void>`. Es idempotente: `invoke('detener_audio')`, desconecta el nodo y para la pista.
  - Arma un `Channel<ArrayBuffer>` cuyo `onmessage` hace `port.postMessage(new Float32Array(buf), [buf])` al `AudioWorkletNode`, más un `MediaStreamAudioDestinationNode({ channelCount: 2 })`.

**Interfaces:**
- Consumes: los comandos de la Task 2.
- Produces: `iniciarAudioPantalla(ctx)` y `detenerAudioPantalla()` para la Task 4.

- [ ] **Step 1:** `colaPcm.test.ts`:
  - `'saca lo que entró en orden'`.
  - `'rellena con ceros si falta'`.
  - `'al pasarse del máximo descarta lo más viejo'`: max 4; meter `[1,2,3]` y después `[4,5,6]` → sacar 4 → `[3,4,5,6]`.
  - `'lote más grande que el máximo conserva solo el final'`.
- [ ] **Step 2:** `npm test`. Esperado: FAIL.
- [ ] **Step 3:** Implementar los tres archivos.
- [ ] **Step 4:** `npm test && npm run check && npm run build`. Esperado: verde, 0 errores, y el build emite el worklet como archivo aparte.
- [ ] **Step 5:** Commit `feat(app): puente del audio nativo a una pista webrtc`.

### Task 4: Motor de transmisión

**Files:**
- Modify: `app/src/lib/voz.svelte.ts`:
  - El estado suma `transmitiendo: boolean` y `viendo: string | null` (identidad que mirás). `Participante` suma `transmite: boolean`, que viene de `getTrackPublication(ScreenShare)`.
  - Al cargar `lk` por primera vez: `installBaselineH264Patch(() => leerPrefs().gpu)`.
  - `new Room({ ..., })` igual que ahora; `r.connect(url, token, { autoSubscribe: false })`.
  - Suscripción manual:
    - En `TrackPublished` y, después de conectar, para cada publicación ya existente: si `source === Microphone`, `pub.setSubscribed(true)`.
    - Las de pantalla solo se suscriben con `ver`.
  - `export async function transmitir(calidad: Calidad)`:
    1. Si la ventana mide menos de 1280×800 lógicos, la agranda (`getCurrentWindow().setSize(new LogicalSize(...))`, solo en Tauri). El selector de WebView2 se dibuja adentro y se corta en ventanas chicas (etapa 1).
    2. `setScreenShareEnabled(true, { audio: false, contentHint: 'motion', resolution: { width, height, frameRate } }, { videoCodec: 'h264', simulcast: false, screenShareEncoding: { maxBitrate: mbps * 1e6, maxFramerate: fps } })`.
    3. `const t = await iniciarAudioPantalla(ctx)`. Si hay pista, `publishTrack(t, { source: ScreenShareAudio, dtx: false, red: false, audioPreset: AudioPresets.musicHighQualityStereo, forceStereo: true })`. Si es `null` y estamos en Tauri, `voz.error = 'No se pudo compartir el sonido de la PC.'`.
    4. Guarda `calidad` en prefs.
  - `NotAllowedError` (selector cancelado) no deja error ni `transmitiendo`. Otro fallo: `'No se pudo compartir la pantalla.'`.
  - `export async function dejarDeTransmitir()`: despublica `ScreenShareAudio` y apaga `setScreenShareEnabled(false)`.
  - Handler de `LocalTrackUnpublished` con source `ScreenShare` (incluye cuando Windows termina la captura): `detenerAudioPantalla()`, despublicar la pista de audio si sigue y `transmitiendo = false`. Así el corte iniciado por el sistema y el del botón pasan por el mismo lugar.
  - `limpiar()` llama a `detenerAudioPantalla()` y deja `transmitiendo: false, viendo: null`.
  - `export function ver(identidad: string | null)`:
    - Desuscribe pantalla y audio del que mirabas.
    - Suscribe `ScreenShare` y `ScreenShareAudio` del nuevo.
    - Fija `voz.viendo`.
    - Si el que mirás deja de transmitir (`TrackUnpublished`), `viendo = null`.
  - `export function pistaPantalla(identidad: string): RemoteTrack | undefined`, para que la vista haga `attach`.
  - `export function volumenPantalla(identidad: string, v: number)`: `setVolume(v, Track.Source.ScreenShareAudio)`, sin guardar.
  - El audio de pantalla suscrito se adjunta igual que el de micrófono (`TrackSubscribed` ya lo hace para todo audio).
  - `__voz.stats()` (DEV) suma `pantallas: Record<nombre, { frames: number }>` con `framesDecoded` del inbound-rtp de video, y `transmitiendo`.
- Modify: `app/src/lib/sesion.svelte.ts` o donde hoy se resetea la voz al cerrar sesión: no hace falta tocarlo si `salirVoz()` ya pasa por `limpiar()`. Verificarlo.
- Modify: `app/src-tauri/capabilities/default.json`: `"core:window:allow-set-size"` (y `allow-inner-size` / `allow-scale-factor` si se leen desde la API).

**Interfaces:**
- Consumes: Tasks 1 y 3.
- Produces: `transmitir`, `dejarDeTransmitir`, `ver`, `pistaPantalla`, `volumenPantalla`, `voz.transmitiendo`, `voz.viendo` y `Participante.transmite` para la Task 5.

- [ ] **Step 1:** Tests unitarios de la decisión de errores. Extraer `export function mensajeTransmision(e: unknown): string` (`''` para `NotAllowedError`, el texto genérico para el resto) en `voz.svelte.ts` o en un archivo chico importable por Vitest:
  - `'cancelar el selector no es error'`.
  - `'otro fallo da el mensaje genérico'`.
- [ ] **Step 2:** `npm test`. Esperado: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** `npm test && npm run check && npx playwright test e2e/voz.spec.ts`. Esperado: verde. El E2E de voz existente prueba que la suscripción manual de micrófonos no rompió nada.
- [ ] **Step 5:** Commit `feat(app): transmitir y ver pantallas en la sala de voz`.

### Task 5: Interfaz de transmisión

**Files:**
- Modify: `app/src/lib/vistas/ControlesVoz.svelte`:
  - Botón "Transmitir" que abre un `<dialog>` con un `<select>` "Calidad" (`720p · 30 fps`, `720p · 60 fps`, `1080p · 30 fps`, `1080p · 60 fps`; preseleccionada la de prefs) y el botón primario "Empezar". Al confirmar llama a `transmitir`.
  - Mientras `voz.transmitiendo`, el botón pasa a ser "Dejar de transmitir" (`.peligro`).
- Modify: `app/src/lib/vistas/Voz.svelte`:
  - En la tarjeta de quien transmite, una etiqueta "📺 En vivo" y, si es remoto, un botón "Ver" (o "Dejar de ver" si es el que mirás).
  - Si `voz.viendo`, arriba de las tarjetas va un área de video:
    - `<video autoplay playsinline muted>` con `pistaPantalla(...).attach(el)` y `detach` al desmontar o cambiar. El sonido va por el audio adjunto; el video va `muted`.
    - Botón "Pantalla completa" (`el.requestFullscreen()`).
    - Deslizador "Volumen de la transmisión" (0 a 200 %) → `volumenPantalla`.
    - El video ocupa el ancho disponible con `object-fit: contain` sobre fondo `--hondo`.
- Modify: `app/src/lib/vistas/AjustesVoz.svelte`: casilla "Codificar con la GPU" (prefs `gpu`), con el texto chico "Desactivala solo si alguien no puede ver tu transmisión." Aplica en la próxima transmisión.

**Interfaces:**
- Consumes: Task 4.

- [ ] **Step 1:** Implementar con los tokens de `app.css` (`--hondo`, `--ok`, `button.primario`, `.peligro`, `.plano`).
- [ ] **Step 2:** `npm run check`. Esperado: 0 errores.
- [ ] **Step 3:** Capturas con Playwright (spec temporal, que no se commitea) de: alguien transmitiendo visto por otro, el diálogo de calidad y Ajustes. Revisarlas.
- [ ] **Step 4:** Commit `feat(app): controles y vista de transmisión`.

### Task 6: E2E de pantalla compartida

**Files:**
- Modify: `app/playwright.config.ts`: agregar a `launchOptions.args` lo que haga que `getDisplayMedia` resuelva sin selector en Edge.
  - Probar primero `--auto-select-desktop-capture-source=Entire screen`. Edge puede estar localizado: probar también `Pantalla completa` o `Screen 1`.
  - Si no alcanza, `--auto-accept-this-tab-capture` con `preferCurrentTab`.
  - Dejar comentado cuál funcionó.
- Create: `app/e2e/pantalla.spec.ts`.

- [ ] **Step 1:** Test `'transmitir y ver una pantalla'`:
  - Ana crea el grupo y Beto se une. Ambos entran a "🔊 General".
  - Ana: "Transmitir" → calidad `720p · 30 fps` → "Empezar". Su tarjeta muestra "📺 En vivo" y no aparece ningún `alert` (fuera de Tauri no hay aviso de sonido).
  - Beto ve "Ver" en la tarjeta de Ana, lo toca y `__voz.stats().pantallas.Ana.frames` crece en 3 s.
  - Caro se une y entra **después**: ve "Ver" en la tarjeta de Ana (Review Focus 4). Sin tocarlo, `stats().pantallas.Ana` no existe o tiene 0 frames: no se suscribió sola.
  - Ana: "Dejar de transmitir" → en Beto desaparece el área de video y el botón "Ver" en menos de 5 s.
  - Ana transmite otra vez y sale de la sala (Desconectar) → en Beto desaparece "📺 En vivo" en menos de 10 s (Review Focus 2).
- [ ] **Step 2:** `npx playwright test`. Esperado: 3 passed (flujo, voz y pantalla).
- [ ] **Step 3:** Commit `test(app): e2e de pantalla compartida`.

### Task 7: Verificación en la app de escritorio y medición de FPS

**Files:**
- Create: `app/scripts/medir-fps.ps1`:
  - Parámetros `-Proceso <nombre.exe> -Segundos 60`.
  - Corre `D:\Herramientas\PresentMon\PresentMon.exe` sobre el proceso con salida CSV a un temporal y una duración fija.
  - Imprime el promedio de FPS y el percentil 1 % bajo (desde `MsBetweenPresents`).
  - Si PresentMon no está, dice de dónde bajarlo (release oficial de GameTechDev/PresentMon en GitHub) y a qué carpeta.
- Create: `docs/mediciones/2026-10-18-etapa-4.md`, con los resultados.

- [ ] **Step 1:** Bajar PresentMon (la última release estable, binario de consola x64) a `D:\Herramientas\PresentMon\`.
- [ ] **Step 2:** Compilar en release (`npm run tauri build`), levantar `server` con `npm run dev` y abrir la app compilada con CDP (`WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9333`). Verificar por CDP con una segunda cuenta en Edge/Playwright como espectador:
  - Transmitir a 1080p60 no da errores de CSP. `getStats` del emisor muestra `encoderImplementation` con `MediaFoundation`/NVIDIA (GPU) y ~55–60 fps enviados.
  - Mientras suena algo en la PC (el tono de la Task 2 lanzado por WMI), el espectador recibe bytes de `ScreenShareAudio`. Con solo la voz de otro participante sonando en la app, el audio de pantalla queda en silencio (RMS por `getStats` `audioLevel` ≈ 0).
  - Cerrar la ventana compartida termina la transmisión y no deja el hilo vivo: un segundo "Transmitir" funciona sin `NotReadableError` ni `Err` de `iniciar_audio`.
  - Si el selector no se puede manejar por CDP, este paso se hace con el usuario y se rotula cada ventana (la app compilada vs. el navegador espectador).
  - RAM de la app transmitiendo 1080p60 (árbol `app.exe` + WebView2, memoria privada y working set).
- [ ] **Step 3:** Prueba con el usuario (no se automatiza):
  1. Valorant en la misma escena (rango de práctica), 60 s sin transmitir con `medir-fps.ps1 -Proceso VALORANT-Win64-Shipping.exe`.
  2. Repetir transmitiendo 1080p60 a un espectador en otro dispositivo de la red.
  3. Que el usuario confirme que el espectador escucha el juego y no su propia voz.
- [ ] **Step 4:** Escribir `docs/mediciones/2026-10-18-etapa-4.md` con fps promedio y 1 % bajo (sin y con transmisión), pérdida %, codificador, RAM y observaciones.
  - **Si la pérdida es ≥ 10 %, el veredicto de la etapa 1 cambia a "módulo nativo de captura y codificación"** y se le avisa al usuario antes de cerrar la etapa.
  - Actualizar el veredicto en `docs/spikes/2026-10-18-resultado-pantalla.md` (provisional → confirmado o cambiado).
- [ ] **Step 5:** Commit `docs: medición de fps y ram al transmitir`.
