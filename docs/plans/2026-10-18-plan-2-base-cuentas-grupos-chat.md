# Plan 2 — Base: cuentas, grupos, invitaciones, salas y chat

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dos amigos se registran, uno crea su grupo, invita al otro con un código, chatean en tiempo real con texto, imágenes y videos cortos, y el creador puede echar gente, borrar mensajes y administrar salas.

**Architecture:**
- **Servidor:** PocketBase 0.40.5 con migraciones JS (`server/pb_migrations`) y hooks JS (`server/pb_hooks`). La autorización vive en las API rules por membresía del grupo. La lógica que las reglas no pueden expresar (crear grupo con dueño y miembros, unirse por código, salir, impedir altas directas de miembros) vive en hooks.
- **Cliente:** app Tauri 2 nueva en `app/`, con Svelte 5 + TypeScript y el SDK `pocketbase`. Usa CSP estricta y tamaño mínimo de ventana, lecciones de la etapa 1.
- **Pruebas:**
  - **Servidor:** tests de integración contra un PocketBase real arrancado por un harness.
  - **Cliente:** unitarios solo para helpers puros.
  - **De punta a punta:** un E2E con Playwright (Edge instalado) sobre el frontend en navegador.

**Tech Stack:** PocketBase 0.40.5 (binario Windows), pocketbase JS SDK 0.28.x, Tauri 2.12, Svelte 5, Vite, Vitest, @playwright/test con `channel: 'msedge'`.

**Spec:** `docs/specs/2026-10-18-diseno-inicial.md`. Lecciones aplicadas: `docs/spikes/2026-10-18-resultado-pantalla.md`.

## Global Constraints

- **Grupos:** cada usuario puede **crear 1 solo grupo** y unirse a los que quiera.
- **Invitaciones:** se entra a un grupo por **código o link de invitación**. Cualquier miembro puede generar invitaciones.
- **Poderes del creador:** echar miembros, borrar mensajes de cualquiera y crear, renombrar o borrar salas. (Silenciar en voz es de la etapa 3.)
- **Nombres en la UI:** "Sala de voz" y "Sala de chat". Las salas de voz se listan pero muestran "Disponible en la próxima versión" (etapa 3).
- **Chat:** texto, **imágenes** y **videos cortos**. **No** se aceptan archivos genéricos. Límite: video de **60 s / 25 MB**; imagen de 25 MB.
- **Perfil simple:** nombre visible, foto, un color y un estado corto. Nada de banners, marcos ni efectos.
- **Protección del servidor:** límites de frecuencia de PocketBase activados.
- **Mudable:** la URL del servidor sale de `VITE_PB_URL` (default `http://127.0.0.1:8090`) y los datos son la carpeta `pb_data`. No hay nada atado a un proveedor.
- **Requisitos de la ventana Tauri:**
  - CSP explícita, sin `csp: null`.
  - `withGlobalTauri: false`.
  - Tamaño mínimo **960×640**: el selector de pantalla de WebView2 se dibuja dentro de la ventana y es inusable debajo de 600 px de alto.
- **Idioma:** UI en español.
- **Disco:** todo en D:. Playwright usa Edge instalado (`channel: 'msedge'`) para no bajar navegadores a C:, que tiene ~2 GB libres.
- **Nunca se commitea:** `*.exe`, `pb_data/`, `node_modules/`, `target/` ni `dist/`.
- Commits con Conventional Commits.

## Review Focus

1. **Invitación inválida, vencida o reutilizada por alguien que ya es miembro** → error claro y ningún miembro duplicado. Tests: Task 3 `join rejects expired code`, `join is idempotent for existing member`.
2. **Miembro echado con la app abierta** → deja de recibir mensajes en tiempo real y no puede leer ni escribir. Test: Task 5 `kicked member stops receiving realtime and loses access`.
3. **El dueño borra su cuenta o el grupo** → salas, mensajes e invitaciones desaparecen en cascada y la UI de los demás no se rompe. Tests: Task 2 `deleting group cascades rooms messages invites` y Task 9 (la UI vuelve a la lista si el grupo desaparece).
4. **Archivo con tipo falso, demasiado grande o no permitido** (un `.exe` renombrado a `.png`, un PDF, 26 MB) → el servidor lo rechaza aunque el cliente no lo haya filtrado. Test: Task 5 `server rejects disallowed or oversized files`.
5. **Un no miembro que adivina IDs** (IDOR) → no ve el grupo, las salas, los mensajes ni las invitaciones. Tests: `non-member cannot …` en las Tasks 2–5.

---

## Modelo de datos (lo producen las Tasks 1–5; todas las demás lo consumen)

| Colección | Campos | Reglas (list/view · create · update · delete) |
|---|---|---|
| `users` (auth, existente) | `name` text 1–32 req; `avatar` file (png/jpeg/webp/gif, 2 MB, thumbs `64x64`); `color` text `^#[0-9a-f]{6}$`; `status` text ≤80 | list: `null` (solo superuser) · view: `@request.auth.id != ""` · update: `id = @request.auth.id` · delete: `id = @request.auth.id` |
| `groups` | `name` text 1–40 req; `owner` relation→users single req, cascadeDelete; `members` relation→users multiple, max 50 | list/view: `members.id ?= @request.auth.id` · create: `@request.auth.id != ""` · update: `owner = @request.auth.id && @request.body.owner:isset = false` · delete: `owner = @request.auth.id`. Índice **único** en `owner`. |
| `invites` | `group` relation→groups req, cascadeDelete; `code` text req, único; `created_by` relation→users req; `expires` date req | list/view: `group.members.id ?= @request.auth.id` · create: `group.members.id ?= @request.auth.id` · update: `null` · delete: `group.owner = @request.auth.id \|\| created_by = @request.auth.id` |
| `rooms` | `group` relation→groups req, cascadeDelete; `name` text 1–40 req; `kind` select `voz`/`chat` req; `position` number | list/view: `group.members.id ?= @request.auth.id` · create/delete: `group.owner = @request.auth.id` · update: `group.owner = @request.auth.id && @request.body.group:isset = false` |
| `messages` | `room` relation→rooms req, cascadeDelete; `author` relation→users req, cascadeDelete; `text` text ≤2000; `file` file single, 25 MB, mime `image/png,image/jpeg,image/gif,image/webp,video/mp4,video/webm` | list/view: `room.group.members.id ?= @request.auth.id` · create: `room.group.members.id ?= @request.auth.id && room.kind = "chat" && @request.body.author = @request.auth.id` · update: `null` · delete: `author = @request.auth.id \|\| room.group.owner = @request.auth.id` |

**Hooks** (`server/pb_hooks/`):
- **`groups` create:** fuerza `owner = e.auth.id` y `members = [e.auth.id]`, ignorando lo que mande el cliente. Después crea las salas `General` (chat, position 0) y `General` (voz, position 1). Si el usuario ya tiene grupo, el índice único lo rechaza → 400.
- **`groups` update:** el set nuevo de `members` tiene que ser un subconjunto del anterior (solo bajas, nunca altas directas) y tiene que seguir incluyendo a `owner` → si no, 400.
- **`invites` create:** fuerza `created_by = e.auth.id`, `code` = 10 caracteres aleatorios `[a-z0-9]` (`$security.randomStringWithAlphabet`) y `expires` = ahora + 7 días.
- **`messages` create:** exige `text` no vacío o `file` presente → si no, 400.
- **`POST /api/invites/join`** (body `{code}`, `$apis.requireAuth()`):
  - Código inexistente o vencido → 404.
  - Grupo lleno (50) → 400.
  - Si ya es miembro, no hace nada.
  - Responde `{ group: <id> }`.
- **`POST /api/groups/{id}/leave`** (`$apis.requireAuth()`): quien no es miembro → 404; el dueño → 400 ("borrá el grupo"); los demás se quitan de `members`.

**Settings** (por migración): `rateLimits.enabled = true`, con reglas adicionales `{label: "/api/invites/join", maxRequests: 5, duration: 60}` y `{label: "messages:create", maxRequests: 20, duration: 10}`.

> Las clases y métodos exactos del JSVM (`TextField`, `RelationField`, `FileField`, `SelectField`, `onRecordCreateRequest`, `$security.randomStringWithAlphabet`, `app.settings()`) están en `server/pb_data/types.d.ts`, que genera PocketBase al primer arranque. Hay que usar esos nombres.

---

### Task 1: Servidor PocketBase, harness de tests y perfil de usuario

**Files:**
- Create: `server/package.json` (vitest, pocketbase SDK), `server/vitest.config.ts` (`testTimeout: 30000`), `server/README.md`, `server/scripts/descargar-pocketbase.mjs`
- Create: `server/tests/harness.ts`, `server/pb_migrations/1_perfil.js`
- Test: `server/tests/perfil.test.ts`
- Modify: `.gitignore` (+ `server/pb_data/`, `server/pocketbase.exe`)

**Interfaces:**
- Produces:

```ts
// server/tests/harness.ts
export type Harness = {
  url: string;                                   // http://127.0.0.1:<puerto libre>
  admin: PocketBase;                             // autenticado como superuser
  nuevoUsuario(nombre: string): Promise<PocketBase>; // registra + autentica; email `${nombre}-${random}@test.local`
  stop(): Promise<void>;                         // mata el proceso y borra el dir temporal
};
export function startPocketBase(opts?: { rateLimits?: boolean }): Promise<Harness>; // rateLimits default false
```

  `startPocketBase` hace esto:
  1. Crea un directorio temporal dentro de `server/.tmp/`, en D:.
  2. Corre `pocketbase.exe superuser upsert admin@test.local <pass> --dir <tmp>`.
  3. Lanza `serve --http=127.0.0.1:<puerto> --dir <tmp> --migrationsDir pb_migrations --hooksDir pb_hooks`.
  4. Espera a que `/api/health` responda 200.
  5. Si `rateLimits` es `false`, los apaga por la API de settings, para que los tests no choquen con los límites.
- `server/scripts/descargar-pocketbase.mjs`: baja `pocketbase_0.40.5_windows_amd64.zip` y deja `server/pocketbase.exe`.

- [ ] **Step 1: Bajar PocketBase y armar el paquete** — `node scripts/descargar-pocketbase.mjs` y después `./pocketbase.exe --version` debe mostrar `0.40.5`.
- [ ] **Step 2: Escribir los tests** de `perfil.test.ts`:
  - `register and update own profile`: el usuario A cambia `name: 'Ana'`, `color: '#ff8800'`, `status: 'jugando'` → `getOne` devuelve esos valores.
  - `cannot update another user`: B intenta `update(A.id, {name: 'x'})` → rechazo con status 404.
  - `rejects bad color`: `color: 'rojo'` → status 400.
  - `users list is not public`: A hace `collection('users').getList()` → 0 ítems, o rechazo con 403.
- [ ] **Step 3: Correr y ver que fallan** — `npx vitest run tests/perfil.test.ts` → FAIL. El harness todavía no existe, o los campos no existen.
- [ ] **Step 4: Implementar** `harness.ts` y la migración `1_perfil.js`: agrega los campos y reglas de `users` de la tabla.
- [ ] **Step 5: Correr y ver que pasan** → 4 passed.
- [ ] **Step 6: Commit** `feat(server): pocketbase, harness de tests y perfil de usuario`

### Task 2: Grupos

**Files:**
- Create: `server/pb_migrations/2_grupos.js` (`groups` + `rooms`, que las salas por defecto necesitan), `server/pb_hooks/grupos.pb.js`
- Test: `server/tests/grupos.test.ts`

**Interfaces:**
- Consumes: `startPocketBase`, `nuevoUsuario` (Task 1).
- Produces: las colecciones `groups` y `rooms` y los hooks de `groups` de la sección "Modelo de datos".

- [ ] **Step 1: Tests:**
  - `create group sets owner, members and default rooms`: A crea `{name:'Los pibes', owner: B.id, members:[B.id]}` → `owner === A.id`, `members` = `[A.id]`; tiene 2 salas: `General`/`chat` y `General`/`voz`.
  - `one group per user`: A crea un segundo grupo → status 400.
  - `non-member cannot view group`: B hace `getOne(grupo)` → 404; `getList()` de B → 0 ítems.
  - `owner renames, non-owner cannot`: A renombra → ok. Tras unir a B por superuser (`admin` agrega B a `members`), B renombra → 404.
  - `owner cannot add members directly`: A hace update con `members: [A.id, C.id]` → 400.
  - `owner cannot remove self`: A hace update con `members: []` → 400.
  - `deleting group cascades rooms messages invites`: el superuser crea una invitación y un mensaje en la sala de chat; A borra el grupo → `rooms`, `messages` e `invites` de ese grupo quedan en 0 (verificado por `admin`).
- [ ] **Step 2: Correr → FAIL.**
- [ ] **Step 3: Implementar** la migración y el hook (create + update de `groups`).
- [ ] **Step 4: Correr → 7 passed.** (Para el test de cascada, `messages` e `invites` hacen falta: si se ejecuta en orden, hay que marcarlo `it.todo` y activarlo en la Task 5.)
- [ ] **Step 5: Commit** `feat(server): grupos con dueño unico y salas por defecto`

### Task 3: Invitaciones, unirse, echar y salir

**Files:**
- Create: `server/pb_migrations/3_invites.js`, `server/pb_hooks/invites.pb.js`
- Test: `server/tests/invites.test.ts`

**Interfaces:**
- Consumes: `groups` (Task 2).
- Produces: la colección `invites`, `POST /api/invites/join` y `POST /api/groups/{id}/leave`, como en "Modelo de datos". Desde el SDK: `pb.send('/api/invites/join', {method:'POST', body:{code}})` → `{group: string}`.

- [ ] **Step 1: Tests:**
  - `member creates invite with server-side code and expiry`: A crea `{group, code:'hack', created_by: B.id}` → `code` tiene 10 caracteres de `[a-z0-9]` y ≠ `'hack'`; `created_by === A.id`; `expires` ≈ ahora + 7 d (±1 min).
  - `join with code adds member`: B se une con el código → `{group}`; ahora B ve el grupo y sus 2 salas.
  - `join is idempotent for existing member`: B se une dos veces → `members` tiene a B una sola vez.
  - `join rejects unknown code`: → 404.
  - `join rejects expired code`: `admin` pone `expires` en el pasado → 404.
  - `any member can invite`: B (miembro) crea una invitación → ok.
  - `non-member cannot list invites`: C hace `getList` → 0 ítems.
  - `owner kicks member`: A hace update con `members: [A.id]` → B ya no ve el grupo (404).
  - `member leaves`: B hace `leave` → B no ve el grupo. `leave` del dueño → 400. `leave` de un no miembro → 404.
- [ ] **Step 2: Correr → FAIL.**
- [ ] **Step 3: Implementar** la migración y los hooks.
- [ ] **Step 4: Correr → 9 passed.**
- [ ] **Step 5: Commit** `feat(server): invitaciones, unirse, echar y salir`

### Task 4: Salas

**Files:**
- Create (solo si algún test falla): `server/pb_migrations/4_reglas_rooms.js`. Las reglas de `rooms` ya vienen de la Task 2; las migraciones ya aplicadas no se editan.
- Test: `server/tests/salas.test.ts`

**Interfaces:**
- Consumes: `rooms` (Task 2), unirse (Task 3).

- [ ] **Step 1: Tests:**
  - `owner creates renames deletes rooms`: A crea `{group, name:'Juegos', kind:'chat', position:2}`, la renombra y la borra → ok.
  - `member cannot manage rooms`: B (unido) intenta crear, renombrar y borrar → 400/404.
  - `owner cannot move room to another group`: A hace update con `group: otroGrupo` → 400/404.
  - `non-member cannot list rooms`: C → 0 ítems.
  - `rejects invalid kind`: `kind:'video'` → 400.
- [ ] **Step 2: Correr → FAIL** en los casos de reglas que todavía no cumple. Si todo pasa a la primera, la Task 2 ya lo cubría: anotarlo en el ledger y seguir.
- [ ] **Step 3: Ajustar** las reglas o el hook si algún caso falla.
- [ ] **Step 4: Correr → 5 passed.**
- [ ] **Step 5: Commit** `test(server): permisos de salas`

### Task 5: Mensajes, archivos, tiempo real y límites de frecuencia

**Files:**
- Create: `server/pb_migrations/5_messages.js`, `server/pb_migrations/6_rate_limits.js`, `server/pb_hooks/messages.pb.js`
- Create: `server/tests/fixtures/` (`img.png` de 1 KB, `video.mp4` de 1 s, `doc.pdf`, `falso.png`, que es un `.exe` renombrado)
- Test: `server/tests/mensajes.test.ts`, `server/tests/rate-limits.test.ts`

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: la colección `messages`; las reglas de rate limit.

- [ ] **Step 1: Tests de `mensajes.test.ts`:**
  - `member posts text`: B publica `{room: chat, author: B.id, text:'hola'}` → ok.
  - `rejects empty message`: sin `text` y sin `file` → 400.
  - `rejects posting to voice room`: `room: voz` → 400.
  - `rejects spoofed author`: B publica con `author: A.id` → 400.
  - `posts image and video`: `FormData` con `img.png` y con `video.mp4` → ok; `pb.files.getURL(rec, rec.file)` responde 200.
  - `server rejects disallowed or oversized files`: `doc.pdf`, `falso.png` y un buffer de 26 MB con nombre `.mp4` → los tres dan 400.
  - `author deletes own, owner deletes any, member cannot delete others`.
  - `non-member cannot read messages`: C → 0 ítems.
  - `kicked member stops receiving realtime and loses access`:
    1. B se suscribe con `pb.collection('messages').subscribe('*', cb, {filter: room="<chat>"})`.
    2. A publica → B recibe 1 evento.
    3. A echa a B y publica otra vez → en 2 s, B no recibe más eventos.
    4. B hace `getList` → 0 ítems.
  - `deleting group cascades rooms messages invites`: activar el `it.todo` de la Task 2.
- [ ] **Step 2: Test de `rate-limits.test.ts`:** con `startPocketBase({ rateLimits: true })`, 6 llamadas seguidas a `/api/invites/join` con un código inexistente → la sexta da 429.
- [ ] **Step 3: Correr → FAIL.**
- [ ] **Step 4: Implementar** las migraciones y el hook.
- [ ] **Step 5: Correr toda la suite del servidor** — `npm test` en `server/` → todo pasa.
- [ ] **Step 6: Commit** `feat(server): mensajes con archivos, tiempo real y limites de frecuencia`

### Task 6: App Tauri + Svelte (armazón, conexión y helpers)

**Files:**
- Create: `app/` (scaffold `npm create tauri-app@latest app -- --template svelte-ts --manager npm`, dentro de la raíz del repo)
- Modify: `app/src-tauri/tauri.conf.json`
- Create: `app/src/lib/pb.ts`, `app/src/lib/adjuntos.ts`, `app/src/lib/invitacion.ts`
- Test: `app/src/lib/adjuntos.test.ts`, `app/src/lib/invitacion.test.ts`

**Interfaces:**
- Produces:

```ts
// pb.ts
export const PB_URL: string;  // import.meta.env.VITE_PB_URL ?? 'http://127.0.0.1:8090'
export const pb: PocketBase;  // instancia única; authStore persistido por el SDK (localStorage)

// adjuntos.ts
export const MAX_BYTES = 25 * 1024 * 1024;
export const MAX_VIDEO_S = 60;
export const TIPOS = ['image/png','image/jpeg','image/gif','image/webp','video/mp4','video/webm'] as const;
export type Validacion = { ok: true } | { ok: false; motivo: string };
export function validarAdjunto(f: { type: string; size: number }, duracionS?: number): Validacion;
export function duracionVideo(file: File): Promise<number>; // <video> + loadedmetadata; sin test unitario (DOM)

// invitacion.ts
export function extraerCodigo(entrada: string): string | null; // acepta "abc123xyz0", "discordmejorado://invite/abc123xyz0", "https://cualquier/invite/abc123xyz0"; recorta espacios; null si no hay 10 [a-z0-9]
export function linkInvitacion(code: string): string;           // "discordmejorado://invite/<code>"
```

- `tauri.conf.json` queda así:
  - `withGlobalTauri: false`
  - ventana: `minWidth: 960`, `minHeight: 640`, `width: 1200`, `height: 760`
  - `security.csp`: `"default-src 'self'; connect-src 'self' http://127.0.0.1:8090; img-src 'self' data: blob: http://127.0.0.1:8090; media-src 'self' blob: http://127.0.0.1:8090; style-src 'self' 'unsafe-inline'"`. En la etapa 6 se agrega el host real.

- [ ] **Step 1: Scaffold** y `npm i pocketbase` + `npm i -D vitest`. `npm run tauri dev` abre la ventana.
- [ ] **Step 2: Tests:**
  - `validarAdjunto`: imagen de 1 KB → ok; `application/pdf` → `{ok:false}`; 25 MB + 1 byte → `{ok:false}`; video de 61 s → `{ok:false}`; video de 59 s → ok.
  - `extraerCodigo`: los 3 formatos → `'abc123xyz0'`; `'  abc123xyz0 '` → igual; `'hola'` → `null`; `'ABC123XYZ0'` → `'abc123xyz0'`.
  - `linkInvitacion` + `extraerCodigo` ida y vuelta.
- [ ] **Step 3: Correr → FAIL. Step 4: Implementar. Step 5: Correr → pasan;** `npx svelte-check` sin errores.
- [ ] **Step 6: Commit** `feat(app): armazon tauri+svelte con csp, conexion y helpers`

### Task 7: Pantallas de cuenta y perfil

**Files:**
- Create: `app/src/lib/sesion.svelte.ts`, `app/src/vistas/Entrar.svelte`, `app/src/vistas/Perfil.svelte`
- Modify: `app/src/App.svelte`

**Interfaces:**
- Consumes: `pb` (Task 6), el modelo `users` (Task 1).
- Produces: `sesion.svelte.ts` exporta `usuario` (estado reactivo `$state<RecordModel | null>`, sincronizado con `pb.authStore.onChange`), `entrar(email, pass)`, `registrarse(email, pass, name)` (crea la cuenta y entra) y `salir()`.
- `App.svelte` elige la vista según el estado: sin `usuario` → `Entrar`; con usuario → layout principal (Task 8).

- [ ] **Step 1: Implementar.**
  - **`Entrar`:** pestañas "Entrar" y "Crear cuenta"; errores del servidor en texto, en español.
  - **`Perfil`:** nombre, foto (con `validarAdjunto` limitado a imágenes de ≤2 MB), color (`<input type="color">`) y estado. Guarda con `update`.
- [ ] **Step 2: Verificación manual en el navegador** con `npm run dev` y PocketBase corriendo: crear cuenta → entrar → editar perfil → recargar → sigue logueado y con el perfil guardado. (El E2E de la Task 10 lo automatiza.)
- [ ] **Step 3: Commit** `feat(app): cuentas y perfil`

### Task 8: Grupos, invitaciones y miembros

**Files:**
- Create: `app/src/lib/grupos.svelte.ts`, `app/src/vistas/Principal.svelte`, `app/src/vistas/Grupo.svelte`, `app/src/vistas/Miembros.svelte`

**Interfaces:**
- Consumes: `groups`, `invites`, `rooms`, `/api/invites/join`, `/api/groups/{id}/leave` (Tasks 2–4), y `extraerCodigo`, `linkInvitacion` (Task 6).
- Produces: `grupos.svelte.ts` exporta lo siguiente:
  - `grupos` (lista reactiva, recargada con `subscribe('*')` sobre `groups`) y `grupoActual`.
  - `crearGrupo(name)`, `unirse(entrada: string)` (usa `extraerCodigo`; da error "código inválido" si devuelve null), `crearInvitacion(groupId): Promise<string>` (devuelve el link), `echar(groupId, userId)`, `salirDe(groupId)`, `borrarGrupo(groupId)`.
  - `salas(groupId)` (lista reactiva) y `crearSala`, `renombrarSala`, `borrarSala`.
  - Si `grupoActual` desaparece (borrado o echado), vuelve a la lista sin romper (Review Focus 3).

- [ ] **Step 1: Implementar.**
  - **`Principal`:** columna de grupos con el botón "Crear grupo", que se oculta si el usuario ya creó uno, y "Unirme con código".
  - **`Grupo`:** lista de salas, separadas en "Salas de chat" y "Salas de voz"; la voz va deshabilitada con el texto "Disponible en la próxima versión". Botón "Invitar", que copia el link al portapapeles con `navigator.clipboard`.
  - **Acciones del dueño:** crear, renombrar y borrar salas; "Borrar grupo" con confirmación en un diálogo propio, no `confirm()`.
  - **`Miembros`:** lista con avatar, nombre, color y estado (vía `expand: 'members'`); "Echar" solo para el dueño; "Salir del grupo" para los demás.
- [ ] **Step 2: Verificación manual** con dos navegadores: A crea el grupo e invita → B se une con el link pegado → los dos ven las salas → A echa a B → la vista de B vuelve a la lista sin error.
- [ ] **Step 3: Commit** `feat(app): grupos, invitaciones y miembros`

### Task 9: Chat en tiempo real con adjuntos y moderación

**Files:**
- Create: `app/src/lib/chat.svelte.ts`, `app/src/vistas/Chat.svelte`

**Interfaces:**
- Consumes: `messages` (Task 5), `validarAdjunto`, `duracionVideo` (Task 6).
- Produces: `chat.svelte.ts` exporta `abrirChat(roomId): { mensajes: RecordModel[] (reactivo), cargarMas(): Promise<void>, cerrar(): void }`. Carga los últimos 50 con `sort: '-created'` y `expand: 'author'`, se suscribe con el filtro `room = "<id>"` y desuscribe en `cerrar`. También exporta `enviar(roomId, texto, archivo?)` y `borrar(id)`.

- [ ] **Step 1: Implementar `Chat.svelte`:**
  - Mensajes con autor (nombre, color y avatar), hora, texto, `<img>` o `<video controls>`.
  - "Cargar anteriores" al llegar arriba.
  - Composer: Enter envía y Shift+Enter hace salto de línea.
  - Adjuntar: valida con `validarAdjunto`, y con `duracionVideo` si es video. Si no pasa, muestra el motivo y no lo sube.
  - "Borrar" en los mensajes propios, y en todos si el usuario es dueño.
- [ ] **Step 2: Verificación manual** con dos navegadores: el mensaje aparece en el otro en <1 s; se suben una imagen y un video de 10 s; un video de 2 min se rechaza en el cliente; el dueño borra un mensaje de B y desaparece de los dos lados.
- [ ] **Step 3: Commit** `feat(app): chat en tiempo real con imagenes, videos y moderacion`

### Task 10: E2E del flujo completo y verificación en Tauri

**Files:**
- Create: `app/playwright.config.ts` (`use: { channel: 'msedge' }`, `webServer`: `npm run dev` en el puerto 1420), `app/e2e/flujo.spec.ts`

**Interfaces:**
- Consumes: `startPocketBase` de `../server/tests/harness.ts`. El E2E arranca su propio PocketBase y le pasa `VITE_PB_URL` al `webServer`.

- [ ] **Step 1: Escribir `flujo.spec.ts`** con dos contextos de navegador, A y B:
  1. A crea su cuenta y entra.
  2. A crea "Los pibes" y genera una invitación (lee el link del portapapeles o del texto mostrado).
  3. B crea su cuenta y se une con ese link → ve "General" en "Salas de chat".
  4. B escribe "hola" → A lo ve en ≤3 s.
  5. A sube `fixtures/img.png` → B ve un `<img>`.
  6. A borra el mensaje de B → desaparece en B.
  7. A echa a B → B vuelve a la lista de grupos y "Los pibes" ya no aparece.
- [ ] **Step 2: Correr** `npx playwright test` → 1 passed.
- [ ] **Step 3: Verificación en Tauri:** `npm run tauri dev` con PocketBase local → entrar, abrir un grupo, mandar un mensaje con imagen. **La CSP no bloquea nada:** sin errores de CSP en la consola, verificado por depuración remota o con las DevTools. La ventana no achica por debajo de 960×640.
- [ ] **Step 4: Commit** `test(app): e2e de cuentas, grupos, invitaciones y chat`

---

**Fuera de esta etapa** (va a otras): voz y silenciar (etapa 3), pantalla compartida (4), botonera y música (5), despliegue, dominio y TLS (6). **El tope de espacio por grupo** que el spec dejó a criterio del redactor se pasa a la etapa 6, junto con el disco real del servidor. Por ahora alcanza con el tope de 25 MB por archivo y los límites de frecuencia.
