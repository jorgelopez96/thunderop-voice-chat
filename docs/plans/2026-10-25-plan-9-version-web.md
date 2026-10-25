# Thunderop web: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que la misma app de `M:\THUNDEROP\Aplicacion\app` se use desde el navegador (PC y celular, Android e iPhone) en app.thunderop.com, con todo lo de escritorio y bien acomodada en el celular, sin abrir agujeros de seguridad en la app ni en la página.

**Architecture:** una sola base de código. `isTauri()` decide en tiempo de ejecución lo que es solo de escritorio; un `build:web` compila el mismo SvelteKit (adapter-static, SPA) apuntando al servidor de producción y Vercel lo sirve con cabeceras de seguridad. En pantallas de 768 px o menos, la app cambia a un layout de celular (pestañas, cajón, dock de llamada) armado con componentes nuevos; el escritorio no cambia.

**Tech Stack:** SvelteKit 2 / Svelte 5 (runes), Tauri 2 (solo escritorio), livekit-client, PocketBase (hooks JS), Vitest, Playwright, Vercel.

**Spec:** `docs/specs/2026-10-25-version-web.md` (leerlo antes de cada tarea). Boceto aprobado: `.superpowers/brainstorm/749-1792965798/content/celular-mezcla.html`.

## Global Constraints

- Un solo código: nada de carpetas copiadas. La app de escritorio no puede cambiar de comportamiento ni de aspecto (los e2e actuales siguen pasando).
- Mismas visuales del rediseño 0.7 (tokens de `src/app.css`, temas, modos Básico/Moderno). Reglas del rediseño: animar solo `transform`/`opacity`, nada de `backdrop-filter`, nada en modo Básico.
- "Celular" = `(max-width: 768px)`. Todo lo tocable ≥ 44 px.
- Transmitir: solo si `navigator.mediaDevices.getDisplayMedia` existe (navegadores de PC). En celular el botón no aparece.
- Una voz por cuenta: entrar desde otro dispositivo desconecta el primero; el que queda afuera ve **"Te conectaste a la voz desde otro dispositivo."**
- Sin librerías nuevas, salvo que una tarea lo diga.
- De a una tarea por vez con el OK de Jorge (aviso cada 100k tokens). Commits locales por tarea; push y publicación solo con su pedido.

## Review Focus

1. **Volver atrás en el celular** (botón atrás de Android, gesto de iOS): tiene que cerrar el cajón o la hoja abierta, o volver de un chat a la pantalla anterior, nunca salir de la app de golpe. → test en Task 5.
2. **Pantalla que gira o ventana que se achica** de PC a celular con una llamada o un chat abierto: no se pierde la llamada ni el chat elegido. → test en Task 5.
3. **Mantener apretado vs. scrollear:** un dedo que arrastra la lista no abre el menú. → test en Task 7.
4. **Permiso de micrófono o de notificaciones negado en el navegador:** cartel claro, la app sigue andando. → test en Task 2.
5. **Cancelar el selector de pantalla del navegador:** no queda "transmitiendo" a medias. → test en Task 3.

---

### Task 1: Compilación web, plataforma y cabeceras de seguridad

**Files:**
- Create: `app/src/lib/plataforma.svelte.ts`, `app/vercel.json`, `app/src/lib/plataforma.test.ts`
- Modify: `app/package.json` (script), `app/src/lib/vistas/MenuPerfil.svelte` (usar `esEscritorio`)

**Interfaces:**
- Produces: `esEscritorio: boolean` (= `isTauri()`), `pantalla: { movil: boolean }` (reactivo, `matchMedia('(max-width: 768px)')`, se actualiza con `change`), `puedeTransmitir(): boolean` (escritorio, o `typeof navigator.mediaDevices?.getDisplayMedia === 'function'`).

- [ ] **Step 1: Test** `plataforma.test.ts`: con un `matchMedia` falso que arranca en `matches: false` y dispara `change` a `true`, `pantalla.movil` pasa de `false` a `true`; `puedeTransmitir()` es `false` si `getDisplayMedia` no existe y `true` si existe.
- [ ] **Step 2:** `npx vitest run src/lib/plataforma.test.ts` → FAIL (módulo inexistente).
- [ ] **Step 3:** Implementar `plataforma.svelte.ts`. Reemplazar `'__TAURI_INTERNALS__' in globalThis` de `MenuPerfil.svelte` por `esEscritorio`.
- [ ] **Step 4:** Script `"build:web": "vite build --mode web"` y `app/.env.web` con `VITE_PB_URL=https://thunderop.duckdns.org` (commiteado; no es secreto).
- [ ] **Step 5:** `app/vercel.json`: `rewrites` de todo a `/index.html` y estas cabeceras en `/(.*)`:
  - `Content-Security-Policy`: `default-src 'self'; script-src 'self' 'wasm-unsafe-eval' https://www.youtube.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; media-src 'self' blob: https://thunderop.duckdns.org; connect-src 'self' https://thunderop.duckdns.org wss://thunderop.duckdns.org https://www.youtube.com; frame-src https://www.youtube.com; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'`
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: microphone=(self), display-capture=(self), camera=(), geolocation=(), payment=()`, `Cross-Origin-Opener-Policy: same-origin-allow-popups` (el popup de Google tiene que poder avisar).
- [ ] **Step 6:** `npm run build:web` → termina sin errores y `build/index.html` existe. `npx vitest run` → todo pasa.
- [ ] **Step 7:** Commit `web: compilación web, plataforma y cabeceras de seguridad`.

### Task 2: Login, links, notificaciones y permisos en el navegador

**Files:**
- Modify: `app/src/lib/cuenta.svelte.ts:53-55`, `app/src/lib/links.ts`, `app/src/lib/notificaciones.svelte.ts`, `app/src/lib/voz.svelte.ts` (textos de desconexión y de micrófono negado), `app/src/lib/links.test.ts` (o crear)
- Test: `app/e2e/web.spec.ts` (nuevo, corre en el navegador como el resto)

**Interfaces:**
- Consumes: `esEscritorio` (Task 1).
- Produces: `abrirLink(url: string): Promise<void>` que en la web hace `window.open(url, '_blank', 'noopener,noreferrer')` y solo acepta `http:`/`https:` en los dos mundos.

- [ ] **Step 1: Tests unitarios** en `links.test.ts`: `abrirLink('javascript:alert(1)')` y `abrirLink('data:text/html,x')` no llaman a `window.open` ni al opener; `abrirLink('https://a.com')` llama a `window.open` con `'noopener,noreferrer'` cuando no es escritorio.
- [ ] **Step 2: e2e** en `web.spec.ts`: con el permiso de micrófono negado (`context.grantPermissions([])` y `getUserMedia` que rechaza), entrar a una sala muestra el cartel **"No hay permiso para usar el micrófono. Habilitalo en el navegador para hablar."** y el chat sigue funcionando. Con `Notification.permission = 'denied'`, llega un mensaje de otro y no hay error en consola.
- [ ] **Step 3:** Correr ambos → FAIL.
- [ ] **Step 4:** `entrarCon`: en escritorio sigue con `urlCallback` + `openUrl`; en la web, `authWithOAuth2({ provider })` (popup de PocketBase), importando el opener solo en escritorio. `avisar`: en la web usa `new Notification(titulo, { body })` si `Notification.permission === 'granted'`, pidiendo permiso la primera vez solo si el usuario prendió "Notificaciones de escritorio". Textos de `voz.svelte.ts`: `DUPLICATE_IDENTITY` → "Te conectaste a la voz desde otro dispositivo."; micrófono negado → el texto del Step 2.
- [ ] **Step 5:** Tests → PASS; `npx vitest run` y los e2e existentes → PASS.
- [ ] **Step 6:** Commit `web: login con popup, links seguros y notificaciones del navegador`.

### Task 3: Transmitir desde un navegador de PC

**Files:**
- Modify: `app/src/lib/voz.svelte.ts` (nueva función, sin tocar `transmitir` nativo), `app/src/lib/vistas/Dock.svelte` (`abrirTransmision`)
- Test: `app/e2e/web.spec.ts`

**Interfaces:**
- Consumes: `esEscritorio`, `puedeTransmitir()` (Task 1); `CALIDADES` de `prefs.ts` (`mbpsNativo`, alto, fps).
- Produces: `transmitirNavegador(calidad: Calidad): Promise<void>` — `setScreenShareEnabled(true, { audio: true, resolution: { width, height, frameRate }, contentHint: 'motion' }, { videoEncoding: { maxBitrate: mbps * 1e6, maxFramerate: fps } })`. Si el usuario cancela el selector (`NotAllowedError`), no muestra error y deja `voz.transmitiendo = false`. Al terminar por el botón "Dejar de compartir" del navegador (`ended` de la pista), deja de transmitir igual que `dejarDeTransmitir()`.

- [ ] **Step 1: e2e** (Chromium con `--use-fake-ui-for-media-stream` y `--auto-select-desktop-capture-source=Entire screen`, flags agregados solo a este proyecto/spec en `playwright.config.ts`): Ana entra a la sala, toca Transmitir, elige 720p30 y Empezar → Beto ve la tarjeta con "EN VIVO" y puede "Ver". Otro test: `getDisplayMedia` rechaza con `NotAllowedError` → no aparece "EN VIVO" ni ningún cartel de error, y el botón vuelve a "Transmitir".
- [ ] **Step 2:** Correr → FAIL.
- [ ] **Step 3:** Implementar. En `Dock.svelte`, si `!esEscritorio` el modal de transmitir muestra solo la calidad y "Empezar" (el navegador elige qué compartir); si `!puedeTransmitir()` el botón no se muestra. La calidad en vivo (flechita) en la web reaplica `resolution` y `maxBitrate` sobre la pista publicada.
- [ ] **Step 4:** Tests → PASS; e2e de transmisión nativa simulada (`pantalla.spec.ts`) → siguen PASS.
- [ ] **Step 5:** Commit `web: transmitir con el compartir pantalla del navegador`.

### Task 4: Pantallas de afuera en el celular (pestañas)

**Files:**
- Create: `app/src/lib/vistas/movil/Pestanas.svelte`, `app/src/lib/vistas/movil/GruposMovil.svelte`, `app/src/lib/vistas/movil/PerfilMovil.svelte`, `app/src/lib/navMovil.svelte.ts`
- Modify: `app/src/lib/vistas/Principal.svelte`, `app/src/lib/vistas/Inicio.svelte` (una columna en celular), `app/src/lib/vistas/Amigos.svelte` (a todo el ancho en celular)

**Interfaces:**
- Consumes: `pantalla.movil` (Task 1), `grupoActual` y `miga` (`grupos.svelte.ts`).
- Produces: `navMovil: { pestana: 'inicio' | 'grupos' | 'amigos' | 'perfil' }`; `Pestanas.svelte` (props: ninguno; lee y escribe `navMovil.pestana`; se oculta cuando `grupoActual.id` está puesto).

- [ ] **Step 1: e2e** en `web.spec.ts` con viewport 390×844: se ven las 4 pestañas (Inicio, Grupos, Amigos, Perfil); "Amigos" muestra la lista de amigos a todo el ancho; "Perfil" muestra el editor de perfil y los botones **Configuración**, **Notificaciones** y **Cerrar sesión**; no hay scroll horizontal (`document.documentElement.scrollWidth <= 390`). Con viewport 1280×800, no hay pestañas y la barra de arriba es la de siempre.
- [ ] **Step 2:** Correr → FAIL.
- [ ] **Step 3:** Implementar. En celular, `Principal` muestra arriba una barra simple (logo y campanita) en lugar de la barra de escritorio, el contenido de la pestaña y `Pestanas` abajo (54 px + `env(safe-area-inset-bottom)`). Inicio: sin el panel de Amigos al costado, secciones en una columna, tarjetas a todo el ancho. GruposMovil: las tarjetas de grupo de Inicio; tocar una pone `grupoActual.id`.
- [ ] **Step 4:** Tests → PASS; e2e de escritorio → PASS.
- [ ] **Step 5:** Commit `web: pestañas y pantallas de afuera en el celular`.

### Task 5: Grupo en el celular (chat a pantalla completa y cajones)

**Files:**
- Create: `app/src/lib/vistas/movil/Cajon.svelte`, `app/src/lib/deslizar.ts`, `app/src/lib/deslizar.test.ts`
- Modify: `app/src/lib/vistas/Grupo.svelte`, `app/src/lib/vistas/Chat.svelte` (cabecera con ☰ y 👥 en celular)

**Interfaces:**
- Consumes: `pantalla.movil`, `navMovil` (Task 4).
- Produces: acción `deslizar(nodo, { alAbrirIzq(): void; alAbrirDer(): void })` que detecta un arrastre horizontal que empieza a ≤ 24 px del borde y recorre ≥ 60 px; `Cajon.svelte` (props `lado: 'izq' | 'der'`, `abierto: boolean`, `cerrar: () => void`, `children`). Abrir un cajón o un chat hace `history.pushState`; `popstate` lo cierra (atrás de Android / gesto de iOS).

- [ ] **Step 1: Tests unitarios** `deslizar.test.ts`: pointerdown en x=10, move a x=90 → llama `alAbrirIzq`; pointerdown en x=200 → no llama nada; move vertical de 100 px con 20 px horizontales → no llama nada.
- [ ] **Step 2: e2e** (390×844): tocar un grupo abre su último chat a pantalla completa y sin pestañas; ☰ abre el cajón con los grupos y las salas; elegir otra sala la abre y cierra el cajón; 👥 abre Participantes; `page.goBack()` con el cajón abierto lo cierra y sigue en el chat; otro `goBack()` vuelve a Grupos. **Review Focus 2:** con una llamada y un chat abiertos, cambiar el viewport a 1280×800 y de vuelta a 390×844 → sigue en la llamada y en el mismo chat.
- [ ] **Step 3:** Correr → FAIL.
- [ ] **Step 4:** Implementar. En celular, `Grupo` es una columna: el centro (chat o sala) ocupa todo; la barra de salas va adentro de `Cajon lado="izq"` (con una columnita de grupos a la izquierda, 56 px), Participantes en `Cajon lado="der"`. Cajones: `transform: translateX` (con transición solo en Moderno), velo oscuro sin blur.
- [ ] **Step 5:** Tests → PASS; e2e de escritorio → PASS.
- [ ] **Step 6:** Commit `web: grupo en el celular con cajones`.

### Task 6: Llamada en el celular (sala, dock y barrita)

**Files:**
- Create: `app/src/lib/vistas/movil/BarraLlamada.svelte`
- Modify: `app/src/lib/vistas/Voz.svelte`, `app/src/lib/vistas/Dock.svelte`, `app/src/lib/vistas/Principal.svelte`

**Interfaces:**
- Consumes: `voz` (`salaId`, `salaNombre`, `participantes`, `muteado`), `alternarMute`, `salirVoz` (de `voz.svelte.ts`), `pantalla.movil`, `navMovil`.
- Produces: `BarraLlamada.svelte` (sin props): "Sala · N en voz", silenciar, colgar; tocarla abre la sala (`grupoActual.id = voz.grupoId` y muestra la voz).

- [ ] **Step 1: e2e** (390×844): al entrar a la sala, las tarjetas van en grilla de 2 columnas y abajo está el dock de llamada (micrófono, auriculares, música, chat de la sala, colgar) en lugar de las pestañas; "chat de la sala" lo abre a pantalla completa con flecha para volver; ir a otro chat muestra la `BarraLlamada` arriba de la caja de mensaje; ir a Inicio la muestra arriba de las pestañas; tocarla vuelve a la sala; colgar desde la barrita sale de la llamada.
- [ ] **Step 2:** Correr → FAIL.
- [ ] **Step 3:** Implementar. Dock en celular: 62 px, una fila con los 5 botones (sonidos y transmitir quedan en un "…" si no entran; transmitir solo si `puedeTransmitir()`). Paneles de sonidos y música como hoja que sube desde abajo.
- [ ] **Step 4:** Tests → PASS; e2e de voz de escritorio → PASS.
- [ ] **Step 5:** Commit `web: llamada en el celular`.

### Task 7: Mantener apretado (menús y ordenar salas)

**Files:**
- Create: `app/src/lib/mantener.ts`, `app/src/lib/mantener.test.ts`, `app/src/lib/vistas/movil/HojaAcciones.svelte`
- Modify: `app/src/lib/vistas/Chat.svelte` (mensajes), `app/src/lib/vistas/Participantes.svelte`, `app/src/lib/vistas/Voz.svelte` (tarjetas), `app/src/lib/vistas/Grupo.svelte` (salas)

**Interfaces:**
- Produces: acción `mantener(nodo, alMantener: (x: number, y: number) => void)`: dispara a los 500 ms sin soltar y con movimiento ≤ 10 px; cancela con `pointerup`, `pointercancel` o movimiento mayor; bloquea el menú contextual nativo y la selección de texto mientras espera. `HojaAcciones.svelte` (props `abierta: boolean`, `cerrar: () => void`, `children`): hoja desde abajo, cierra tocando el velo o con atrás (mismo `pushState` de Task 5).

- [ ] **Step 1: Tests unitarios** `mantener.test.ts` (timers falsos): 500 ms quieto → llama; soltar a los 300 ms → no llama; mover 30 px (scroll) → no llama (**Review Focus 3**).
- [ ] **Step 2: e2e** (390×844, `page.touchscreen`/eventos de puntero): mantener apretado un mensaje propio abre la hoja con **Reaccionar**, **Responder**, **Editar** y **Borrar**; uno ajeno, sin Editar ni Borrar (salvo dueño); mantener una persona en la sala abre volumen y Ver perfil; el dueño mantiene una sala y la arrastra debajo de otra → el orden cambia (mismo `ordenarSalas` de escritorio).
- [ ] **Step 3:** Correr → FAIL.
- [ ] **Step 4:** Implementar. En celular, la barrita de herramientas por hover de los mensajes no se muestra; las mismas acciones van en la hoja. Ordenar salas en táctil: después del mantener, `pointermove` marca la sala de destino y `pointerup` llama `ordenarSalas`.
- [ ] **Step 5:** Tests → PASS; e2e de escritorio → PASS.
- [ ] **Step 6:** Commit `web: mantener apretado en el celular`.

### Task 8: Instalable, iPhone y avisos del celular

**Files:**
- Create: `app/static/manifest.webmanifest`, `app/static/icono-192.png`, `app/static/icono-512.png`, `app/static/apple-touch-icon.png` (generados de `src-tauri/icons/icono.svg`)
- Modify: `app/src/app.html` (manifest, `theme-color #0D0E13`, `apple-mobile-web-app-capable`, `viewport-fit=cover`), `app/src/app.css` (márgenes `env(safe-area-inset-*)`), `app/src/lib/vistas/Voz.svelte` (aviso)

- [ ] **Step 1: e2e** (390×844, user agent de iPhone): el `<link rel="manifest">` existe y el manifest tiene `name: "Thunderop"`, `display: "standalone"`, `start_url: "/"` e íconos de 192 y 512; al entrar a una sala en celular aparece una vez por sesión: **"Si bloqueás la pantalla o cambiás de app, la llamada puede cortarse."** (en iPhone: **"En iPhone, la llamada se corta si bloqueás la pantalla o cambiás de app."**).
- [ ] **Step 2:** Correr → FAIL.
- [ ] **Step 3:** Implementar. Sin service worker (no hace falta para instalarla en iOS ni para el objetivo; se suma si Android lo pide para el botón "Instalar").
- [ ] **Step 4:** Tests → PASS.
- [ ] **Step 5:** Commit `web: instalable y avisos del celular`.

### Task 9: Revisión de seguridad (servidor, app y página)

**Files:**
- Create: `server/tests/acceso-anonimo.test.ts`, `M:\THUNDEROP\Pagina web\src\hooks.server.ts` (o modificar si existe)
- Modify: `server/instalar-servidor.sh` y la unit `thunderop-pocketbase` (CORS), `app/src-tauri/tauri.conf.json` solo si la revisión lo pide

**Interfaces:**
- Consumes: el harness de tests del servidor (`server/tests/harness.ts`, `startPocketBase`, `nuevoUsuario`).

- [ ] **Step 1: Test** `acceso-anonimo.test.ts`: un cliente sin sesión recibe 401/403/404 (nunca datos) al listar o ver `users`, `groups`, `rooms`, `messages`, `privados`, `amistades`, `invites`, `sonidos`, `canciones`, `reproducciones`, `diagnosticos`; un usuario no ve mensajes, privados, sonidos ni salas de un grupo del que no es miembro; ningún cliente puede leer `bloqueados` ni `diagnosticos` ajenos; `POST /api/amigos/bloquear`, `/api/descarga/validar` sin código ni sesión → 401.
- [ ] **Step 2:** Correr → si algo falla, es un agujero: corregir la regla en una migración nueva `9_zz_seguridad.js` (no editar migraciones viejas) hasta que pase.
- [ ] **Step 3: CORS:** PocketBase con `--origins=https://app.thunderop.com,https://www.thunderop.com,https://thunderop.com,https://thunderop-web.vercel.app,http://tauri.localhost,tauri://localhost,http://localhost:1420,http://localhost:5173` en la unit (vía `instalar-servidor.sh`). Test manual documentado: `curl -H "Origin: https://evil.example" -I https://thunderop.duckdns.org/api/health` no devuelve `Access-Control-Allow-Origin: https://evil.example`.
- [ ] **Step 4: Página web:** `hooks.server.ts` agrega las mismas cabeceras de Task 1 (CSP adaptada a lo que usa la página: `connect-src` con `https://thunderop.duckdns.org`, Google Fonts si las usa, three.js local), `frame-ancestors 'none'`, HSTS, nosniff, Referrer-Policy y Permissions-Policy sin micrófono. e2e de la página: la respuesta de `/` trae `content-security-policy` y `x-content-type-options: nosniff`; los 63 e2e siguen pasando.
- [ ] **Step 5: App:** confirmar con `grep` que no hay `{@html}`, `innerHTML` ni `eval` en `app/src` y que todo link pasa por `abrirLink` (Task 2). Documentar el resultado en el commit.
- [ ] **Step 6:** `npx vitest run` en `server/` → todo pasa (incluido el nuevo).
- [ ] **Step 7:** Commits `seguridad: acceso anónimo y CORS acotado` (repo app) y `seguridad: cabeceras de la página` (repo web). **El despliegue del CORS al servidor y el push de la página van con Jorge** (son en producción).

### Task 10: Publicar app.thunderop.com (con Jorge)

- [ ] **Step 1:** Proyecto nuevo en Vercel desde el repo `thunderop-voice-chat`, raíz `app/`, build `npm run build:web`, salida `build`. Dominio `app.thunderop.com` (CNAME en Cloudflare, sin proxy).
- [ ] **Step 2:** Google: agregar `https://app.thunderop.com` a los dominios/orígenes autorizados del cliente OAuth (el redirect sigue siendo el de PocketBase).
- [ ] **Step 3:** Desplegar el CORS de Task 9 en el servidor (backup antes, como siempre) y verificar que la app de escritorio 0.6.1/0.7.x sigue conectando.
- [ ] **Step 4:** Página: `/web` redirige a `https://app.thunderop.com` (o el botón apunta directo); push de la página.
- [ ] **Step 5: Verificación desde afuera:** `curl -I https://app.thunderop.com` trae las cabeceras de Task 1; login con contraseña y con Google desde una PC y un celular; voz entre la web y la app de escritorio; transmitir desde Chrome de PC y mirarlo desde el celular; probar en un iPhone de los amigos.
- [ ] **Step 6:** Actualizar la memoria y avisarle a Jorge qué quedó probado y qué no.
