# Plan 6 — Amigos, presencia, fundador, configuración, portada y cartel de actualización: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que Thunderop muestre quién está conectado, tenga amigos con solicitudes y chat privado, distinga al fundador, reúna perfil y configuración (con supresión de ruido por defecto y ganancia en dB), arranque en una portada con grupos en tarjetas y novedades, y no deje entrar sin actualizar.

**Architecture:**
- **Servidor (PocketBase, `server/`):** migración `9_social.js` con nombre único (índice `NOCASE`), `users.fundador`, `users.visto`, `groups.foto`, colecciones `amistades` y `privados`; hooks nuevos `social.pb.js` (fundador protegido, latido, solicitudes de amistad, permiso de privados) y `voz.pb.js` extendido con el estado de micrófono.
- **Presencia:** latido `POST /api/latido` cada 45 s que guarda `users.visto`; el cliente se suscribe a `users` por realtime y considera "en línea" a quien tiene `visto` de hace menos de 90 s.
- **Cliente (`app/src/lib`):** módulos de estado nuevos (`presencia`, `amigos`, `privados`), el chat generalizado para servir a grupo y privado, una pantalla de configuración que reemplaza a `AjustesVoz`, la portada `Inicio.svelte` que reemplaza el bloque "Mis grupos" de `Principal.svelte`, y un cartel de actualización bloqueante.

**Tech Stack:** PocketBase 0.40.5 (JSVM, realtime), SvelteKit + Svelte 5, Tauri 2 (`@tauri-apps/plugin-updater`), livekit-client 2.23, Vitest (app y servidor; el servidor levanta `pocketbase.exe` real con `tests/harness.ts`).

**Spec:** `docs/specs/2026-10-20-amigos-presencia-config.md` (partes 1 a 8). Boceto elegido de la portada: `.superpowers/brainstorm/1922-1792469780/content/inicio.html`, opción **B · Portada con saludo**.

## Global Constraints

- Texto de UI y errores en español rioplatense. Código y comentarios en español, archivos chicos, como el resto del repo.
- Nombre único sin distinguir mayúsculas. Error exacto: **"Ese nombre ya existe, probá con otro."**
- Agregar por nombre que no existe → **"No hay nadie con ese nombre."**
- Panel derecho: **"Participantes — N"**.
- En línea = `visto` hace menos de **90 s**; latido cada **45 s**. Gris como mucho 1–2 min después de cerrar.
- `fundador` solo lo cambia un superuser (panel de PocketBase). Tooltip de la insignia: **"Fundador de Thunderop"**.
- Supresión de ruido activada por defecto, con un único reencendido para todos en esta versión (`prefs.v = 2`). Ganancia del micrófono de **−20 a +20 dB**, default **0**, aplicada **después** de la supresión, en lo que se envía.
- Cartel: **"Actualizando Thunderop a la versión X…"** con barra de progreso; bloquea hasta terminar. Si falla, avisa y deja entrar.
- Privados: mismos límites, pegado, vista previa y foto en grande que el chat de grupo; leídos en `localStorage`; sin amistad aceptada no se puede escribir, el historial queda.
- Nada de tests e2e ni verificación en navegador (el dueño cuida los tokens): tests de Vitest en app y servidor sí.
- **No commitear ni pushear salvo que el dueño lo pida** (preferencia del dueño). Nunca `Co-Authored-By` ni "Generated with Claude".
- La versión publicada pasa a **0.2.0**.

## Review Focus

1. Dos personas se mandan solicitud a la vez (A→B y B→A): debe quedar una sola amistad aceptada, no dos pendientes. Test en Task 3.
2. Un usuario intenta ponerse `fundador: true` en el registro o en un update: el servidor lo ignora o lo rechaza. Test en Task 1.
3. Alguien escribe por privado a quien no es su amigo (o después de eliminarlo): 403, y el historial sigue legible para ambos. Test en Task 4.
4. Un tercero intenta leer privados ajenos (list con filtro manipulado): no ve nada. Test en Task 4.
5. Nombres "Tetu" y "tetu" (mayúsculas distintas) al registrarse o renombrarse: el segundo falla con el error de nombre único; la migración renombra repetidos existentes sin fallar. Test en Task 1.

## Agregado (2026-10-20)

- [x] **Música sin cortes al cambiar de vista:** el reproductor de YouTube pasó de `Musica.svelte` (dentro de la sala de voz) a `Principal.svelte`, fuera de pantalla. Mientras estés en la sala de voz, la música suena aunque cambies de chat o de grupo. Sale en la 0.2.0.

---

### Task 1: Servidor — nombre único y fundador protegido

**Files:**
- Create: `server/pb_migrations/9_social.js` (esta task crea la parte de `users`; las tasks 2–4 le suman campos y colecciones al mismo archivo antes del primer deploy)
- Create: `server/pb_hooks/social.pb.js`
- Modify: `server/tests/harness.ts:121-129` (`nuevoUsuario`: nombre con sufijo aleatorio, máximo 32 caracteres, p. ej. `${nombre}-${hex4}`, para que los tests existentes no choquen con la unicidad)
- Modify: tests existentes que comparen el nombre exacto de un usuario creado por el harness (por ejemplo `server/tests/voz.test.ts:59` `expect(c.name).toBe('beto')`): compararlo contra `pb.authStore.record.name`
- Modify: `app/src/lib/sesion.svelte.ts` (`mensajeError`) y `app/src/lib/sesion.test.ts`
- Test: `server/tests/social.test.ts`

**Interfaces:**
- Produces: `users.fundador` (bool), índice único `idx_users_name_nocase` sobre `name COLLATE NOCASE`. Error de PocketBase en `data.name.code === 'validation_not_unique'`.

- [ ] **Step 1: Write the failing tests** en `server/tests/social.test.ts` (mismo estilo que `perfil.test.ts`, con `startPocketBase`):
  - `it('nombre único sin mayúsculas')`: crear usuario `Tetu-x1` y otro con `tetu-X1` → el segundo `rejects.toMatchObject({ status: 400, response: { data: { name: { code: 'validation_not_unique' } } } })`; también al hacer `update` de nombre a uno existente.
  - `it('fundador no se lo pone uno mismo')`: `create` con `fundador: true` → el registro queda con `fundador === false`; `update({ fundador: true })` del propio usuario → queda `false`; `h.admin.collection('users').update(id, { fundador: true })` → `true`.
  - `it('migración renombra repetidos')`: no se puede probar el `up` con datos previos desde el harness; en su lugar, test unitario de la función pura que usa la migración, si se extrae, o se omite y se cubre en el Step 6.
  Y en `app/src/lib/sesion.test.ts`: `mensajeError` de un `ClientResponseError` con `data.name.code = 'validation_not_unique'` → `'Ese nombre ya existe, probá con otro.'`.

- [ ] **Step 2: Run to verify they fail**
  Run: `cd server && npx vitest run tests/social.test.ts` y `cd app && npx vitest run src/lib/sesion.test.ts`
  Expected: FAIL (se crean nombres repetidos; `fundador` no existe).

- [ ] **Step 3: Implement**
  - `9_social.js` (`up`): antes del índice, recorrer `users` ordenados por `created` y, si `name` ya apareció (comparando en minúsculas), renombrar a `name + n` (n = 2, 3…, recortando para no pasar 32) y `app.save`. Después: `users.indexes.push("CREATE UNIQUE INDEX idx_users_name_nocase ON users (name COLLATE NOCASE)")`, `users.fields.add(new BoolField({ name: "fundador" }))`. `down`: quitar índice y campo.
  - `social.pb.js`: `onRecordCreateRequest` y `onRecordUpdateRequest` en `users`: si `e.auth` no es superuser (`!e.hasSuperuserAuth()`), `e.record.set("fundador", create ? false : e.record.original().getBool("fundador"))`; luego `e.next()`.
  - `mensajeError`: antes de la línea de `en('name')`, `if (en('name')?.code === 'validation_not_unique') return 'Ese nombre ya existe, probá con otro.';`.
  - Harness: sufijo aleatorio en `name`.

- [ ] **Step 4: Run all server and app tests**
  Run: `cd server && npm test` y `cd app && npm test`
  Expected: PASS (los tests existentes siguen pasando con el harness nuevo).

### Task 2: Servidor — presencia (latido) y micrófono en la presencia de voz

**Files:**
- Modify: `server/pb_migrations/9_social.js` (campo `users.visto`: `DateField`)
- Modify: `server/pb_hooks/social.pb.js` (ruta del latido)
- Modify: `server/pb_hooks/voz.pb.js:18-30` (`GET /api/groups/{id}/voz`)
- Test: `server/tests/social.test.ts`, `server/tests/voz.test.ts`

**Interfaces:**
- Produces: `POST /api/latido` (auth de `users`) → `200 { visto: string }` y guarda `users.visto = ahora`. `GET /api/groups/{id}/voz` → `{ [roomId]: { id: string; name: string; silenciado: boolean }[] }`.

- [ ] **Step 1: Write the failing tests**
  - `social.test.ts` `it('latido guarda visto')`: `await a.send('/api/latido', { method: 'POST' })`; `getOne(self).visto` no vacío y a menos de 5 s de `Date.now()`. Sin auth → 401.
  - `voz.test.ts` (usa el LiveKit real del harness): un participante conectado sin micrófono publicado → `silenciado: true`; uno en `groups.silenciados` → `silenciado: true`. Si conectar un cliente real es caro, alcanza con el caso `silenciados` + un participante sin pistas (el que crea el test con el token).

- [ ] **Step 2: Run to verify they fail**
  Run: `cd server && npx vitest run tests/social.test.ts tests/voz.test.ts`
  Expected: FAIL (ruta inexistente; falta `silenciado`).

- [ ] **Step 3: Implement**
  - Latido: `routerAdd("POST", "/api/latido", …, $apis.requireAuth("users"))`: busca el usuario por `e.auth.id`, `set("visto", new DateTime())`, `e.app.save`, responde `{ visto }`. Usar `saveNoValidate` si `save` exigiera campos ajenos.
  - Voz: por participante, `silenciado = group.silenciados.includes(p.identity) || !(p.tracks || []).some((t) => (t.source === "MICROPHONE" || t.source === 2) && !t.muted)`.

- [ ] **Step 4: Run tests**
  Run: `cd server && npm test`
  Expected: PASS

### Task 3: Servidor — amistades

**Files:**
- Modify: `server/pb_migrations/9_social.js` (colección `amistades` y nueva `viewRule` de `users`)
- Modify: `server/pb_hooks/social.pb.js` (ruta de solicitud)
- Test: `server/tests/amigos.test.ts`

**Interfaces:**
- Produces:
  - Colección `amistades`: `de` (relación a users, requerida, cascadeDelete), `para` (ídem), `estado` (select `pendiente` | `aceptada`). Índice único sobre `(de, para)`.
    - `listRule`/`viewRule`: `de = @request.auth.id || para = @request.auth.id`.
    - `createRule`: `null` (solo por la ruta).
    - `updateRule`: `para = @request.auth.id && estado = "pendiente" && @request.body.estado = "aceptada" && @request.body.de:isset = false && @request.body.para:isset = false`.
    - `deleteRule`: `de = @request.auth.id || para = @request.auth.id` (rechazar, cancelar y eliminar amigo son borrar).
  - `users.viewRule` nueva: la actual `|| amistades_via_de.para ?= @request.auth.id || amistades_via_para.de ?= @request.auth.id` (se ven entre sí con una amistad pendiente o aceptada: la campanita necesita nombre y foto de quien pide).
  - `POST /api/amigos/solicitar` body `{ nombre?: string; usuario?: string }` (uno de los dos) → `200 { amistad: RecordModel }`. Errores (`BadRequestError`/`NotFoundError` con estos textos exactos): nombre o id inexistente → 404 "No hay nadie con ese nombre."; a uno mismo → 400 "No te podés agregar a vos mismo."; ya amigos → 400 "Ya son amigos."; ya pedida por mí → 400 "Ya le mandaste una solicitud.". Si existe la inversa pendiente (B ya le pidió a A), la acepta y la devuelve.

- [ ] **Step 1: Write the failing tests** en `server/tests/amigos.test.ts`:
  - `solicitar por nombre (sin distinguir mayúsculas) crea pendiente visible para ambos`; `para` puede ver el perfil de `de` (`getOne`) aunque no compartan grupo; un tercero no.
  - `nombre inexistente → 404 con el texto`; `a uno mismo → 400`; `duplicada → 400`.
  - `cruzadas: A→B y luego B→A deja una sola amistad aceptada` (`getFullList` de A devuelve 1, `estado: 'aceptada'`).
  - `solo "para" acepta`: `de` intentando `update estado: 'aceptada'` → 404; `para` → ok.
  - `cualquiera de los dos borra`: rechazar/eliminar → la colección queda vacía para ambos.
  - `create directo en amistades → 403/400`.

- [ ] **Step 2: Run to verify they fail**
  Run: `cd server && npx vitest run tests/amigos.test.ts`
  Expected: FAIL

- [ ] **Step 3: Implement** la colección y la ruta. Búsqueda por nombre: `findFirstRecordByFilter("users", "name = {:n}", { n })` funciona sin distinguir mayúsculas gracias al `COLLATE NOCASE` del índice solo si la columna lo usa; si no, usar `LOWER(name) = LOWER({:n})` vía `$dbx.exp`. Para saber si ya existe relación, buscar en ambos sentidos.

- [ ] **Step 4: Run tests**
  Run: `cd server && npm test`
  Expected: PASS

### Task 4: Servidor — mensajes privados y foto de grupo

**Files:**
- Modify: `server/pb_migrations/9_social.js` (colección `privados`; campo `groups.foto`)
- Modify: `server/pb_hooks/social.pb.js` (permiso de escritura en privados)
- Test: `server/tests/privados.test.ts`, `server/tests/grupos.test.ts`

**Interfaces:**
- Produces:
  - Colección `privados` con los **mismos nombres de campo que `messages`** para reutilizar el chat: `author` (relación users, requerida), `para` (relación users, requerida), `text` (max 2000), `file` (mismos MIME y 25 MB que `messages`). Fechas `created` igual que en `7_fechas_mensajes.js`.
    - `listRule`/`viewRule`: `author = @request.auth.id || para = @request.auth.id`.
    - `createRule`: `@request.body.author = @request.auth.id`. El hook además exige una amistad **aceptada** entre `author` y `para` (si no, 403 "Solo podés escribirle a tus amigos.") y texto o archivo (como `messages.pb.js`).
    - `updateRule`: `null`. `deleteRule`: `author = @request.auth.id`.
  - `groups.foto`: `FileField` (1 archivo, 2 MB, `image/png|jpeg|webp|gif`, thumbs `["480x270"]`). La edita el dueño (la `updateRule` actual ya lo cubre).

- [ ] **Step 1: Write the failing tests** en `server/tests/privados.test.ts`:
  - `amigos se escriben y ambos ven el mensaje`; `un tercero lista privados con filtro de ellos → 0 items`.
  - `sin amistad → 403`; `después de eliminar la amistad → 403 al escribir, y ambos siguen viendo el historial`.
  - `author distinto del autenticado → 400/403`; `mensaje vacío → 400`; `solo el autor borra`.
  - En `grupos.test.ts`: `el dueño sube foto al grupo` (FormData con un PNG de `tests/fixtures`) y `un miembro no dueño no puede`.

- [ ] **Step 2: Run to verify they fail**
  Run: `cd server && npx vitest run tests/privados.test.ts tests/grupos.test.ts`
  Expected: FAIL

- [ ] **Step 3: Implement** colección, campo y `onRecordCreateRequest(…, "privados")`. Si `3_invites.js` define límites de frecuencia por colección, sumar `privados:create` con el mismo valor que `messages:create`.

- [ ] **Step 4: Run tests**
  Run: `cd server && npm test`
  Expected: PASS

### Task 5: Cliente — prefs de supresión y ganancia, procesador del micrófono

**Files:**
- Modify: `app/src/lib/prefs.ts`, `app/src/lib/prefs.test.ts`
- Modify: `app/src/lib/ruido.ts` (pasa a ser el procesador del micrófono: supresión opcional + ganancia)
- Modify: `app/src/lib/voz.svelte.ts:72-85` (`aplicarSupresion` → `aplicarProcesador`), `:200-204` (`alternarSupresion`)
- Create: `app/src/lib/ganancia.ts`, `app/src/lib/ganancia.test.ts`

**Interfaces:**
- Produces:
  - `PrefsVoz` suma `gananciaDb: number` (−20..20, default 0, fuera de rango → 0) y `v?: number`. Si lo guardado no tiene `v === 2`, `leerPrefs` devuelve `supresion: true`; `guardarPrefs` siempre escribe `v: 2`. Default de `supresion`: `true`.
  - `dbALineal(db: number): number` en `ganancia.ts` (= `10 ** (db / 20)`, acotado a −20..20).
  - `crearProcesador(op: { supresion: boolean; gananciaDb: number }): TrackProcessor<…> & { ajustar(op: { supresion: boolean; gananciaDb: number }): void }` en `ruido.ts`: grafo `fuente → [rnnoise si supresion] → GainNode → destino`; `ajustar` cambia `gain.value` y reconecta si cambió `supresion`.
  - En `voz.svelte.ts`: `export async function cambiarGanancia(db: number): Promise<void>` (guarda en prefs y ajusta en vivo) y `export async function cambiarSupresion(si: boolean): Promise<void>` (reemplaza a `alternarSupresion`; actualiza `voz.supresion`). El procesador se pone siempre al publicar el micrófono.

- [ ] **Step 1: Write the failing tests**
  - `prefs.test.ts`: actualizar `DEFAULTS` (`supresion: true`, `gananciaDb: 0`); `it('reenciende la supresión una vez')`: guardado `{ supresion: false }` sin `v` → `leerPrefs().supresion === true`; luego `guardarPrefs({ supresion: false })` → `false`. `it('ganancia fuera de rango vuelve a 0')` con 50 y `'x'`.
  - `ganancia.test.ts`: `dbALineal(0) === 1`; `dbALineal(20)` ≈ 10; `dbALineal(-20)` ≈ 0.1; `dbALineal(40)` ≈ 10 (acotado).

- [ ] **Step 2: Run to verify they fail**
  Run: `cd app && npx vitest run src/lib/prefs.test.ts src/lib/ganancia.test.ts`
  Expected: FAIL

- [ ] **Step 3: Implement** según Interfaces. Mantener la cola en serie de `aplicarSupresion` (el comentario explica por qué) para `aplicarProcesador`.

- [ ] **Step 4: Run tests y chequeo de tipos**
  Run: `cd app && npm test && npx svelte-check --tsconfig ./tsconfig.json --threshold error`
  Expected: PASS, 0 errores.

### Task 6: Cliente — Configuración (tuerquita) y menú del perfil

**Files:**
- Create: `app/src/lib/vistas/Configuracion.svelte` (reemplaza a `AjustesVoz.svelte`, que se borra)
- Create: `app/src/lib/vistas/MenuPerfil.svelte`
- Modify: `app/src/lib/vistas/Perfil.svelte` (se muestra dentro de un `<dialog>`; el nombre repetido muestra el error de Task 1)
- Modify: `app/src/lib/vistas/ControlesVoz.svelte` ("Ajustes" abre `Configuracion`; el botón de supresión usa `cambiarSupresion` o se quita)

**Interfaces:**
- Consumes: `cambiarGanancia`, `cambiarSupresion`, `dispositivos`, `elegirEntrada`, `elegirSalida`, `vistaPrevia` (Task 5 y `voz.svelte.ts`).
- Produces: `<Configuracion cerrar={() => void} />` (diálogo modal con: Entrada, Salida, Supresión de ruido (casilla), Ganancia del micrófono (range −20..20 paso 1, muestra "+3 dB"), GPU, Vista previa). `<MenuPerfil />`: botón con foto + nombre + insignia; al tocarlo, menú con "Editar perfil" (abre `Perfil` en diálogo) y "Cerrar sesión".

- [ ] **Step 1: Implement** los componentes (vistas sin lógica nueva: no llevan test propio).
- [ ] **Step 2: Chequeo de tipos y tests**
  Run: `cd app && npx svelte-check --tsconfig ./tsconfig.json --threshold error && npm test`
  Expected: 0 errores, PASS.

### Task 7: Cliente — presencia e insignia

**Files:**
- Create: `app/src/lib/presencia.svelte.ts`, `app/src/lib/presencia.test.ts`
- Create: `app/src/lib/vistas/Insignia.svelte`, `app/src/lib/vistas/Avatar.svelte`

**Interfaces:**
- Produces:
  - `enLineaSegun(visto: string | undefined, ahora: number): boolean` (pura: `visto` a menos de 90 000 ms de `ahora`; vacío o inválido → `false`).
  - `iniciarPresencia(): () => void`: manda el latido (`POST /api/latido`) al iniciar y cada 45 s; se suscribe a `users` `'*'` y guarda `visto` por id; refresca un reloj reactivo cada 15 s. Devuelve la limpieza. Se llama desde `Principal.svelte` con `$effect`.
  - `enLinea(u: RecordModel | string): boolean` (reactiva; usa el `visto` del realtime o el del registro).
  - `<Avatar usuario={RecordModel} tam={number} />`: foto o círculo de color, con la lucecita (verde `var(--ok)` / gris) abajo a la derecha.
  - `<Insignia usuario={RecordModel} />`: si `usuario.fundador`, un rayo violeta (el del logo, SVG inline chico) con `title="Fundador de Thunderop"`; si no, nada.

- [ ] **Step 1: Write the failing test** `presencia.test.ts`: `enLineaSegun(new Date(t - 30_000).toISOString(), t) === true`; con 120 000 ms → `false`; `undefined` y `'basura'` → `false`. Ojo con el formato de fechas de PocketBase (`'2026-10-20 12:00:00.000Z'`, con espacio): aceptar ambos.
- [ ] **Step 2: Run to verify it fails**
  Run: `cd app && npx vitest run src/lib/presencia.test.ts` → FAIL
- [ ] **Step 3: Implement** según Interfaces. Usar `<Insignia>` al lado del nombre en: `Chat.svelte` (header del mensaje), `Voz.svelte` (tarjetas, con `miembro(p.id)`), y en lo que construyen las tasks 8–11.
- [ ] **Step 4: Run tests y chequeo de tipos** (mismo comando que Task 5) → PASS, 0 errores.

### Task 8: Cliente — amigos y campanita

**Files:**
- Create: `app/src/lib/amigos.svelte.ts`, `app/src/lib/amigos.test.ts`
- Create: `app/src/lib/vistas/Campanita.svelte`

**Interfaces:**
- Consumes: `POST /api/amigos/solicitar`, colección `amistades` (Task 3).
- Produces:
  - `amigos: { lista: Amigo[]; recibidas: Solicitud[]; enviadas: Solicitud[]; cargado: boolean }` donde `Amigo = { amistad: string; usuario: RecordModel }` y `Solicitud = { id: string; usuario: RecordModel }`.
  - `separarAmistades(registros: RecordModel[], yo: string): { lista; recibidas; enviadas }` (pura, testeable; usa `expand.de` / `expand.para`).
  - `iniciarAmigos(): () => void` (carga con `expand: 'de,para'` y se suscribe a `amistades` `'*'`; limpia al cerrar sesión como `grupos.svelte.ts`).
  - `solicitarPorNombre(nombre: string)`, `solicitarA(usuarioId: string)`, `aceptar(id: string)`, `quitar(id: string)` (rechazar, cancelar y eliminar amigo). Errores con `mensajeError`.
  - `<Campanita />`: botón 🔔 con contador de `amigos.recibidas.length`; al tocarlo, lista con foto, nombre, insignia, "Aceptar" y "Rechazar".

- [ ] **Step 1: Write the failing test** `amigos.test.ts` para `separarAmistades`: una aceptada donde soy `de` → en `lista` con el otro usuario; pendiente donde soy `para` → `recibidas`; pendiente donde soy `de` → `enviadas`.
- [ ] **Step 2: Run to verify it fails** → FAIL
- [ ] **Step 3: Implement** según Interfaces.
- [ ] **Step 4: Run tests y chequeo de tipos** → PASS, 0 errores.

### Task 9: Cliente — chat reutilizable y privados con no leídos

**Files:**
- Modify: `app/src/lib/chat.svelte.ts` (generalizar), `app/src/lib/chat.test.ts`
- Modify: `app/src/lib/vistas/Chat.svelte` (recibe la fuente por props)
- Modify: `app/src/lib/vistas/Grupo.svelte` (usa la nueva firma)
- Create: `app/src/lib/privados.svelte.ts`, `app/src/lib/privados.test.ts`

**Interfaces:**
- Produces:
  - `abrirLista(coleccion: 'messages' | 'privados', filtro: string): ChatAbierto` (lo que hoy hace `abrirChat` con `room`, parametrizado; `ChatAbierto` = el objeto que hoy devuelve `abrirChat`). `abrirChat(roomId)` queda como `abrirLista('messages', filtro de sala)`.
  - `abrirPrivado(amigoId: string): ChatAbierto` (filtro `(author = yo && para = amigo) || (author = amigo && para = yo)`).
  - `enviarPrivado(amigoId: string, texto: string, archivo?: File)`, `borrarPrivado(id: string)`.
  - `Chat.svelte` props: `{ titulo: string; chat: ChatAbierto; enviar: (texto: string, archivo?: File) => Promise<void>; borrar: (id: string) => Promise<void>; puedeBorrar: (m: RecordModel) => boolean; soloLectura?: string }`. Con `soloLectura` (p. ej. "Ya no son amigos: no se pueden mandar mensajes.") se oculta el compositor y se muestra el texto.
  - No leídos: `noLeidos: Record<string, number>` reactivo; `contarNoLeidos(mensajes: { author: string; created: string }[], yo: string, leidoHasta: string | undefined): number` (pura); `marcarLeido(amigoId: string)` guarda en `localStorage['dm.leido.' + yo]` el `created` del último mensaje (dentro de try/catch). Se actualiza con realtime de `privados` (suscripción única en `iniciarPrivados(): () => void`).

- [ ] **Step 1: Write the failing tests**: `privados.test.ts` → `contarNoLeidos` cuenta solo mensajes del otro posteriores a `leidoHasta`; sin `leidoHasta` cuenta todos los del otro. `chat.test.ts` sigue pasando.
- [ ] **Step 2: Run to verify they fail** → FAIL
- [ ] **Step 3: Implement**. El chat de grupo debe quedar igual que hoy (pegar, vista previa, foto en grande).
- [ ] **Step 4: Run tests y chequeo de tipos** → PASS, 0 errores.

### Task 10: Cliente — panel "Participantes"

**Files:**
- Modify: `app/src/lib/vistas/Miembros.svelte` → renombrar a `Participantes.svelte` (actualizar el import en `Grupo.svelte`)

**Interfaces:**
- Consumes: `enLinea`, `<Avatar>`, `<Insignia>` (Task 7); `enVoz` con `silenciado` (Task 2) y `voz.participantes` para la sala propia; `solicitarA`, `amigos` (Task 8).
- Produces: título "Participantes — N"; conectados arriba y desconectados abajo con opacidad reducida; 🔇 (`aria-label="Micrófono apagado"`) para quien está en voz con `silenciado`; clic derecho (`oncontextmenu`, `preventDefault`) abre un menú propio con "Agregar amigo" (solo si no es uno mismo, no es amigo y no hay solicitud en ningún sentido) y, si soy dueño, "Echar" (con el `Confirmar` existente). El botón "Echar" visible actual pasa al menú. Cerrar el menú con Esc o clic afuera.

- [ ] **Step 1: Implement**.
- [ ] **Step 2: Chequeo de tipos y tests** → 0 errores, PASS.

### Task 11: Cliente — portada (inicio) con grupos en tarjetas, novedades y amigos

**Files:**
- Create: `app/src/lib/vistas/Inicio.svelte`, `app/src/lib/vistas/TarjetaGrupo.svelte`, `app/src/lib/vistas/Amigos.svelte`, `app/src/lib/vistas/Novedades.svelte`
- Create: `app/src/lib/novedades.ts`
- Modify: `app/src/lib/vistas/Principal.svelte` (la barra de arriba pasa a: logo ⚡ THUNDEROP, `<Campanita/>`, tuerquita → `<Configuracion/>`, `<MenuPerfil/>`; el bloque "Mis grupos" se reemplaza por `<Inicio/>`; inicia `iniciarPresencia`, `iniciarAmigos`, `iniciarPrivados`)
- Modify: `app/src/lib/vistas/Grupo.svelte` (el dueño puede cambiar la foto del grupo, con la validación de `Perfil.svelte`: imagen hasta 2 MB)

**Interfaces:**
- Consumes: tasks 6–9.
- Produces:
  - `novedades.ts`: `export type Novedad = { version: string; fecha: string; cambios: { tipo: 'nuevo' | 'arreglo'; texto: string }[] }` y `export const NOVEDADES: Novedad[]` (la más nueva primero). Entradas iniciales: **0.1.1** (arreglos: "Ya no se escucha doble al transmitir con sonido.", "El botón de silenciar la transmisión funciona en pantalla completa."; nuevos: "Pegá fotos en el chat con Ctrl+V.", "Vista previa antes de mandar una foto y fotos en grande al tocarlas.", "Ícono nuevo.") y **0.2.0** (lo de esta etapa, redactado para usuarios).
  - `Inicio.svelte` (boceto B): saludo "¡Hola, {nombre}!" con "{n} amigos conectados · Thunderop {versión}" (versión de `getVersion()` de `@tauri-apps/api/app`, con fallback vacío fuera de Tauri); "Mis grupos" en fila de tarjetas (`TarjetaGrupo`: foto `thumb 480x270` o degradé con la inicial, nombre, "N participantes"; la última tarjeta "+" abre crear grupo / unirse con código, reusando la lógica actual de `Principal.svelte`); abajo dos columnas: `<Novedades/>` (las 2 últimas versiones y "Ver todas") y `<Amigos/>`.
  - `Amigos.svelte`: lista con `<Avatar>` (lucecita), nombre, `<Insignia>`, contador de no leídos; "Agregar amigo" (campo de nombre exacto + enviar, muestra el error del servidor); al tocar un amigo abre el privado (`<Chat>` con `abrirPrivado`, `marcarLeido` al abrir y al llegar mensajes con el chat abierto); en el privado, opción "Eliminar amigo" con `Confirmar`. Si la amistad ya no existe, el chat queda en `soloLectura`.
  - El crear grupo / unirse debe seguir respetando "un solo grupo propio".

- [ ] **Step 1: Write the failing test** `app/src/lib/novedades.test.ts`: `NOVEDADES[0].version` coincide con `version` de `src-tauri/tauri.conf.json` (leerlo con `readFileSync` + `JSON.parse`); versiones ordenadas de más nueva a más vieja; cada versión tiene al menos un cambio.
- [ ] **Step 2: Run to verify it fails** → FAIL (todavía no existe el archivo / la versión es 0.1.1).
- [ ] **Step 3: Implement**; subir `version` en `app/src-tauri/tauri.conf.json` a `0.2.0` (sin BOM: escribir con un editor, no con `Set-Content` de PowerShell 5).
- [ ] **Step 4: Run tests y chequeo de tipos** → PASS, 0 errores.

### Task 12: Cliente — cartel de actualización bloqueante

**Files:**
- Create: `app/src/lib/actualizacion.svelte.ts`, `app/src/lib/actualizacion.test.ts`
- Create: `app/src/lib/vistas/Actualizacion.svelte`
- Modify: `app/src/routes/+page.svelte` (reemplaza el `onMount` del updater de la etapa anterior: mientras `actualizacion.estado` sea `buscando` o `descargando`, se muestra solo `<Actualizacion/>`)

**Interfaces:**
- Produces:
  - `actualizacion: { estado: 'buscando' | 'descargando' | 'error' | 'lista'; version: string; progreso: number /* 0..1 */; error: string }`.
  - `progresoDe(bajado: number, total: number | undefined): number` (pura; sin total → 0; acotado a 0..1).
  - `buscarActualizacion(): Promise<void>`: en dev (`import.meta.env.DEV`) o fuera de Tauri pasa directo a `lista`. Si `check()` devuelve update → `descargando` con `version`, y `downloadAndInstall` con eventos `Started` (total), `Progress` (suma `chunkLength`), `Finished`; Windows cierra y reabre la app. Si `check()` da null → `lista`. Cualquier error → `error` con "No se pudo actualizar. Podés entrar igual y se va a reintentar la próxima vez."
  - `<Actualizacion/>`: cartel centrado sobre fondo oscuro con el logo, "Actualizando Thunderop a la versión X…", barra de progreso (`<progress>`) y, en `error`, el texto y un botón "Entrar igual" que pasa a `lista`. Mientras `buscando`, un "Buscando actualizaciones…" discreto (sin bloquear más de lo que tarde `check()`).

- [ ] **Step 1: Write the failing test** `actualizacion.test.ts` para `progresoDe`: `(50, 100) → 0.5`; `(10, undefined) → 0`; `(150, 100) → 1`.
- [ ] **Step 2: Run to verify it fails** → FAIL
- [ ] **Step 3: Implement**.
- [ ] **Step 4: Run tests y chequeo de tipos** → PASS, 0 errores.

### Task 13: Login — "Recordar mi cuenta"

**Files:**
- Modify: `server/pb_migrations/9_social.js` (`users.authToken.duration = 30 * 24 * 3600`; el `down` vuelve a 604800)
- Modify: `app/src/lib/pb.ts`, `app/src/lib/sesion.svelte.ts`, `app/src/lib/vistas/Entrar.svelte`
- Test: `app/src/lib/sesion.test.ts`

**Interfaces:**
- Produces:
  - Casilla **"Recordar mi cuenta"** en `Entrar.svelte`, tildada por defecto. Tildada: la sesión persiste al cerrar la app (comportamiento actual) y el email queda precargado la próxima vez (`localStorage['dm.email']`). Destildada: la sesión dura hasta cerrar la app y no se guarda el email.
  - `entrar(email: string, pass: string, recordar = true)` y `registrarse(…, recordar = true)`. `pb.ts` usa un `LocalAuthStore` con clave fija; sin recordar, al iniciar sesión se marca `localStorage['dm.recordar'] = '0'` y `validarSesionAlIniciar` limpia la sesión guardada si la marca está en `'0'` y la app recién arranca (usar `sessionStorage` como bandera de "esta ejecución ya inició sesión").
  - La contraseña nunca se guarda: lo que persiste es el token de PocketBase, que `validarSesionAlIniciar` ya renueva en cada arranque.

- [ ] **Step 1: Write the failing test** en `sesion.test.ts` (con `localStorage`/`sessionStorage` en memoria como en `prefs.test.ts`): con `dm.recordar = '0'` y sin bandera de sesión, `validarSesionAlIniciar` deja `pb.authStore` vacío; con `'1'` no lo toca (sin red: mockear `authRefresh`).
- [ ] **Step 2: Run to verify it fails** → FAIL
- [ ] **Step 3: Implement**.
- [ ] **Step 4: Run tests y chequeo de tipos** → PASS, 0 errores.

### Task 14: Publicar 0.2.0

**Files:**
- Ninguno nuevo (deploy y release).

- [ ] **Step 1: Todos los tests**
  Run: `cd server && npm test` y `cd app && npm test && npx svelte-check --tsconfig ./tsconfig.json --threshold error && cd src-tauri && cargo check`
  Expected: PASS, 0 errores.
- [ ] **Step 2: Actualizar el servidor** (primero el servidor: la 0.2.0 necesita las colecciones nuevas)
  Run (PowerShell): `wsl -d Ubuntu-24.04 -u root -- bash -c "rm -rf /home/jorglopez96/thunderop && mkdir -p /home/jorglopez96/thunderop && cp -r '/mnt/d/ClaudeCode/Proyectos con REA/Thunderop/server/.' /home/jorglopez96/thunderop/ && bash /home/jorglopez96/thunderop/instalar-servidor.sh thunderop.duckdns.org"` (`pb_data` vive en `/opt/thunderop`, no se toca)
  Expected: termina con "Listo." y `curl https://thunderop.duckdns.org/api/health` responde 200. Verificar con `journalctl -u thunderop-pocketbase -n 50` que la migración `9_social.js` corrió sin error.
- [ ] **Step 3: Release**
  Run: `cd app && npm run release -- thunderop.duckdns.org`, y copiar `app/release/thunderop-setup.exe` y `app/release/latest.json` a `/opt/thunderop/descargas/` (`wsl -d Ubuntu-24.04 -u root -- cp …`).
  Expected: `https://thunderop.duckdns.org/descargas/latest.json` dice `"version": "0.2.0"`.
- [ ] **Step 4: Avisar al dueño** cómo marcarse fundador: entrar a `https://thunderop.duckdns.org/_/` (crear el superuser si no existe, según `docs/guia-servidor.md`), colección `users`, su registro, tildar `fundador`. No commitear salvo que lo pida.
