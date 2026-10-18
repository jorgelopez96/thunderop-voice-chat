# Plan 1 — Prueba técnica de pantalla compartida

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Medir si una app Tauri (WebView2) transmite pantalla por LiveKit a 1080p60 con codificador por GPU y pierde menos de ~10% de FPS en un juego, y decidir entre seguir con WebView2 o agregar un módulo nativo.

**Architecture:** App Tauri descartable en `spikes/pantalla/`, con frontend vanilla TS + `livekit-client`. Se conecta a un `livekit-server --dev` local. Un mini servidor Node entrega los tokens. Un segundo cliente (pestaña de Chrome/Edge apuntando al mismo frontend) hace de espectador. La app muestra en pantalla las estadísticas WebRTC del emisor (`encoderImplementation`, resolución, fps, `qualityLimitationReason`).

**Tech Stack:** Tauri 2 (CLI 2.12.x), Vite + TypeScript, livekit-client 2.23.x, livekit-server-sdk 2.19.x (solo para tokens), LiveKit server 1.13.10 (binario de Windows), Vitest.

**Spec:** `docs/specs/2026-10-18-diseno-inicial.md` (sección "A cargo del constructor" → prueba técnica).

## Global Constraints

- Código descartable: vive solo en `spikes/pantalla/`. Las etapas siguientes no lo importan; se copian a mano las ideas que sirvan.
- Opciones a medir: 720p o 1080p, a 30 o 60 fps.
- Criterio de aprobación: pérdida de FPS del juego de menos de ~10% al transmitir en 1080p60, usando codificador por hardware.
- Nada pago. Las herramientas se instalan solo con aprobación del usuario.
- PC de prueba: Windows 11, NVIDIA RTX 3060 (driver 610.88), WebView2 155. RTX 3060 **no** tiene codificador AV1, así que no se prueba AV1.
- Nunca se commitea: `node_modules/`, `target/`, `spikes/pantalla/server/livekit-server.exe` ni ningún binario.

## Review Focus

1. **El selector de pantalla no aparece en WebView2** o `getDisplayMedia` falla por permisos → la app tiene que mostrar el error textual, no quedarse en blanco (Task 3, prueba manual 3.a).
2. **Códec por software en silencio** (`encoderImplementation` = `OpenH264` / `libvpx`) → el informe lo marca como "software" y no lo cuenta como aprobado (Task 2, test `classifies software encoders`).
3. **Reporte de estadísticas sin `outbound-rtp` de video** (todavía no empezó a enviar) → el resumen devuelve `null` en vez de romper (Task 2, test `returns null without video outbound`).
4. **El emisor baja la resolución por CPU o ancho de banda** (`qualityLimitationReason` ≠ `none`) → se muestra y queda en el informe (Task 2, test `reports quality limitation`).
5. **Audio del sistema no disponible al compartir una ventana** (Chromium solo lo da en pantalla completa) → se registra en el informe como limitación, no como fallo (Task 4, medición 4.d).

---

### Task 0: Repositorio y herramientas

**Files:**
- Create: `.gitignore`

**Interfaces:**
- Produces: repo git en `D:\ClaudeCode\Proyectos con REA\Discord mejorado\`, Rust (MSVC) y C++ Build Tools instalados.

- [ ] **Step 1: Pedir aprobación al usuario** para instalar con winget: `Rustlang.Rustup` y `Microsoft.VisualStudio.2022.BuildTools` (carga de trabajo "Desarrollo para el escritorio con C++"). Tauri los necesita en Windows. No se instala nada sin su sí.
- [ ] **Step 2: Instalar**

Run: `winget install --id Rustlang.Rustup -e` y `winget install --id Microsoft.VisualStudio.2022.BuildTools -e --override "--quiet --wait --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"`
Expected: `rustc --version` y `cargo --version` responden en una terminal nueva.

- [ ] **Step 3: `git init`** en la carpeta del proyecto. `.gitignore` con: `node_modules/`, `target/`, `dist/`, `*.exe`, `spikes/pantalla/server/data/`.
- [ ] **Step 4: Commit**

```bash
git add .gitignore docs/
git commit -m "docs: diseño inicial y plan de prueba de pantalla"
```

### Task 1: Scaffold, servidor LiveKit local y tokens

**Files:**
- Create: `spikes/pantalla/` (scaffold `npm create tauri-app@latest`, plantilla **vanilla-ts**, nombre `pantalla`)
- Create: `spikes/pantalla/server/README.md` (cómo bajar y arrancar el binario)
- Create: `spikes/pantalla/scripts/token-server.mjs`

**Interfaces:**
- Produces: LiveKit en `ws://127.0.0.1:7880` (credenciales dev `devkey` / `secret`). `GET http://127.0.0.1:7881/token?identity=<nombre>` → `{ "token": string, "url": "ws://127.0.0.1:7880" }` con CORS `*`, para la sala fija `prueba`, con permisos de publicar y suscribirse.

- [ ] **Step 0: Scaffold** — dentro de `spikes/`: `npm create tauri-app@latest pantalla -- --template vanilla-ts --manager npm`; luego `npm i livekit-client` y `npm i -D vitest livekit-server-sdk`. Verificar con `npm run tauri dev`: abre la ventana de ejemplo.
- [ ] **Step 1: Bajar** `livekit_1.13.10_windows_amd64.zip` de GitHub releases a `spikes/pantalla/server/` y descomprimirlo.
- [ ] **Step 2: Arrancar** `livekit-server.exe --dev --bind 127.0.0.1`
Expected: el log muestra que escucha en el puerto 7880.
- [ ] **Step 3: Implementar `token-server.mjs`** con `node:http` + `AccessToken` de `livekit-server-sdk` (`addGrant({ room: 'prueba', roomJoin: true, canPublish: true, canSubscribe: true })`, `toJwt()` es async).
- [ ] **Step 4: Verificar**

Run: `curl "http://127.0.0.1:7881/token?identity=a"`
Expected: JSON con `token` (un JWT de 3 partes) y `url`.

- [ ] **Step 5: Commit** `feat(spike): servidor livekit local y tokens`

### Task 2: Resumen de estadísticas del emisor (con test)

**Files:**
- Create: `spikes/pantalla/src/stats.ts`
- Test: `spikes/pantalla/src/stats.test.ts`

**Interfaces:**
- Produces:

```ts
export type SenderSummary = {
  encoder: string;            // encoderImplementation tal cual, o "desconocido"
  hardware: boolean | null;   // null si no se puede saber
  codec: string | null;       // mimeType del codec, ej. "video/H264"
  width: number; height: number; fps: number;
  limitation: string;         // qualityLimitationReason, "none" si no hay
};
export function summarizeSender(report: RTCStatsReport | Map<string, any>): SenderSummary | null;
```

Regla de `hardware`: `true` si `encoder` contiene `MediaFoundation`, `NVENC`, `AMF`, `QuickSync` o `(HW)` (sin distinguir mayúsculas); `false` si contiene `OpenH264`, `libvpx`, `libaom` o `SW`; `null` en cualquier otro caso. Toma la entrada `type === 'outbound-rtp' && kind === 'video'` con mayor `frameWidth`; `codec` sale del stat `codec` cuyo `id === outbound.codecId`.

- [ ] **Step 1: Escribir los tests** (Vitest, `Map` como reporte falso):
  - `classifies hardware encoder`: outbound con `encoderImplementation: 'MediaFoundationVideoEncoder'`, 1920×1080, `framesPerSecond: 60` → `{ hardware: true, width: 1920, height: 1080, fps: 60 }`.
  - `classifies software encoders`: `'OpenH264'` → `hardware: false`; `'libvpx'` → `hardware: false`.
  - `unknown encoder is null`: sin `encoderImplementation` → `encoder: 'desconocido', hardware: null`.
  - `returns null without video outbound`: solo un `outbound-rtp` de audio → `null`.
  - `reports quality limitation`: `qualityLimitationReason: 'cpu'` → `limitation: 'cpu'`.
  - `resolves codec`: `codecId: 'C1'` + stat `{ id: 'C1', type: 'codec', mimeType: 'video/H264' }` → `codec: 'video/H264'`.
- [ ] **Step 2: Correr y ver que fallan** — `npx vitest run src/stats.test.ts` → FAIL (`summarizeSender` no existe).
- [ ] **Step 3: Implementar `summarizeSender`** en `src/stats.ts`.
- [ ] **Step 4: Correr y ver que pasan** — mismo comando → 6 passed.
- [ ] **Step 5: Commit** `feat(spike): resumen de estadisticas del emisor`

### Task 3: App Tauri que transmite y mira

**Files:**
- Modify: `spikes/pantalla/index.html`, `spikes/pantalla/src/main.ts`

**Interfaces:**
- Consumes: `GET /token` (Task 1), `summarizeSender` (Task 2).
- Produces: UI con campo "nombre" y botón **Conectar**; selector de calidad `720p30 | 720p60 | 1080p30 | 1080p60`; selector de códec `h264 | vp8 | vp9`; botones **Transmitir** / **Detener**; zona de video de los demás; panel de estadísticas que se refresca cada 1 s con `summarizeSender` sobre `getRTCStatsReport()` del track de pantalla local. Todo error se muestra en un `<pre id="error">`.

- [ ] **Step 2: Implementar `main.ts`**: conecta con `new Room()` + `room.connect(url, token)`; transmite con

```ts
room.localParticipant.setScreenShareEnabled(true,
  { audio: true, contentHint: 'motion', resolution: { width, height, frameRate } },
  { videoCodec, simulcast: false, screenShareEncoding: { maxBitrate: 8_000_000, maxFramerate: frameRate } });
```

  (720p usa `maxBitrate: 4_000_000`). Se suscribe a `RoomEvent.TrackSubscribed` y adjunta video y audio remotos con `track.attach()`.
- [ ] **Step 3: Prueba manual en Tauri** — `npm run tauri dev`, nombre `emisor`, Conectar, Transmitir 1080p60 h264.
  - 3.a: aparece el selector de pantalla de WebView2. Si no aparece, anotar el error de `#error` y pasar a Task 4 igual: ese es un resultado.
  - 3.b: el panel muestra `encoder`, `hardware`, `1920×1080` y `fps` cerca de 60.
- [ ] **Step 4: Espectador** — abrir `http://localhost:1420` en Chrome, nombre `espectador`, Conectar → se ve la pantalla del emisor con sonido.
- [ ] **Step 5: Commit** `feat(spike): app tauri que transmite pantalla`

### Task 4: Medición e informe

**Files:**
- Create: `docs/spikes/2026-10-18-resultado-pantalla.md`

**Interfaces:**
- Consumes: todo lo anterior. La medición la hace el usuario con un juego suyo; el implementador le da el guion y completa el informe con sus números.

- [ ] **Step 1: Guion para el usuario** (un juego con contador de FPS: el overlay de NVIDIA o el del juego; la misma escena quieta durante 60 s en cada caso):
  - 4.a Base: juego solo → FPS promedio.
  - 4.b Transmitiendo 1080p60 h264 desde la app Tauri, con el espectador en Chrome → FPS promedio + panel de estadísticas.
  - 4.c Igual con 720p30.
  - 4.d Compartir la **ventana** del juego en vez de la pantalla: ¿llega el audio del juego?
  - 4.e RAM: Administrador de tareas, suma del árbol de procesos de `pantalla` (incluye `msedgewebview2.exe`) en reposo y transmitiendo, frente a Discord en llamada sin transmitir.
- [ ] **Step 2: Completar el informe** con una tabla por caso (FPS, % de pérdida respecto a la base, encoder, hardware sí/no, resolución/fps reales, limitation) y la RAM.
- [ ] **Step 3: Veredicto**, una de tres:
  - **Seguir con WebView2:** hardware = sí y pérdida < ~10% en 1080p60.
  - **Módulo nativo:** encoder por software, o pérdida ≥ ~10%, o el selector o la captura no funcionan en WebView2.
  - **Probar otro códec:** h264 sale por software pero vp8 o vp9 salen por hardware → repetir 4.b con ese códec antes de decidir.
- [ ] **Step 4: Commit** `docs: resultado de la prueba de pantalla`

**Límite conocido de esta prueba:** todo corre en la misma PC y en la red local, así que no mide internet real (subida de 6–8 Mbps, NAT/TURN). Eso se verifica en la etapa 6.
