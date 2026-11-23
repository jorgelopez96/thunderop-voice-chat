# Cámara: vista previa + fondo difuminado — Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el botón de la cámara abra una vista previa (con fondo Sin efecto / Suave / Fuerte) y recién al tocar "Compartir cámara" la vean los demás.

**Architecture:** La pista de la cámara se crea a mano (`createLocalVideoTrack`) con el procesador de fondo de LiveKit, se muestra en un `<dialog>` y "Compartir" publica esa misma pista (`publishTrack`). Apagar la despublica y la frena. El fondo elegido vive en las prefs y se puede cambiar en vivo.

**Tech Stack:** livekit-client 2.23, @livekit/track-processors 0.8.3 (ya instalado; trae @mediapipe/tasks-vision 0.10.14), Svelte 5, Vitest, Playwright (Edge, cámara falsa).

**Spec:** `docs/specs/2026-11-22-camara-vista-previa-fondo-design.md`

## Global Constraints

- Nada de commits ni push salvo que Jorge lo pida.
- Los archivos del modelo se sirven desde la app (`static/fondo/`), nunca desde jsdelivr ni storage.googleapis en tiempo de uso.
- Radios: suave = 10, fuerte = 25.
- Textos exactos: botón "Compartir cámara", "Cancelar", título "Vista previa de la cámara", insignia "Solo vos ves esto", cargando "Preparando el fondo…", sin soporte "Tu equipo no permite difuminar el fondo.", opciones "Sin efecto" / "Suave" / "Fuerte".
- Simulcast igual que hoy: capas `VideoPresets.h360` y `h720`, resolución pedida 1920x1080 @ 60.
- "Pantalla + cámara" sigue sin vista previa, con el fondo guardado. Apagar sigue siendo inmediato.
- Mensajes de error de cámara: los mismos de hoy (`voz.svelte.ts` `alternarCamara`).

## Review Focus

1. Doble clic rápido en "Prender la cámara": una sola vista previa, una sola pista.
2. Salir de la llamada (o que se caiga) con la vista previa abierta: la cámara se apaga (luz apagada) y el diálogo se cierra.
3. Empezar "Pantalla + cámara" con la vista previa abierta: se cierra la previa y queda una sola cámara publicada.
4. Cambiar de cámara en la previa o en vivo: el difuminado se mantiene.
5. Prender/apagar varias veces seguidas: no quedan procesadores ni pistas vivas (cada apagado frena la pista y su procesador).

---

### Task 1: Preferencia `fondoCam`

**Files:**
- Modify: `app/src/lib/prefs.ts` (tipo `PrefsVoz`, `DEFAULTS`, `leerPrefs`)
- Test: `app/src/lib/prefs.test.ts`

**Interfaces:**
- Produces: `export type FondoCam = 'no' | 'suave' | 'fuerte'`; `PrefsVoz.fondoCam: FondoCam` (default `'no'`).

- [ ] **Step 1: Test que falla** — en `prefs.test.ts` agregar `fondoCam: 'no'` al `DEFAULTS` del test y:

```ts
it('fondoCam: default no, guarda suave/fuerte y descarta basura', () => {
  expect(leerPrefs().fondoCam).toBe('no');
  guardarPrefs({ fondoCam: 'fuerte' });
  expect(leerPrefs().fondoCam).toBe('fuerte');
  localStorage.setItem('dm.voz', JSON.stringify({ fondoCam: 'arcoiris' }));
  expect(leerPrefs().fondoCam).toBe('no');
});
```

- [ ] **Step 2:** `cd app && npx vitest run src/lib/prefs.test.ts` → FAIL.
- [ ] **Step 3:** implementar en `prefs.ts` (validar contra `['no','suave','fuerte']`).
- [ ] **Step 4:** mismo comando → PASS.

### Task 2: Assets del modelo + `fondo.ts`

**Files:**
- Create: `app/static/fondo/vision_wasm_internal.js`, `app/static/fondo/vision_wasm_internal.wasm` (copiados de `node_modules/@mediapipe/tasks-vision/wasm/`; solo la versión SIMD), `app/static/fondo/selfie_segmenter.tflite` (bajado una vez de `https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite`), `app/static/fondo/LICENSE` (Apache-2.0 de tasks-vision).
- Create: `app/src/lib/fondo.ts`

**Interfaces:**
- Consumes: `FondoCam` (Task 1).
- Produces:
  - `export const fondoDisponible: () => boolean` (envuelve `supportsBackgroundProcessors()`).
  - `export async function aplicarFondo(t: LocalVideoTrack, f: FondoCam, alProcesar?: () => void): Promise<void>` — si la pista no tiene procesador y `f !== 'no'`: `BackgroundProcessor({ mode: 'background-blur', blurRadius, assetPaths: { tasksVisionFileSet: '/fondo', modelAssetPath: '/fondo/selfie_segmenter.tflite' }, onFrameProcessed })` + `t.setProcessor(p)`. Si ya tiene: `switchTo({ mode: 'background-blur', blurRadius })` o `switchTo({ mode: 'disabled' })` para `'no'` (no se saca el procesador: evita el parpadeo al cambiar). Si `!fondoDisponible()` no hace nada. `alProcesar` se llama en cada cuadro procesado (lo usa la previa para sacar "Preparando el fondo…" y los tests).
  - `export const RADIO: Record<'suave' | 'fuerte', number> = { suave: 10, fuerte: 25 }`.

- [ ] **Step 1:** copiar/bajar los archivos; verificar `ls -la app/static/fondo` (4 archivos, el .wasm ~9 MB, el .tflite ~250 KB).
- [ ] **Step 2:** escribir `fondo.ts`. Sin test unitario (jsdom no tiene WebGL); lo cubren los e2e de la Task 3.
- [ ] **Step 3:** `cd app && npm run check` → sin errores nuevos.

### Task 3: Cámara en `voz.svelte.ts` (previa / compartir / apagar)

**Files:**
- Modify: `app/src/lib/voz.svelte.ts` (`alternarCamara` ~715, `camEnTransmision` ~604, `calidadCamara` ~631, `elegirCamara` ~757, limpieza al salir ~157, hooks `__voz`)
- Test: `app/e2e/camara.spec.ts`

**Interfaces:**
- Consumes: `aplicarFondo`, `fondoDisponible` (Task 2); `leerPrefs().fondoCam`.
- Produces (todo exportado desde `voz.svelte.ts`):
  - `voz.previaCam: boolean` (nuevo campo del `$state`), `voz.fondoCam: FondoCam`, `voz.fondoListo: boolean` (true desde el primer cuadro procesado o si el fondo es `'no'`).
  - `pistaPreviaCam(): LocalVideoTrack | undefined`
  - `abrirPreviaCamara(): Promise<void>` — no hace nada si ya hay previa o cámara; crea la pista con `deviceId` de prefs y 1920x1080@60, aplica el fondo guardado, `voz.previaCam = true`. En error: mismo mensaje que hoy en `voz.error`, frena lo que haya creado, `previaCam = false`.
  - `compartirCamara(): Promise<void>` — `publishTrack(previa, { source: Camera, simulcast: true, videoSimulcastLayers: [h360, h720] })`, `voz.camara = true`, `previaCam = false`.
  - `cancelarPreviaCamara(): void` — `stopProcessor()` + `stop()` de la previa.
  - `apagarCamara(): Promise<void>` — `unpublishTrack(pista, true)`, frena el procesador, `voz.camara = false`.
  - `cambiarFondo(f: FondoCam): Promise<void>` — `guardarPrefs`, `voz.fondoCam = f`, `aplicarFondo` sobre la previa o la publicada.
  - `alternarCamara` se borra. `camEnTransmision` usa una interna `prenderCamaraDirecto()` (cancela la previa si estaba, crea + fondo + publica) y `apagarCamara()`.
  - `calidadCamara` aplica los constraints a la pista de origen, no a la procesada: `(t as unknown as { _mediaStreamTrack: MediaStreamTrack })._mediaStreamTrack` (LiveKit expone en `mediaStreamTrack` la procesada; comentar por qué).
  - `elegirCamara`: si hay previa, `previa.setDeviceId(id)`; si no, lo de hoy.
  - Al salir de la sala o desconectarse: `cancelarPreviaCamara()`.
  - Hook de test `__voz.fondo(): { modo: FondoCam; cuadros: number } | null` (cuadros procesados de la pista de cámara, previa o publicada).

- [ ] **Step 1: Tests que fallan** en `camara.spec.ts`. Helper `compartir = (p) => p.getByRole('dialog', { name: 'Vista previa de la cámara' }).getByRole('button', { name: 'Compartir cámara' }).click()`. Actualizar el test existente "Ana prende la cámara…" para que llame a `compartir(a)` después del clic. Nuevos:
  - `'la vista previa no se comparte hasta tocar Compartir; Cancelar y Esc la apagan'`: Ana toca Prender → diálogo visible con video y "Solo vos ves esto"; `b.waitForTimeout(3000)` y `tarjeta(b,'Ana').locator('video')` count 0; Cancelar → diálogo cerrado y `__voz.fondo()` es `null`; repetir con `Escape`.
  - `'doble clic abre una sola vista previa'`: `dblclick` en Prender → un solo `dialog[open]`; compartir; Beto ve un solo `video` en la tarjeta de Ana.
  - `'el fondo Fuerte procesa cuadros, se guarda y se puede cambiar en vivo'`: abrir, clic "Fuerte", `expect.poll(() => __voz.fondo()?.cuadros).toBeGreaterThan(0)`, compartir, Beto ve frames > 0 (`framesDe`), apagar, volver a abrir → botón "Fuerte" con `aria-pressed="true"`.
  - `'salir de la llamada con la previa abierta apaga la cámara'`: abrir previa, `Desconectarse` → no hay `dialog[open]` y `__voz.fondo()` null.
  - `'prender y apagar tres veces seguidas sigue andando'`: loop 3× (Prender, Compartir, Beto ve video, Apagar, Beto no ve video).
- [ ] **Step 2:** `cd app && npx playwright test e2e/camara.spec.ts` → FAIL (no hay diálogo).
- [ ] **Step 3:** implementar las funciones de arriba en `voz.svelte.ts` (la pista en una variable de módulo, no dentro del `$state`).
- [ ] **Step 4:** los tests siguen fallando hasta la Task 4 (el diálogo). Correr `npm run check` → sin errores.

### Task 4: `CamaraPrevia.svelte` + Dock

**Files:**
- Create: `app/src/lib/vistas/CamaraPrevia.svelte`
- Modify: `app/src/lib/vistas/Dock.svelte` (`botonCamara` ~188, isla de escritorio ~179, menú `dock-mas` ~207, menús ~245)

**Interfaces:**
- Consumes: todo lo de la Task 3, `dispositivos()`, `elegirCamara()`, `fondoDisponible()`, `Video.svelte` (`pista`, `clase`, `etiqueta`).

- [ ] **Step 1:** `CamaraPrevia.svelte`: `<dialog aria-label="Vista previa de la cámara">` que se abre con `showModal()` cuando `voz.previaCam` pasa a true y se cierra cuando pasa a false. Contenido: `<Video pista={pistaPreviaCam()} clase="previa-cam" etiqueta="Vista previa de tu cámara">` con `transform: scaleX(-1)` solo en esta clase; insignia "Solo vos ves esto"; sobre el video, "Preparando el fondo…" mientras `!voz.fondoListo`; selector de cámara solo si `dispositivos().camaras.length > 1`; grupo de 3 botones `aria-pressed` Sin efecto / Suave / Fuerte (deshabilitados + leyenda si `!fondoDisponible()`); Cancelar / Compartir cámara (Compartir con foco inicial, así Enter comparte). `onclose` del dialog → si `voz.previaCam` sigue en true, `cancelarPreviaCamara()` (cubre Esc y la ✕). Estilo: el de los `<dialog>` del Dock (`dialog.fuentes`), ancho `min(560px, 94vw)`, video 16:9 con `object-fit: cover` y borde redondeado.
- [ ] **Step 2:** `botonCamara`: si `voz.camara` → `apagarCamara()`, si no → `abrirPreviaCamara()`; deshabilitado también con `voz.previaCam`. En escritorio, con la cámara prendida, envolverlo en `.doble` con una flecha "Fondo de la cámara" que abre un menú como el de Calidad (`<h3>Fondo</h3>` + las 3 opciones con `Check`). En celular, en `dock-mas` con la cámara prendida: las 3 opciones bajo un título "Fondo". Montar `<CamaraPrevia />` una vez en el Dock.
- [ ] **Step 3:** `cd app && npx playwright test e2e/camara.spec.ts e2e/pantalla.spec.ts` → PASS todo (pantalla.spec cubre "Pantalla + cámara").
- [ ] **Step 4:** `npm run check && npm test` → PASS.

### Task 5: Verificación final y demo para Jorge

- [ ] **Step 1:** `cd app && npx playwright test` (suite entera) → PASS.
- [ ] **Step 2:** con Playwright (MCP) abrir la app con cámara falsa, entrar a una sala, tocar Prender la cámara, elegir Fuerte y sacar capturas de la previa y de la tarjeta compartida para mostrarle a Jorge.
- [ ] **Step 3:** actualizar la memoria `project_thunderop.md` con el estado (sin commit, sin instalador).
