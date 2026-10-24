# Transmisión: selector con miniaturas, solo transmisor nativo y diagnóstico en el servidor

Fecha: 2026-10-24 · Estado: diseño acordado con Jorge en la charla, falta que revise las decisiones de Claude.
Entra en la app **0.6.0** (la misma de cuentas y login; todavía no se publicó).

## Por qué

Hoy hay dos maneras de transmitir: el transmisor nativo (Rust, captura con Windows Graphics Capture y comprime
con la placa) y, si ese falla, la de WebView2 (`setScreenShareEnabled` + el selector de Chromium). La de WebView2
pixela, obliga a agrandar la ventana para que se vea el selector y necesita un parche de SDP; el nativo anda mucho
mejor. Pero cuando el nativo falla en la PC de un amigo no sabemos por qué: el registro queda en su `%TEMP%`.
Además el selector propio solo ofrece "Pantalla completa" (el monitor principal) y una lista de títulos de
ventanas; con dos monitores no se puede elegir el segundo, y la ventana se busca por parte del título (dos
ventanas con títulos parecidos se confunden). Jorge quiere un selector "como Discord", con miniaturas.

## Lo que hay hoy (relevado en el código, rama `cuentas-login`, `d699742`)

- `app/src/lib/voz.svelte.ts`: `transmitir(calidad, que?, pid?)` prueba `arrancarNativo` y si no queda
  transmitiendo cae a `arrancar` (WebView2: `agrandarVentana` a 1280×800, `setScreenShareEnabled` con H.264 sin
  simulcast). `installBaselineH264Patch` (de `sdp.ts`) se instala al cargar LiveKit y reescribe `42e0xx` → `4200xx`
  en la respuesta remota para que WebView2 use el compresor de la GPU; lo prende `prefs.gpu` ("Codificar con la
  GPU" en Configuración). Solo afecta video H.264, y el único video que publica la app es el de WebView2: con el
  transmisor nativo (que publica desde otro proceso) **el parche no sirve para nada**.
- `app/src/lib/transmisorNativo.ts`: contador `dm.fallasNativo` (3 fallas seguidas del compresor, código 3, apagan
  el nativo para siempre en esa PC); `ventanas()` llama a `ventanas_transmisor` (`transmisor --ventanas`,
  líneas `pid<TAB>título`); `iniciarNativo` resuelve `'ok'` o el código de salida.
- `app/src/lib/transmision.ts`: `mensajeTransmision(e)` solo para errores de WebView2 (`NotAllowedError`).
- `app/src-tauri/src/transmisor.rs`: lanza `transmisor app <que> <fps> <mbps> <alto>` con el token en el entorno;
  stdout y stderr van a `%TEMP%\thunderop-transmisor.log` (se pisa en cada transmisión); avisa
  `Transmitiendo` y `Fin { codigo }` por un `Channel`.
- `nativo/transmisor/src/captura.rs`: `elegir("pantalla")` = `MonitorFromPoint(0,0, PRIMARY)`; cualquier otro
  texto = primera ventana visible cuyo título lo contenga. `ventanas()` = `EnumWindows` + visible + con título
  (incluye minimizadas, ventanas de herramientas y ocultas por DWM).
- `nativo/transmisor/src/mf.rs`: solo MFT de **hardware** asíncrono (`MFTEnum2` con `MFT_ENUM_FLAG_HARDWARE` y
  el LUID de la placa que captura); si no hay, `Falla::SinCodificador` → código 3. El log dice el nombre del MFT.
- `main.rs` imprime `capturando "<título de la ventana>" a WxH…` y cada 5 s `N cuadros, X fps, Y Mbps`.
- Códigos de salida: 0 bien, 2 no está la ventana, 3 sin compresor, 4 se rindió, 5 no conecta a LiveKit.
- Audio (`audio.rs`, `audioPantalla.ts`): pantalla → todo el sistema menos Thunderop; ventana → solo su proceso.
  No cambia.
- E2E `app/e2e/pantalla.spec.ts` prueba transmitir y mirar usando el camino de WebView2 (Chromium con captura
  falsa), así que se rompe al sacarlo.
- Servidor: PocketBase 0.40.5; guardia global de cuenta completa en `server/pb_hooks/cuentas.pb.js`; límites de
  intentos en la migración `9_zz_cuentas.js`.

## Objetivos

1. **Diagnóstico en el servidor.** Cuando termina o falla una transmisión nativa (cualquier código, también el 0 y
   también si no llegó a arrancar), la app sube el registro de **esa** transmisión a la colección nueva
   `diagnosticos`: `user` (relación), `version` (de la app), `codigo` (de salida), `contenido` (el registro, tope
   64 KB) y `created`. El registro dice la placa (nombre de la GPU), qué compresor se usó (hardware o software),
   las líneas de fps/Mbps, los errores y el código. **Ningún dato personal más que el id del usuario**: ni títulos
   de ventanas, ni nombres de programas, ni rutas con el usuario de Windows. Solo los superusuarios lo leen; un
   usuario solo puede crear los suyos (no listar, ver, cambiar ni borrar). La creación tiene límite de intentos.
   La política de privacidad (borrador en la página) lo menciona.
2. **Solo el transmisor nativo.** Se borra el camino de WebView2 entero: `arrancar`, `agrandarVentana`,
   `setScreenShareEnabled`, `sdp.ts` (+ test), la preferencia `gpu` y su casilla, `mensajeTransmision` de
   WebView2, el contador `dm.fallasNativo` (`hayNativo`/`resultadoNativo`). Si la placa no tiene compresor H.264
   por hardware, el transmisor usa el **compresor por software de Microsoft** (`CLSID_MSH264EncoderMFT`, MFT
   sincrónico, entrada NV12 en memoria copiada de la GPU) en vez de salir con 3, y lo dice en el registro.
   Cualquier falla muestra un error claro y se sube como diagnóstico.
3. **Selector como Discord.** El diálogo "Transmitir pantalla" muestra miniaturas de **cada monitor** (no solo el
   principal) y de **cada ventana capturable que no esté minimizada**, con su título (y el ícono del programa si
   sale barato), y las actualiza cada pocos segundos mientras está abierto. El transmisor gana un modo
   `transmisor --miniaturas <ancho>` que imprime una línea JSON por fuente
   `{tipo: 'monitor'|'ventana', id, titulo, pid, png_base64}`: una sola captura de WGC con tiempo máximo, o
   `PrintWindow` si WGC no da, achicada a ~320 px de ancho. Lo elegido se identifica por un id estable (monitor
   y `HWND`), no por parte del título. Sonido: monitor → todo menos Thunderop (como hoy); ventana → solo su
   programa (como hoy).

## No objetivos (por ahora)

- Transmitir una región, o varios monitores a la vez, o cambiar de fuente sin cortar.
- Un panel para leer los diagnósticos: Jorge los ve desde el panel de superusuario de PocketBase.
- Que el usuario mande el diagnóstico "a mano" o con un comentario.
- Mirar transmisiones o transmitir desde el navegador (la app de PC es la única).
- Linux u otras plataformas.

## Anti-objetivos (sería un fracaso aunque funcione)

- Que un usuario pueda leer diagnósticos (propios o ajenos) o crear uno a nombre de otro hablándole a la API.
- Que el diagnóstico lleve títulos de ventanas, nombres de programas, rutas `C:\Users\<nombre>` o cualquier dato
  que identifique qué estaba haciendo la persona.
- Que una cuenta sin completar (ver el diseño de cuentas) pueda subir diagnósticos: la guardia global sigue igual.
- Que alguien pueda llenar el disco del servidor subiendo diagnósticos en loop.
- Que una placa sin compresor por hardware se quede sin poder transmitir.
- Que el selector trabe la app (miniaturas lentas, ventanas colgadas) o deje procesos `transmisor` colgados.
- Romper lo que ya anda: calidad en vivo, vista previa, audio por programa, el rearme del supervisor, el
  contador de espectadores, ni nada de lo decidido en `docs/specs/2026-10-23-cuentas-y-login.md`.

## Restricciones

- Servidor: PocketBase 0.40.5, migraciones en `server/pb_migrations` (prefijo `9_zz_` para ir después de las de
  cuentas), hooks JS, tests con vitest en `server/tests`.
- App: Tauri 2 + Svelte 5, tests con vitest (`npm test`) y `npm run check`; e2e con Playwright en el navegador
  (sin Tauri).
- Transmisor: Rust, `windows` 0.62; nada de crates nuevos que no estén ya en `Cargo.lock` (`serde_json` y
  `base64` ya vienen con LiveKit; el PNG se arma con WIC de Windows).
- Lo que solo se puede comprobar con hardware (otro monitor, una placa sin compresor, juegos) se prueba a mano.
- Desplegar la migración/hook al servidor, publicar la app y la página se confirma con Jorge en el momento.
- Sin `Co-Authored-By` ni "Generated with Claude". Commit/push solo cuando Jorge lo pide.

## Lo que necesita a Jorge

- Probar con dos monitores (o con un segundo monitor/TV) y con la placa sin compresor (se simula con
  `TRANSMISOR_SOFTWARE=1`; si algún amigo tiene una PC sin placa, mejor).
- Confirmar el despliegue de la migración y el hook, y la versión de la política de privacidad.

## Decisiones que tomó Claude (Jorge puede corregirlas)

- **Se sube siempre que termina**, también con código 0 (cortó él): así se ve también cómo anduvo una
  transmisión buena (fps reales, compresor). Si no hay sesión o falla la subida, se descarta en silencio.
- **Retención: 30 días.** Una tarea programada borra los diagnósticos más viejos (variable
  `DIAGNOSTICOS_DIAS`, por defecto 30) y la política de privacidad lo dice.
- **Límites:** `diagnosticos:create` 3 cada 60 s por IP (regla de PocketBase) y como máximo 20 por usuario por
  hora (hook, variable `DIAGNOSTICOS_POR_HORA`); de más → 429.
- **64 KB = 65 536 caracteres** en el servidor; la app recorta antes a 60 000 dejando el principio (placa,
  compresor, arranque) y el final (por qué terminó), con una marca `…[recortado]…` en el medio.
- **El registro es el de esa transmisión**, armado en memoria por `transmisor.rs` (stdout + stderr), no releído
  de `%TEMP%` (que se pisa si se arranca otra). El archivo de `%TEMP%` se sigue escribiendo.
- **Sin datos personales:** el transmisor deja de imprimir el título de lo que transmite (dice `monitor 2` o
  `ventana`), y la app además reemplaza `X:\Users\<algo>` por `X:\Users\…` antes de subir.
- **Software limitado a 720p y 30 fps:** el compresor de Microsoft por CPU no llega a 1080p60 sin trabar la PC.
  Si se cae a software, el transmisor baja sola la salida a ≤720p/≤30 fps (también al cambiar la calidad en vivo)
  y lo anota. El selector de calidad no cambia.
- **Código 3** pasa a significar "no hay ningún compresor H.264, ni por software" (Windows N sin Media Feature
  Pack): la app muestra "Tu Windows no tiene los componentes de video para transmitir (Media Feature Pack)."
- **Id de monitor = nombre del dispositivo** (`\\.\DISPLAY1`, de `GetMonitorInfoW`): no cambia entre
  enumeraciones como el orden o el `HMONITOR`. Título "Pantalla N" (+ " (principal)") y la resolución. El id de
  ventana es el `HWND` en decimal. Al transmisor se le pasa `monitor:<id>` o `ventana:<id>` (`pantalla` sigue
  valiendo como "el principal", para `probar.ps1`).
- **Ventanas que se listan:** visibles, no minimizadas, con título, no ocultas por DWM (`DWMWA_CLOAKED`, p. ej. de
  otro escritorio virtual), sin dueño, que no sean `WS_EX_TOOLWINDOW`, ni el escritorio (`Progman`/`WorkerW`), ni
  de Thunderop (pid de la app).
- **Miniaturas en paralelo** con un tiempo máximo total de 1,5 s; la que no llega se prueba con `PrintWindow`; si
  tampoco, la tarjeta sale sin imagen pero se puede elegir. Se refresca cada 3 s mientras el diálogo está abierto
  y nunca hay dos pedidos a la vez. Si lo elegido desaparece se elige el primer monitor.
- **E2E sin WebView2:** en desarrollo y fuera de Tauri, `iniciarNativo` usa un transmisor **simulado** (otra
  conexión de LiveKit con el token de `/token-pantalla`, publicando un `<canvas>` como pantalla) y el selector
  ofrece un monitor falso. Así `e2e/pantalla.spec.ts` sigue probando todo el camino real del que mira (identidad
  `<id>.pantalla`, vista previa, espectadores) sin el código de WebView2. No entra en el build de producción.
- **Ícono del programa:** se intenta (`WM_GETICON`/`GCLP_HICONSM` → PNG con WIC) en una tarea aparte que se puede
  dejar para después si se complica; sin ícono, la tarjeta muestra solo el título.
- La política de privacidad se edita en la versión `1` si todavía no se hizo el arranque limpio del servidor
  (plan 7, Task 11); si ya se publicó, se sube a `2` en la página y en `TERMINOS_VERSION`.

## Lo que queda a criterio de quien lo construya

- El diseño visual de las tarjetas del selector (grilla, tamaño, cómo se marca la elegida), siguiendo el estilo
  del resto de los diálogos.
- Cómo se separa en `mf.rs` el camino sincrónico del asincrónico (enum, `Option` de eventos, dos funciones).
- Cómo se achica la imagen de la miniatura (promedio de bloques o vecino más cercano) y el formato intermedio.
- El texto exacto de los mensajes nuevos y de las novedades de la 0.6.0.
