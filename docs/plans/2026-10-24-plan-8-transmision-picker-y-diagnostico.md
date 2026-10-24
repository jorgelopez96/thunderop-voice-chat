# Transmisión: selector, solo nativo y diagnóstico — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la única forma de transmitir sea el transmisor nativo (con compresor por software si la placa no
tiene), que se elija qué transmitir con miniaturas de cada monitor y ventana, y que cada transmisión deje su
registro técnico en el servidor para poder arreglar fallas en PCs ajenas.

**Architecture:** El transmisor (`nativo/transmisor`) gana dos cosas: el modo `--miniaturas` (JSON por línea) y
el compresor de Microsoft por CPU como respaldo del de hardware; la fuente se pasa por id (`monitor:<disp>` /
`ventana:<hwnd>`). `src-tauri/src/transmisor.rs` expone las fuentes y devuelve, al terminar, el registro de esa
transmisión. La app (Svelte) borra el camino de WebView2, muestra el selector y sube el registro a la colección
`diagnosticos` de PocketBase, que solo leen los superusuarios.

**Tech Stack:** PocketBase 0.40.5 (hooks y migraciones JS), vitest; Tauri 2 + Svelte 5 + `livekit-client`;
Rust + `windows` 0.62 (WGC, Media Foundation, WIC, GDI), `serde_json` y `base64` (ya en `Cargo.lock`);
SvelteKit (página, `node:test`).

**Spec:** `docs/specs/2026-10-24-transmision-picker-y-diagnostico.md`

## Global Constraints

- Todo entra en la app `0.6.0` (no se sube la versión: todavía no se publicó).
- Colección `diagnosticos`: `user` (relación a `users`, requerida, borrado en cascada), `version` (texto, máx. 20),
  `codigo` (número entero), `contenido` (texto, máx. 65 536), `created` (autodate). `createRule =
  '@request.auth.collectionName = "users" && @request.body.user = @request.auth.id'`; `listRule`, `viewRule`,
  `updateRule`, `deleteRule` = `null`.
- Límites: regla `diagnosticos:create` 3 cada 60 s; hook: 20 por usuario por hora (`DIAGNOSTICOS_POR_HORA`) → 429.
  Retención: 30 días (`DIAGNOSTICOS_DIAS`), tarea `diagnosticos-viejos`.
- La app recorta el registro a 60 000 caracteres (principio 8 000 + `\n…[recortado]…\n` + final) y reemplaza
  `/([A-Za-z]):\\Users\\[^\\\s"']+/g` por `$1:\Users\…` antes de subir.
- El transmisor **nunca** imprime títulos de ventanas ni nombres de programas en modo transmisión.
- Fuente al transmisor: `monitor:<nombre del dispositivo>` (p. ej. `monitor:\\.\DISPLAY2`), `ventana:<hwnd decimal>`,
  o `pantalla` (= principal, solo para pruebas a mano).
- Códigos de salida: 0 bien · 2 no está la fuente · 3 no hay **ningún** compresor H.264 · 4 se rindió · 5 no
  conecta a LiveKit. En la app, además, -1 = no arrancó el proceso.
- Software: salida ≤ 720p y ≤ 30 fps, también al cambiar la calidad en vivo. `TRANSMISOR_SOFTWARE=1` fuerza el
  camino por software (para probar en una PC con placa).
- Líneas del registro que se agregan: `placa: <Description del adaptador DXGI>` y
  `codificador: <nombre> (hardware)` / `codificador: Microsoft H.264 (software, máx. 720p30)`.
- Miniaturas: 320 px de ancho, tiempo máximo total 1,5 s por pedido, refresco cada 3 s con el diálogo abierto,
  nunca dos pedidos a la vez.
- Nada de crates nuevos fuera de `Cargo.lock`; nada de dependencias npm nuevas.
- Sin `Co-Authored-By` ni "Generated with Claude" en commits. Commit/push solo cuando Jorge lo pide.
- Desplegar migración y hook, publicar la app y la página se confirma con Jorge en el momento.

## Review Focus

- Un usuario crea un diagnóstico con `user` de otro → rechazado; lista, ve, cambia o borra uno (propio o ajeno) → 403/404; sin sesión o con cuenta incompleta → rechazado.
- Registro con un título de ventana, `C:\Users\Jorge\AppData\...` o el nombre de un `.exe` → no llega al servidor.
- Registro de 2 horas (más de 64 KB) → se sube recortado con la primera línea `placa:` y la última línea (por qué terminó).
- Arrancar una transmisión mientras termina la anterior → cada diagnóstico tiene el registro de su transmisión, no el de la otra.
- Placa sin compresor por hardware (`TRANSMISOR_SOFTWARE=1`) → transmite a ≤720p30 y el registro dice `software`; cambiar en vivo a 1080p60 no la sube de 720p30.
- Dos monitores → aparecen los dos con su miniatura y se transmite el elegido (no siempre el principal). Dos ventanas con el mismo título → se transmite la elegida.
- Ventana minimizada, de otro escritorio virtual, o la propia de Thunderop → no aparece.
- Cerrar el diálogo con un pedido de miniaturas en curso → no queda ningún `transmisor.exe` corriendo y no se pisa la elección.
- No queda ninguna referencia a `setScreenShareEnabled`, `getDisplayMedia`, `installBaselineH264Patch`, `agrandarVentana`, `prefs.gpu`, `dm.fallasNativo`, `hayNativo`, `ventanas_transmisor` ni `--ventanas`.

---

## File Structure

**Servidor (`server/`)**
- `pb_migrations/9_zz_diagnosticos.js` — colección `diagnosticos`, sus reglas y el límite `diagnosticos:create`.
- `pb_hooks/diagnosticos.pb.js` — tope por hora y limpieza a los 30 días.
- `tests/diagnosticos.test.ts`, `tests/rate-limits.test.ts`.

**Transmisor (`nativo/transmisor/src/`)**
- `captura.rs` — `Objetivo` (parseo del id), monitores, filtro de ventanas, captura de un solo cuadro.
- `mf.rs` — compresor de hardware (como hoy) o software (sincrónico, copia NV12 a la CPU).
- `miniaturas.rs` — modo `--miniaturas`: enumerar, capturar, achicar, PNG (WIC), base64, JSON.
- `main.rs` — argumentos nuevos, líneas `placa:`/`codificador:`, sin títulos, tope de software.
- `nativo/probar.ps1` — fuente por id.

**App**
- `src-tauri/src/transmisor.rs` — `fuentes_transmisor`, registro por transmisión en `Fin`; `src-tauri/src/lib.rs` (comandos).
- `src/lib/transmisorNativo.ts` — sin contador; `fuentes()`, `Fuente`, diagnóstico al terminar.
- `src/lib/transmisorSimulado.ts` — solo desarrollo/e2e.
- `src/lib/transmision.ts` (+ `.test.ts`) — mensajes por código, `recortarRegistro`, `elegirFuente` (puras).
- `src/lib/voz.svelte.ts`, `src/lib/prefs.ts` (+ test), `src/lib/vistas/Dock.svelte`, `src/lib/vistas/Configuracion.svelte`, `src/lib/novedades.ts`.
- Borrar: `src/lib/sdp.ts`, `src/lib/sdp.test.ts`.
- `e2e/pantalla.spec.ts`.

**Página (`D:\PROYECTOS\Thunderop-Website\`)**
- `src/lib/i18n/cuenta-messages.ts` — privacidad (es/en); `tests/privacidad.test.ts`.

---

### Task 1: Colección `diagnosticos`

**Files:**
- Create: `server/pb_migrations/9_zz_diagnosticos.js`
- Test: `server/tests/diagnosticos.test.ts`, `server/tests/rate-limits.test.ts`

**Interfaces:**
- Produces: la colección y reglas de las Global Constraints; regla de límite `{ label: "diagnosticos:create", maxRequests: 3, duration: 60 }` agregada a `settings.rateLimits.rules` con el mismo patrón que `9_zz_cuentas.js` (filtrar por label y concatenar). `down` borra la colección y la regla.

- [ ] **Step 1: Write the failing tests** en `diagnosticos.test.ts`: `it('el usuario crea el suyo')` → `pb.collection('diagnosticos').create({ user: id, version: '0.6.0', codigo: 4, contenido: 'placa: X' })` responde OK; `it('no a nombre de otro')` con el id de otro usuario → 400/403; `it('no puede leer ni tocar')` → `getList`, `getOne`, `update`, `delete` del propio → 403/404 (lista vacía también vale para `getList`); `it('sin sesión e incompleta')` → sin auth rechazado, con `nuevoUsuario('x', { incompleta: true })` → 403 con `falta`; `it('tope de tamaño')` → `contenido` de 65 537 caracteres → 400, de 65 536 → OK; `it('el admin lo lee')` → `h.admin.collection('diagnosticos').getList()` lo ve con `created`. En `rate-limits.test.ts`: `it('diagnósticos: 3 por minuto')` → el 4.º seguido da 429.
- [ ] **Step 2: Run** `npx vitest run tests/diagnosticos.test.ts tests/rate-limits.test.ts` → FAIL (no existe la colección).
- [ ] **Step 3: Implement** la migración (con su `down`).
- [ ] **Step 4: Run** `npx vitest run` (todo `server/tests`) → PASS.
- [ ] **Step 5: Commit** `feat(servidor): colección de diagnósticos de transmisión`

### Task 2: Tope por hora y limpieza

**Files:**
- Create: `server/pb_hooks/diagnosticos.pb.js`
- Test: `server/tests/diagnosticos.test.ts`

**Interfaces:**
- Produces: `onRecordCreateRequest` de `diagnosticos` (no superuser): si el usuario ya tiene `DIAGNOSTICOS_POR_HORA` (por defecto 20) con `created` en la última hora → `throw new TooManyRequestsError('Demasiados diagnósticos, probá más tarde.')`. `cronAdd('diagnosticos-viejos', '0 4 * * *', ...)` borra los de `created < ahora - DIAGNOSTICOS_DIAS` días (por defecto 30). Estilo de `cuentas.pb.js` (variables leídas con `$os.getenv` dentro del handler).

- [ ] **Step 1: Write the failing tests:** harness con `DIAGNOSTICOS_POR_HORA=2` → el 3.º del mismo usuario 429 y el de otro usuario OK; harness con `DIAGNOSTICOS_DIAS=0` → el admin corre `POST /api/crons/diagnosticos-viejos` y el diagnóstico ya no está (mismo patrón que el test de `cuentas-sin-confirmar`).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** `npx vitest run` → PASS.
- [ ] **Step 5: Commit** `feat(servidor): tope y limpieza de diagnósticos`

### Task 3: Transmisor — fuente por id, varios monitores y registro sin datos personales

**Files:**
- Modify: `nativo/transmisor/src/captura.rs`, `nativo/transmisor/src/main.rs`, `nativo/probar.ps1`

**Interfaces:**
- Produces (`captura.rs`): `pub enum Objetivo { Principal, Monitor(String), Ventana(isize) }` y `pub fn objetivo(que: &str) -> Option<Objetivo>` (`"pantalla"` → `Principal`; `"monitor:<x>"` con `x` no vacío → `Monitor(x)`; `"ventana:<n>"` con `n` entero > 0 → `Ventana(n)`; cualquier otra cosa → `None`). `pub fn monitores() -> Vec<Monitor>` con `pub struct Monitor { pub hmon: HMONITOR, pub dispositivo: String, pub principal: bool, pub ancho: i32, pub alto: i32 }` (de `EnumDisplayMonitors` + `GetMonitorInfoW` con `MONITORINFOEXW`). `elegir(que)` usa `objetivo`: `Monitor` busca por `dispositivo`, `Ventana` exige `IsWindow`; si no está → error (código 2 como hoy). Se borra la búsqueda por parte del título.
- Produces (`main.rs`): `capturando monitor <dispositivo> a WxH…` / `capturando ventana a WxH…` (sin título); al armar el dispositivo, `placa: <Description>` (`IDXGIDevice::GetAdapter()?.GetDesc()`). Mensaje de error de fuente inexistente sin el texto pedido. Comentario de uso actualizado.
- `probar.ps1`: el segundo parámetro pasa a ser `pantalla`, `monitor:\\.\DISPLAYn` o `ventana:<hwnd>`.

- [ ] **Step 1: Write the failing Rust test** `#[test] fn parsea_objetivo()` en `captura.rs`: `pantalla`, `monitor:\\.\DISPLAY2`, `ventana:1234` dan lo esperado; `monitor:`, `ventana:0`, `ventana:abc`, `Chrome` → `None`.
- [ ] **Step 2: Run** `cargo test` en `nativo/transmisor` → FAIL. **Step 3: Implement.** **Step 4: Run** `cargo test` y `cargo build --release` → PASS.
- [ ] **Step 5: Verificar a mano** (con un segundo monitor o una TV): `.\probar.ps1 <sala> 'monitor:\\.\DISPLAY2'` transmite el segundo; `pantalla` sigue siendo el principal; `ventana:1` → sale con 2. Revisar `%TEMP%`/la consola: ningún título.
- [ ] **Step 6: Commit** `feat(transmisor): fuente por id y cualquier monitor`

### Task 4: Transmisor — compresor por software de respaldo

**Files:**
- Modify: `nativo/transmisor/src/mf.rs`, `nativo/transmisor/src/main.rs`

**Interfaces:**
- Produces (`mf.rs`): `Codificador::new` prueba primero el de hardware (como hoy); si no hay (o `TRANSMISOR_SOFTWARE=1`), crea `CLSID_MSH264EncoderMFT` con `CoCreateInstance` (antes `CoInitializeEx` MTA en ese hilo) y queda en modo sincrónico. `pub software: bool` en `Codificador`. En `correr`, el modo software: por cada textura NV12 la copia a una textura `D3D11_USAGE_STAGING` + `D3D11_CPU_ACCESS_READ` (`CopyResource`, `Map`), empaqueta los planos sin el relleno de `RowPitch` en un `MFCreateMemoryBuffer`, `ProcessInput`, y saca con `ProcessOutput` hasta `MF_E_TRANSFORM_NEED_MORE_INPUT` dándole una muestra propia del tamaño de `GetOutputStreamInfo().cbSize` (el MFT de Microsoft no las provee). Se mantienen la repetición del último cuadro, los keyframes pedidos, el bitrate en vivo y SPS/PPS delante de cada keyframe. Si fallan los dos → `Falla::SinCodificador` (código 3).
- Produces (función pura, `mf.rs`): `pub fn empaquetar_nv12(datos: &[u8], pitch: usize, ancho: usize, alto: usize) -> Vec<u8>` (Y: `alto` filas de `ancho`; UV: `alto/2` filas de `ancho`, que empiezan en `pitch * alto`).
- Produces (`main.rs`): `codificador: <nombre> (hardware)` o `codificador: Microsoft H.264 (software, máx. 720p30)`. Con software, `Tuberia::armar` recalcula la salida con alto ≤ 720 y fps ≤ 30 antes de crear el compresor, también al rearmar y al cambiar la calidad en vivo. Comentario de códigos: 3 = "no hay ningún compresor H.264 (¿Windows N sin Media Feature Pack?)".

- [ ] **Step 1: Write the failing Rust test** `#[test] fn empaqueta_nv12_sin_relleno()`: 4×2 con `pitch` 8 (bytes de relleno distintos de los de imagen) → 12 bytes, sin ningún byte de relleno, Y y UV en orden.
- [ ] **Step 2: Run** `cargo test` → FAIL. **Step 3: Implement.** **Step 4: Run** `cargo test` → PASS.
- [ ] **Step 5: Verificar a mano:** `$env:TRANSMISOR_SOFTWARE=1; D:\lkt\release\transmisor.exe --probar` → `OK: N cuadros…` y el log dice `software`; `.\probar.ps1` con la variable → se ve en otra PC, a 720p30, y la CPU no se traba; sin la variable → `hardware` como antes.
- [ ] **Step 6: Commit** `feat(transmisor): compresor por software si la placa no tiene`

### Task 5: Transmisor — modo `--miniaturas` (lista)

**Files:**
- Create: `nativo/transmisor/src/miniaturas.rs`
- Modify: `nativo/transmisor/src/captura.rs`, `nativo/transmisor/src/main.rs`, `nativo/transmisor/Cargo.toml` (`serde_json = "1"`, `base64 = "0.22"`, ya en `Cargo.lock`; features `Win32_Graphics_Dwm`)

**Interfaces:**
- Produces: `transmisor --miniaturas <ancho> [pid a excluir]` imprime una línea JSON por fuente y sale con 0: primero los monitores (`{"tipo":"monitor","id":"\\\\.\\DISPLAY1","titulo":"Pantalla 1 (principal) · 1920×1080","pid":0,"png_base64":null}`), después las ventanas (`{"tipo":"ventana","id":"<hwnd decimal>","titulo":"<título>","pid":<pid>,"png_base64":null}`) en el orden de `EnumWindows` (de adelante hacia atrás). En esta task `png_base64` va siempre `null`.
- Produces (pura, `captura.rs`): `pub struct InfoVentana { pub titulo: String, pub clase: String, pub visible: bool, pub minimizada: bool, pub oculta: bool, pub herramienta: bool, pub con_dueno: bool, pub pid: u32 }` y `pub fn candidata(v: &InfoVentana, excluir: u32) -> bool` (visible, no minimizada, no `oculta` por DWM, no herramienta, sin dueño, título no vacío tras `trim`, clase distinta de `Progman`/`WorkerW`, `pid != excluir`). `ventanas()` arma `InfoVentana` con `IsWindowVisible`, `IsIconic`, `DwmGetWindowAttribute(DWMWA_CLOAKED)`, `GetWindowLongPtrW(GWL_EXSTYLE) & WS_EX_TOOLWINDOW`, `GetWindow(GW_OWNER)`, `GetClassNameW`.
- Se borra el modo `--ventanas`.

- [ ] **Step 1: Write the failing Rust tests:** `fn filtra_ventanas()` (una candidata buena pasa; cada condición por separado la saca, incluido `pid == excluir` y título `"   "`); `fn json_de_fuente()` (un título con comillas, `\` y acentos sale como JSON válido que `serde_json::from_str` vuelve a leer igual).
- [ ] **Step 2: Run** `cargo test` → FAIL. **Step 3: Implement.** **Step 4: Run** `cargo test` → PASS.
- [ ] **Step 5: Verificar a mano:** `transmisor.exe --miniaturas 320` con una ventana minimizada, otra en otro escritorio virtual y dos monitores: salen los dos monitores y solo las ventanas a la vista.
- [ ] **Step 6: Commit** `feat(transmisor): lista de monitores y ventanas en JSON`

### Task 6: Transmisor — imágenes de las miniaturas

**Files:**
- Modify: `nativo/transmisor/src/miniaturas.rs`, `nativo/transmisor/src/captura.rs`, `nativo/transmisor/Cargo.toml` (features `Win32_Graphics_Imaging`, `Win32_Storage_Xps` si `PrintWindow` lo pide)

**Interfaces:**
- Produces: para cada fuente, una captura de un solo cuadro con WGC (pool `CreateFreeThreaded` de 1 cuadro, sin cursor, `SetIsBorderRequired(false)` sin importar si falla); todas las sesiones se arrancan juntas y se espera hasta 1,5 s en total. Las ventanas que no dieron cuadro se prueban con `PrintWindow(hwnd, hdc, PW_RENDERFULLCONTENT)` en un DIB de 32 bits. El cuadro se copia a una textura staging, se achica a `<ancho>` px de ancho manteniendo la proporción, se codifica PNG con WIC (`IWICImagingFactory` → `GUID_ContainerFormatPng`, en memoria) y va en `png_base64` (`base64::engine::general_purpose::STANDARD`). Si nada funcionó, `null`. El proceso termina siempre antes de 3 s (se suelta todo y `exit(0)`).
- Produces (pura): `pub fn achicar_bgra(origen: &[u8], pitch: usize, ancho: usize, alto: usize, ancho_nuevo: usize) -> (Vec<u8>, usize, usize)` (promedio por bloques o vecino más cercano; alto nuevo = `alto * ancho_nuevo / ancho`, mínimo 1; si `ancho <= ancho_nuevo` no agranda).

- [ ] **Step 1: Write the failing Rust test** `fn achica_bgra()`: 4×2 rojo con `pitch` 20 a ancho 2 → 2×1, 8 bytes, todos rojos; 2×2 a ancho 4 → queda 2×2.
- [ ] **Step 2: Run** `cargo test` → FAIL. **Step 3: Implement.** **Step 4: Run** `cargo test` → PASS.
- [ ] **Step 5: Verificar a mano:** pegar una línea en un `data:image/png;base64,...` en el navegador y ver la miniatura de cada monitor y de un juego en pantalla completa ventana, de Chrome y de una ventana que WGC no captura (si aparece, con `PrintWindow`); medir que el pedido entero tarde menos de 2 s con 15 ventanas abiertas.
- [ ] **Step 6: Commit** `feat(transmisor): miniaturas de monitores y ventanas`

### Task 7 (se puede dejar para después): Ícono del programa

**Files:**
- Modify: `nativo/transmisor/src/miniaturas.rs`

**Interfaces:**
- Produces: campo `icono_base64` (PNG 32×32 o `null`) en las líneas de ventanas: `SendMessageTimeoutW(WM_GETICON, ICON_SMALL2)` con 50 ms, si no `GetClassLongPtrW(GCLP_HICONSM)`; `DrawIconEx` en un DIB de 32 bits y el mismo PNG de WIC de la Task 6.

- [ ] **Step 1: Implement.** **Step 2: Run** `cargo test` → PASS (sin tests nuevos: es solo Win32).
- [ ] **Step 3: Verificar a mano:** Chrome, el explorador y un juego muestran su ícono; una ventana colgada no demora el pedido más de 50 ms.
- [ ] **Step 4: Commit** `feat(transmisor): ícono del programa en las miniaturas`

### Task 8: App (Rust) — fuentes y registro de cada transmisión

**Files:**
- Modify: `app/src-tauri/src/transmisor.rs`, `app/src-tauri/src/lib.rs`

**Interfaces:**
- Produces: `#[tauri::command] async fn fuentes_transmisor(ancho: u32) -> Result<Vec<Fuente>, String>` que corre `transmisor --miniaturas <ancho> <std::process::id()>` y devuelve `parsear_fuentes(&stdout)`. `#[derive(Serialize, Deserialize)] pub struct Fuente { tipo: String, id: String, titulo: String, pid: u32, png_base64: Option<String>, #[serde(default)] icono_base64: Option<String> }`. `pub fn parsear_fuentes(s: &str) -> Vec<Fuente>` ignora líneas que no son JSON válido o con `tipo` distinto de `monitor`/`ventana`.
- Modifies: `iniciar_transmisor` recibe `que` = `monitor:<id>` / `ventana:<id>` (sin cambios de firma). stderr pasa a `Stdio::piped()` y se lee en otro hilo; las dos salidas se escriben al archivo de `%TEMP%` (como hoy) **y** a un `String` de esa transmisión. `Estado::Fin { codigo: i32, registro: String }` se manda después de `wait()` y de que terminen los dos lectores.
- Se borra `ventanas_transmisor` (y en `lib.rs` se registra `fuentes_transmisor`).

- [ ] **Step 1: Write the failing Rust test** `#[test] fn parsea_fuentes()` en `transmisor.rs`: dos líneas buenas (un monitor, una ventana sin `icono_base64`), una línea rota y una con `tipo: "otro"` → 2 fuentes con los campos bien.
- [ ] **Step 2: Run** `cargo test` en `app/src-tauri` → FAIL. **Step 3: Implement.** **Step 4: Run** `cargo test` y `cargo clippy` → PASS.
- [ ] **Step 5: Commit** `feat(app): fuentes del transmisor y registro por transmisión`

### Task 9: App — sacar la transmisión de WebView2

**Files:**
- Modify: `app/src/lib/voz.svelte.ts`, `app/src/lib/transmisorNativo.ts`, `app/src/lib/transmision.ts`, `app/src/lib/transmision.test.ts`, `app/src/lib/prefs.ts`, `app/src/lib/prefs.test.ts`, `app/src/lib/vistas/Configuracion.svelte`, `app/src/lib/vistas/Dock.svelte`
- Delete: `app/src/lib/sdp.ts`, `app/src/lib/sdp.test.ts`

**Interfaces:**
- Produces (`transmision.ts`, reemplaza a `mensajeTransmision(e)`): `mensajeTransmision(codigo: number): string` — `0` → `''`; `2` → `'No se encontró esa pantalla o ventana. ¿Se cerró?'`; `3` → `'Tu Windows no tiene los componentes de video para transmitir (Media Feature Pack).'`; `5` → `'No se pudo conectar la transmisión al servidor.'`; `-1` → `'No se pudo abrir el transmisor.'`; cualquier otro (4 incluido) → `'Se cortó la transmisión. Probá de nuevo.'`.
- Modifies (`voz.svelte.ts`): `transmitir(calidad: Calidad, fuente: { tipo: 'monitor' | 'ventana'; id: string; pid: number })` solo llama a `arrancarNativo`, que arma `que = \`${fuente.tipo}:${fuente.id}\`` y manda el sonido con `pid` solo si es ventana. Si `iniciarNativo` no da `'ok'` y sigue vigente → `voz.error = mensajeTransmision(res)`; al terminar después de arrancar, igual con su código. Se borran `arrancar`, `agrandarVentana`, `LogicalSize`, `installBaselineH264Patch`, el handler de `LocalTrackUnpublished` de la pantalla propia, la rama no nativa de `dejarDeTransmitir` y de `pistaPantallaPropia`, y `__voz.terminarCaptura`.
- Modifies (`transmisorNativo.ts`): se borran `CLAVE`, `TOPE`, `fallas`, `hayNativo`, `resultadoNativo`, `Ventana` y `ventanas`.
- Modifies (`prefs.ts`): sin `gpu` (tipo, defaults y `leerPrefs`); `CALIDADES` sin `ancho` ni `mbps` (WebView2), `mbpsNativo` pasa a llamarse `mbps`. `Configuracion.svelte`: se borra la casilla "Codificar con la GPU" y su aclaración.
- `Dock.svelte` en esta task (puente hasta la Task 11): sin la lista de ventanas; "Empezar" transmite el monitor principal con `transmitir(calidad, { tipo: 'monitor', id: 'pantalla', pid: 0 })`, y `arrancarNativo` manda `que = 'pantalla'` cuando `id === 'pantalla'`.

- [ ] **Step 1: Write the failing tests:** `transmision.test.ts` con cada código de arriba; `prefs.test.ts` sin `gpu` (los dos tests de `gpu` se borran; `leerPrefs()` no tiene la clave aunque esté guardada).
- [ ] **Step 2: Run** `npx vitest run src/lib/transmision.test.ts src/lib/prefs.test.ts` → FAIL.
- [ ] **Step 3: Implement.** Verificar con `rg "setScreenShareEnabled|getDisplayMedia|BaselineH264|agrandarVentana|fallasNativo|hayNativo|resultadoNativo|\.gpu\b" app/src` → nada.
- [ ] **Step 4: Run** `npm test` y `npm run check` → PASS, 0 errores.
- [ ] **Step 5: Commit** `refactor(app): solo el transmisor nativo`

### Task 10: App — transmisor simulado para los e2e

**Files:**
- Create: `app/src/lib/transmisorSimulado.ts`
- Modify: `app/src/lib/transmisorNativo.ts`, `app/e2e/pantalla.spec.ts`

**Interfaces:**
- Produces (`transmisorSimulado.ts`): `simularNativo(op: Opciones, canal: (m: Estado) => void): { detener(): void; calidad(fps: number, alto: number): void }` — conecta otro `Room` de `livekit-client` con `op.url`/`op.token` (el de `/token-pantalla`, identidad `<id>.pantalla`), publica `canvas.captureStream(op.fps)` (un `<canvas>` de `op.alto*16/9`×`op.alto` que se repinta con la hora) como `Track.Source.ScreenShare`, y avisa `{ tipo: 'transmitiendo' }`; `detener()` desconecta y avisa `{ tipo: 'fin', codigo: 0, registro: 'simulado' }`. `fuentesSimuladas(): Fuente[]` → un monitor `{ tipo: 'monitor', id: 'simulado', titulo: 'Pantalla 1 (principal)', pid: 0, png_base64: null }`.
- Modifies (`transmisorNativo.ts`): fuera de Tauri y con `import.meta.env.DEV`, `iniciarNativo`, `calidadNativo`, `detenerNativo` y `fuentes()` usan el simulado (import dinámico, así no entra al build de producción); en producción fuera de Tauri no hacen nada.
- DEV: `__voz.terminarCaptura()` pasa a cortar el simulado con código 0 (lo que haría el transmisor al cerrarse la ventana).

- [ ] **Step 1: Adaptar** `e2e/pantalla.spec.ts`: mismo guion (transmitir, vista previa, ver, espectadores, dejar de ver/ver rápido, Caro no se suscribe sola, cortar, captura cortada sin avisos, desconectarse, dos transmisiones a la vez), ahora contra la pantalla de `<id>.pantalla`; sin `Calidad` 720p si el simulado no lo necesita.
- [ ] **Step 2: Run** `npx playwright test e2e/pantalla.spec.ts` → PASS. `npm run build` y comprobar con `rg "captureStream" build` → nada (el simulado no entró).
- [ ] **Step 3: Commit** `test(app): e2e de pantalla con transmisor simulado`

### Task 11: App — selector con miniaturas

**Files:**
- Modify: `app/src/lib/vistas/Dock.svelte`, `app/src/lib/transmisorNativo.ts`, `app/src/lib/transmision.ts`, `app/src/lib/transmision.test.ts`

**Interfaces:**
- Consumes: Tasks 5, 6, 8, 9, 10.
- Produces (`transmisorNativo.ts`): `export type Fuente = { tipo: 'monitor' | 'ventana'; id: string; titulo: string; pid: number; png_base64: string | null; icono_base64?: string | null }`; `fuentes(ancho = 320): Promise<Fuente[]>` (`invoke('fuentes_transmisor', { ancho })`, `[]` si falla).
- Produces (pura, `transmision.ts`): `elegirFuente(lista: Fuente[], anterior: { tipo: string; id: string } | null): Fuente | null` — la misma (tipo + id) si sigue; si no, el primer monitor; si no, la primera; si la lista está vacía, `null`.
- `Dock.svelte`: el diálogo "Transmitir pantalla" (más ancho, con scroll interno) muestra "Pantallas" y "Ventanas" como grillas de botones-tarjeta (`aria-pressed` en la elegida, `img` con `alt` = título, texto del título recortado con `title` completo, ícono si hay, cuadro gris si no hay imagen); "Buscando pantallas y ventanas…" mientras llega el primer pedido; refresca cada 3 s mientras está abierto (sin pedidos superpuestos; al cerrar se frena y una respuesta tardía se descarta); conserva la elección con `elegirFuente`; "Empezar" deshabilitado sin fuente; calidad como hoy. `empezar` → `transmitir(calidad, elegida)`. El botón de calidad en vivo queda siempre (todas las transmisiones son nativas): se borra el `{:else}` sin flechita. Se borra el puente de la Task 9 (`id === 'pantalla'`).

- [ ] **Step 1: Write the failing test** en `transmision.test.ts`: `elegirFuente` conserva la elegida; si desaparece toma el primer monitor; sin monitores la primera ventana; vacía → `null`; misma id con otro tipo no cuenta como la misma.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** `npm test`, `npm run check` y `npx playwright test e2e/pantalla.spec.ts` → PASS.
- [ ] **Step 5: Verificar a mano** (`npm run tauri dev`, sala con otra PC mirando): con dos monitores se ven los dos y se transmite el segundo; una ventana con el mismo título que otra → se transmite la elegida y suena solo su programa; minimizar una ventana la saca de la lista en ≤3 s; abrir y cerrar el diálogo rápido varias veces no deja `transmisor.exe` en el Administrador de tareas; la app no se traba mientras carga.
- [ ] **Step 6: Commit** `feat(app): elegir qué transmitir con miniaturas`

### Task 12: App — subir el diagnóstico

**Files:**
- Modify: `app/src/lib/transmisorNativo.ts`, `app/src/lib/transmision.ts`, `app/src/lib/transmision.test.ts`

**Interfaces:**
- Consumes: Task 1, Task 8 (`Fin.registro`).
- Produces (pura, `transmision.ts`): `recortarRegistro(texto: string, max = 60_000): string` — primero reemplaza las rutas de usuario (Global Constraints); si queda más largo que `max`, deja los primeros 8 000 caracteres + `\n…[recortado]…\n` + el final, con el total ≤ `max`.
- Produces (`transmisorNativo.ts`): `subirDiagnostico(codigo: number, registro: string): Promise<void>` — solo en Tauri y con `pb.authStore.record`; `pb.collection('diagnosticos').create({ user, version: await getVersion(), codigo, contenido: recortarRegistro(registro) }, { requestKey: null })`; cualquier error se ignora. Se llama una vez por cada `{ tipo: 'fin' }` que llega por el canal (antes o después de `'transmitiendo'`, también después del corte por tiempo de 20 s), y con `codigo -1` y el texto del error si `invoke('iniciar_transmisor')` falla.

- [ ] **Step 1: Write the failing tests:** `recortarRegistro` con `C:\Users\Jorge Lopez\AppData\x.log`... (la ruta queda `C:\Users\…\AppData\x.log`), texto corto sin cambios, 200 000 caracteres → largo ≤ 60 000, empieza con la primera línea y termina con la última, tiene la marca.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** `npm test` y `npm run check` → PASS.
- [ ] **Step 5: Verificar a mano** contra un servidor local (`server/pocketbase.exe serve` con las migraciones): transmitir y cortar → aparece un diagnóstico con código 0, `placa:` y `codificador:`; cerrar la ventana transmitida → otro con 0; `TRANSMISOR_FALLAR=5` → código 4 con las líneas de falla; ningún título de ventana en `contenido`.
- [ ] **Step 6: Commit** `feat(app): diagnóstico de cada transmisión al servidor`

### Task 13: Página — política de privacidad

**Files (repo `D:\PROYECTOS\Thunderop-Website`):**
- Modify: `src/lib/i18n/cuenta-messages.ts`
- Create: `tests/privacidad.test.ts`

**Interfaces:**
- Privacidad, `es`: en "Qué datos guardamos" se suma: `'Si transmitís tu pantalla, un registro técnico de cada transmisión: versión de la app, modelo de la placa de video, qué compresor se usó, cuadros por segundo, velocidad y errores. No incluye imágenes, nombres de ventanas ni de programas.'`; en "Para qué los usamos": `'El registro técnico de las transmisiones, para encontrar y arreglar fallas. Solo lo ve el equipo de Thunderop y se borra a los 30 días.'`. Lo mismo en `en`. Si el servidor ya arrancó con los términos `1` publicados (plan 7, Task 11 hecha), la versión de los términos sube a `2` acá y en `TERMINOS_VERSION`; si no, se queda en `1`.
- Test (`node:test`, como `tests/locale.test.ts`): la privacidad en `es` y en `en` menciona el registro técnico y los 30 días.

- [ ] **Step 1: Write the failing test.** **Step 2: Run** `node --test tests/privacidad.test.ts` (como corre `locale.test.ts`) → FAIL.
- [ ] **Step 3: Implement.** **Step 4: Run** el test, `npx playwright test` y `npm run build` → PASS.
- [ ] **Step 5: Commit** `docs(privacidad): registro técnico de las transmisiones`

### Task 14: Novedades, prueba completa y despliegue (con OK de Jorge en cada paso)

**Files:**
- Modify: `app/src/lib/novedades.ts`

- [ ] **Step 1:** Novedades 0.6.0: se cambia la línea "La transmisión de pantalla nueva ya no se apaga para siempre por una sola falla." por: elegir qué transmitir con miniaturas (cualquier pantalla, también la segunda, o cualquier ventana); si la placa no tiene compresor, se transmite igual con la CPU (hasta 720p30); se sacó la transmisión vieja; cuando una transmisión falla, se manda un registro técnico para arreglarla. `npm test` y `npm run check` → PASS.
- [ ] **Step 2: Prueba completa a mano** con `npm run release` local instalado en la PC de Jorge y en la de un amigo: monitor principal, segundo monitor, ventana con su sonido, cambio de calidad en vivo, `TRANSMISOR_SOFTWARE=1`, y que cada corte deje su diagnóstico (servidor local o de producción ya desplegado).
- [ ] **Step 3: Desplegar** `pb_migrations/9_zz_diagnosticos.js` y `pb_hooks/diagnosticos.pb.js` (con copia de los actuales) junto con lo de cuentas o después; comprobar como usuario que `GET /api/collections/diagnosticos/records` da 403/vacío y que crear uno propio da 200.
- [ ] **Step 4: Commit** `docs: novedades de transmisión en la 0.6.0`; la publicación de la 0.6.0 y de la página siguen el plan 7 (Task 11, Step 5).
