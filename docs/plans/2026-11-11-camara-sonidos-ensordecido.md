# Cámara, "Pantalla + cámara", ensordecido visible y sonidos de otros grupos — plan

> **Para agentes:** SUB-SKILL REQUERIDA: superpowers:executing-plans (Jorge eligió ejecución directa en la sesión anterior). Casillas `- [ ]`.

**Objetivo:** cámara en la llamada (PC, navegador y celular), modo de transmisión "Pantalla + cámara" con la ventanita de la cámara que acomoda quien transmite, ensordecido visible en todas las listas y tocar sonidos de los otros grupos en la llamada.

**Arquitectura:** todo viaja por LiveKit sin cambios de esquema en PocketBase. Ensordecido y la posición de la ventanita van como **atributos** del participante (el token ya trae `canUpdateOwnMetadata`); la cámara es la pista `Camera` de LiveKit con simulcast; el aviso de un sonido suma la URL pública del archivo para que lo reproduzca un no miembro. El servidor solo agrega `ensordecido` y `camara` a la presencia de `/api/groups/{id}/voz`.

**Tech:** livekit-client 2.x (setCameraEnabled, setAttributes, simulcast, adaptiveStream ya prendido), Svelte 5, PocketBase hooks, Vitest, Playwright (cámara falsa: `--use-fake-device-for-media-stream` ya está en la config).

**Spec:** `docs/specs/2026-11-11-camara-sonidos-ensordecido.md` (leerla entera). Maqueta: `.superpowers/brainstorm/443-1794366780/content/camara-modos.html`.

## Restricciones globales

- Atributos: `ensordecido` = `'1'` o `''`; `camEnPantalla` = `''` (sin cámara en la transmisión) o `"x,y,w"` (fracciones 0–1 del ancho/alto de la pantalla: esquina superior izquierda y ancho). Por defecto `"0.73,0.71,0.25"`; `w` entre 0.15 y 0.45.
- Cámara: `resolution` ideal 1920×1080 a 60 fps (toma lo que dé la cámara), `simulcast: true`; se suscriben solas todas las cámaras (como los micrófonos).
- Apps viejas (0.8.0 y antes) en la misma llamada: ignoran atributos y pistas que no conocen; los avisos de sonido nuevos siguen trayendo `id`, `vol` y `nombre`.
- La URL de un sonido ajeno solo se baja si empieza con `${pb.baseURL}/api/files/` (no se sigue cualquier link que mande otro).
- Textos en castellano rioplatense; comentarios cortos en castellano. Sin `Co-Authored-By`. **No commitear ni pushear sin que Jorge lo pida.**

## Foco de revisión

1. Alguien con la app vieja en la llamada: no ve la cámara ni la ventanita y no se le rompe nada; un sonido de otro grupo no le suena (no lo encuentra) sin errores. → e2e no (no hay app vieja); revisar a mano en la revisión final.
2. Cortar la transmisión "Pantalla + cámara" cuando la cámara estaba apagada antes: la cámara se apaga y `camEnPantalla` queda `''`; si estaba prendida antes, sigue prendida. → test en Tarea 3.
3. Sin cámara en la PC o sin permiso: mensaje claro ("No se encontró una cámara." / "No hay permiso para usar la cámara…"), el botón vuelve a apagado, la llamada sigue. → test en Tarea 2.
4. Ensordecerse y salir de la sala: al entrar a otra, el atributo arranca en `''` (no queda "ensordecido" pegado). → test en Tarea 1.
5. Un aviso de sonido con URL de otro sitio: no se baja ni suena. → test unitario en Tarea 4.

---

### Tarea 1: Ensordecido (y cámara) visibles en todas las listas

**Archivos:** `server/pb_hooks/voz.pb.js` (GET `/voz`: cada persona suma `ensordecido: p.attributes?.ensordecido === "1"` y `camara: true` si tiene una pista de fuente `CAMERA` (o 1) sin mutear); `server/pb_hooks/livekit.js` si conviene un helper; `app/src/lib/voz.svelte.ts` (`Participante` suma `ensordecido: boolean` y `camara: string | undefined` = sid de su pista de cámara; `ensordecer()` publica el atributo; al conectar se publica `ensordecido: ''`); `app/src/lib/grupos.svelte.ts` (tipo de `enVoz.salas` con `ensordecido?`, `camara?`); vistas: `Grupo.svelte` (lista debajo de cada sala: micrófono tachado, auricular tachado o cámara, como la maqueta), `Voz.svelte` (tarjetas: auricular tachado en lugar del micrófono si está ensordecido), `Participantes.svelte`, `InicioPaneles.svelte`, `Inicio.svelte` (celular). Íconos de lucide: `MicOff`, `HeadphoneOff`, `Video`.
**Tests:** `server/tests/voz.test.ts`: `presencia: ensordecido y cámara salen de LiveKit` (con el RoomService: `UpdateParticipant` con `attributes: { ensordecido: '1' }` a un participante conectado por token… si conectar un participante real desde el test no es viable, probar la función pura que arma cada persona exportándola desde `livekit.js` como `persona(p, silenciados)`); `app/e2e/roles.spec.ts` no: crear `app/e2e/camara.spec.ts` con `ensordecido se ve en la lista de salas, la tarjeta y participantes de los demás` y `al salir y entrar a otra sala ya no figura ensordecido` (foco 4).

- [ ] Tests → fallan → implementar → pasan → `npm run check`.

### Tarea 2: Botón Cámara

**Archivos:** `voz.svelte.ts` (`voz.camara: boolean`; `alternarCamara(): Promise<void>` con `setCameraEnabled(true, { deviceId: leerPrefs().camara ?? 'default', resolution: { width: 1920, height: 1080, frameRate: 60 } }, { simulcast: true })`; errores `NotAllowedError` → "No hay permiso para usar la cámara. Habilitala en el navegador.", `NotFoundError`/`OverconstrainedError` → "No se encontró una cámara."; suscripción automática de `Track.Source.Camera` en `TrackPublished`, en el loop inicial y en `asegurarSuscripciones`; `limpiar()` resetea `camara`); `prefs.ts` (`camara?: string`); `Configuracion.svelte` (solapa Voz: select "Cámara" con `videoinput`, como Entrada); `Dock.svelte` (botón Cámara con `Video`/`VideoOff`, al lado de Transmitir; también en el celular); `movil/BarraLlamada.svelte` si tiene botones propios; `Voz.svelte` (tarjeta con `<Video>` de la cámara cuando `p.camara`; propia también; clic → agrandar en el escenario como una pantalla, con pantalla completa).
**Tests (e2e `camara.spec.ts`):** `Ana prende la cámara y Beto ve su video en la tarjeta (frames > 0)`; `sin cámara: aviso claro y la llamada sigue` (stub `getUserMedia` con video → `NotFoundError`) (foco 3); `apagar la cámara saca el video de la tarjeta`. Agregar a `__voz.stats()` los frames de cámara por remoto.

- [ ] Tests → fallan → implementar → pasan → `npm run check`.

### Tarea 3: Transmitir "Pantalla + cámara" con la ventanita acomodable

**Archivos:** `Dock.svelte` (cuadro de Transmitir: arriba, dos opciones `Pantalla` / `Pantalla + cámara` como la maqueta; se recuerda en prefs `modoTransmision`); `voz.svelte.ts` (`transmitir`/`transmitirNavegador` reciben `conCamara: boolean`: si va, se prende la cámara si estaba apagada (anotando que la prendió la transmisión) y se publica `camEnPantalla` por defecto; `dejarDeTransmitir` y el fin de la transmisión limpian `camEnPantalla` y apagan la cámara solo si la prendió la transmisión (foco 2); `moverCamEnPantalla(x, y, w)` acota a [0,1] y `w` a [0.15, 0.45] y publica el atributo, con un tope de 1 publicación cada 150 ms); `Pantalla.svelte` (si el dueño de la pantalla tiene `camEnPantalla` y cámara, dibuja su `<Video>` encima con `left/top/width` en %; botón ✕ que la esconde solo localmente); `Voz.svelte` (vista previa propia: cuando `camEnPantalla`, la ventanita sobre la previa se arrastra con el puntero y tiene una manija en la esquina para el tamaño; en el navegador, si no hay previa nativa, la previa usa la pista local de pantalla).
**Tests (e2e `camara.spec.ts`, versión web con `pantallaFalsa` como `web.spec.ts`):** `Pantalla + cámara: Beto ve la pantalla con la cámara de Ana abajo a la derecha`; `Ana mueve la ventanita y a Beto se le mueve` (Ana arrastra en su previa; Beto ve `left` cambiar); `Beto esconde la ventanita solo para él`; `cortar la transmisión apaga la cámara si la prendió la transmisión y la deja si ya estaba` (foco 2). Unit en `app/src/lib/camEnPantalla.test.ts` para `leerCam(s)`/`escribirCam(x,y,w)` (parseo, topes, valores rotos → por defecto) en `app/src/lib/camEnPantalla.ts`.

- [ ] Tests → fallan → implementar → pasan → `npm run check`.

### Tarea 4: Sonidos de otros grupos

**Archivos:** `botonera.svelte.ts` (el aviso suma `url` = `pb.files.getURL(rec, rec.file)` y `grupo`; `reproducir(id, base, url?)`: si el id es del grupo de la llamada, como hoy; si no y la URL pasa `urlDeSonidoValida(url)`, se baja de esa URL y se cachea por id; se saca el `throw 'otro grupo'`; `sonidosDe(grupoIds)` carga en una sola consulta los sonidos de varios grupos); `vistas/Botonera.svelte` (pestañas: el grupo de la llamada primero, después los otros grupos de `grupos.lista` que tengan sonidos; en las ajenas no hay "Nuevo sonido" ni clic derecho para editar; el buscador busca en la pestaña abierta).
**Tests:** unit `app/src/lib/botonera.test.ts`: `urlDeSonidoValida` acepta `${base}/api/files/…` y rechaza otro host, `javascript:` y rutas fuera de `/api/files/` (foco 5); e2e `app/e2e/botonera.spec.ts`: `Ana toca un sonido de su otro grupo y Beto (que no es de ese grupo) lo escucha` (con `__botonera.reproducidos` como el test de botonera existente; Ana necesita `subirSonidos` en el otro grupo: es la dueña).

- [ ] Tests → fallan → implementar → pasan → `npm run check`.

### Tarea 5: Cierre

- [ ] Servidor `npm test`, app `npm test`, `npm run check`, `npx playwright test`: todo verde.
- [ ] Versión `0.9.0` en `src-tauri/tauri.conf.json` y entrada en `novedades.ts` (cámara, Pantalla + cámara, ensordecido visible, sonidos de otros grupos).
- [ ] Revisión final con un revisor aparte; arreglar Critical/Important con su test.
- [ ] Avisarle a Jorge; commit, push e instalador solo si lo pide.
