# Cuentas y login — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cuentas con invitación una sola vez, usuario único fijo, contraseña segura, edad mínima, términos
aceptados, código de 6 números por mail, olvidé mi contraseña y Google/Outlook, en la app y en la página web.

**Architecture:** El servidor (PocketBase) es la única fuente de verdad: valida todo y un middleware global
corta cualquier API a una cuenta que no está "completa" (confirmada + invitada + términos vigentes + perfil
completo). Los códigos de 6 números son propios (colección `codigos`, hash SHA-256) y sirven para confirmar el
mail y para restablecer la contraseña. App (Tauri/Svelte) y página (SvelteKit) consumen las mismas rutas
`/api/cuenta/*`. Secretos (SMTP, OAuth, código de invitación) viven en `/opt/thunderop/thunderop.env` y un hook
los aplica al arrancar.

**Tech Stack:** PocketBase 0.40.5 (hooks JS, migraciones JS), vitest; Tauri 2 + Svelte 5 + `pocketbase` ^0.28.1;
SvelteKit 3 + Tailwind 4 + Playwright (página); Resend (SMTP) con dominio `thunderop.com` en Cloudflare.

**Spec:** `docs/specs/2026-10-23-cuentas-y-login.md`

## Global Constraints

- Código de invitación: `<código de invitación>`, en la variable `THUNDEROP_CODIGO` del servidor. Nunca en el repo, la app ni el HTML.
- Versión de términos vigente: variable `TERMINOS_VERSION` (entero, empieza en `1`).
- Usuario: `^[a-z0-9._]{3,20}$`, único, fijo después de creado (se normaliza `trim()` + minúsculas antes de validar).
- Contraseña: mínimo 8, al menos una mayúscula, un número y un carácter que no sea letra ni número.
- Edad: < 13 no se registra; 13–17 menor; ≥ 18 mayor. La fecha de nacimiento es `hidden` y no se cambia.
- Código del mail: 6 dígitos, vence a los 10 minutos, 5 intentos, pedir uno nuevo invalida el anterior.
- Cuentas sin confirmar: se borran a las 24 h.
- Microsoft: solo cuentas personales (endpoints `consumers`).
- Remitente: `no-responder@thunderop.com`, nombre `Thunderop`; mails en castellano.
- Dirección pública del servidor: `https://thunderop.duckdns.org` (meta.appURL); OAuth vuelve a `/api/oauth2-redirect`.
- Se mantienen "Recordar mi cuenta", sesión de 30 días y el límite `*:auth`.
- Sin `Co-Authored-By` ni "Generated with Claude" en commits. Commit/push solo cuando Jorge lo pide.
- Desplegar al servidor, borrar datos y publicar (app o página) se confirma con Jorge en el momento.

## Review Focus

- Usuario escrito con mayúsculas o espacios (`" Jorgel "`) → se guarda `jorgel`; `jorgel` y `JORGEL` chocan como duplicado.
- Mail con otra capitalización (`Jorge@Gmail.com` al registrarse, `jorge@gmail.com` al entrar o con Google) → misma cuenta.
- Cumpleaños de 13 justo hoy → entra; un día antes de cumplir 13 → rechazado; una fecha futura o imposible → rechazada.
- Código del mail: equivocarse 5 veces lo invalida, vencido no sirve, el pedido nuevo invalida el viejo, y pedir código para un mail inexistente responde igual que uno existente.
- Cuenta incompleta pidiendo cualquier otra cosa (listar grupos, `/api/realtime`, archivos, LiveKit token) → 403 con `{ "falta": [...] }`.

---

## File Structure

**Servidor (`server/`)**
- `pb_migrations/9_zz_cuentas.js` — campos nuevos de `users`, identidad usuario/mail, saca el índice único de `name`, colección `codigos`, reglas de límite de intentos. (Nombre con `zz`: PocketBase ordena por nombre de archivo y `10_` correría antes que `1_perfil`.)
- `pb_hooks/reglas.js` — validaciones puras (sin `pb.js`, se cargan con `require`): usuario, contraseña, edad.
- `pb_hooks/mail.js` — mandar un mail (o loguearlo si `THUNDEROP_MAIL=log`, solo para tests).
- `pb_hooks/cuentas.pb.js` — registro, códigos, estado, completar, invitación, términos, guardia global, limpieza, OAuth.
- `pb_hooks/configuracion.pb.js` — al arrancar aplica SMTP, meta y proveedores OAuth desde variables de entorno.
- `pb_hooks/social.pb.js` — amistad por `username`.
- `tests/harness.ts` — `nuevoUsuario` crea cuentas completas; opción para crear incompletas.
- `tests/cuentas.test.ts` — todo lo nuevo.

**App (`app/src/lib/`)**
- `reglasCuenta.ts` (+ `.test.ts`) — mismas reglas que `reglas.js`, para mostrar en vivo.
- `cuenta.svelte.ts` — llamadas a `/api/cuenta/*`, estado de la cuenta, OAuth.
- `sesion.svelte.ts` — `entrar` acepta usuario o mail; `registrarse` con los campos nuevos; mensajes.
- `vistas/Entrar.svelte`, `vistas/Verificar.svelte`, `vistas/Completar.svelte`, `vistas/Olvide.svelte`.
- `routes/+page.svelte` — muestra Completar/Verificar según el estado.

**Página (`D:\PROYECTOS\Thunderop-Website\src/`)**
- `lib/pb.ts`, `lib/reglasCuenta.ts` (copia de la app), `lib/cuenta.svelte.ts`.
- `routes/entrar`, `routes/crear-cuenta`, `routes/verificar`, `routes/olvide`, `routes/completar`, `routes/cuenta`, `routes/terminos`, `routes/privacidad`.
- `routes/descargar/+server.ts` + `lib/server/descarga.ts` — validar con el servidor.

---

### Task 1: Esquema de cuentas y harness de tests

**Files:**
- Create: `server/pb_migrations/9_zz_cuentas.js`
- Modify: `server/tests/harness.ts`
- Test: `server/tests/cuentas.test.ts`

**Interfaces:**
- Produces: campos de `users`: `username` (texto, requerido, patrón `^[a-z0-9._]{3,20}$`, índice único `idx_users_username`), `nacimiento` (fecha, `hidden`), `invitado` (bool, `hidden`), `terminos` (número entero), `terminosFecha` (fecha), `perfilCompleto` (bool). `passwordAuth.identityFields = ["email", "username"]`. Sin `idx_users_name_nocase`. Colección `codigos` (`user` relación a users con borrado en cascada, `tipo` select `verificar|restablecer`, `hash` texto, `expira` fecha, `intentos` número; todas las reglas `null`). `users.updateRule` = dueño y sin tocar `username`, `nacimiento`, `invitado`, `terminos`, `terminosFecha`, `perfilCompleto`, `verified`, `email`. Reglas de límite: `/api/cuenta/codigo` 3 cada 60 s, `/api/cuenta/` 20 cada 60 s, `/api/descarga/validar` 5 cada 60 s.
- Produces (harness): `nuevoUsuario(nombre: string, opts?: { incompleta?: boolean }): Promise<PocketBase>` — por defecto la crea el admin con `username` único, `verified: true`, `invitado: true`, `terminos: 1`, `perfilCompleto: true`, `nacimiento: '1996-01-01'`; con `incompleta` la crea sin `verified`/`invitado`. El harness pasa por defecto `TERMINOS_VERSION=1`, `THUNDEROP_CODIGO=PRUEBA26`, `THUNDEROP_MAIL=log`.

- [ ] **Step 1: Write the failing test** `it('esquema: usuario único, identidad por usuario o mail, nombre repetible')`: el admin crea dos usuarios con el mismo `name` y distinto `username` (OK); un tercero con `username: 'jorgel'` repetido → 400; `authWithPassword('jorgel', pass)` y `authWithPassword(mail, pass)` entran a la misma cuenta; el dueño no puede `update({ username: 'otro' })` ni `update({ invitado: true })` (400/403); `codigos` no se puede listar como usuario (403 o lista vacía).
- [ ] **Step 2: Run** `npx vitest run tests/cuentas.test.ts` → FAIL (campo `username` no existe).
- [ ] **Step 3: Implement** la migración (con su `down`) y el harness. Los tests existentes de `server/tests` usan `nuevoUsuario` y tienen que seguir pasando; los únicos que se cambian son los que prueban que `name` es único (ahora el único es `username`) y, en la Task 6, los de pedir amistad por nombre.
- [ ] **Step 4: Run** `npx vitest run` (todo `server/tests`) → PASS.
- [ ] **Step 5: Commit** `feat(cuentas): esquema de usuario, códigos y harness`

### Task 2: Reglas de registro en el servidor

**Files:**
- Create: `server/pb_hooks/reglas.js`, `server/pb_hooks/cuentas.pb.js`
- Test: `server/tests/cuentas.test.ts`

**Interfaces:**
- Produces (`reglas.js`): `normalizarUsuario(s: string): string`, `errorUsuario(s: string): string` (`''` si vale), `errorClave(s: string): string`, `edad(nacimiento: string /* YYYY-MM-DD */, hoy: string /* YYYY-MM-DD */): number`, `errorEdad(nacimiento, hoy): string`. Mensajes exactos: `'El usuario tiene que tener de 3 a 20 caracteres: letras sin acentos, números, punto o guion bajo.'`, `'La contraseña necesita 8 caracteres, una mayúscula, un número y un carácter especial.'`, `'Tenés que tener al menos 13 años para usar Thunderop.'`, `'La fecha de nacimiento no es válida.'`, `'Tenés que aceptar los términos y la política de privacidad.'`.
- Produces (`cuentas.pb.js`): `onRecordCreateRequest` de `users` para quien no es superuser: normaliza `username`, valida usuario, contraseña, edad (con la fecha de hoy en UTC) y `terminos === TERMINOS_VERSION`; fuerza `invitado=false`, `verified=false`, `perfilCompleto=true`, `terminosFecha=ahora`. Errores como `BadRequestError` con el mensaje de arriba.

- [ ] **Step 1: Write the failing tests** (sin auth, `pb.collection('users').create(...)` con `email, password, passwordConfirm, username, name, nacimiento, terminos: 1`):
  `it('registro válido queda sin confirmar ni invitado')` → creado, `verified` false; `it('usuario se normaliza')` con `' Jorgel '` → `username === 'jorgel'`; `it('contraseña débil')` con `'abcdefgh'`, `'Abcdefg1'`, `'abcdefg1!'` → 400 con el mensaje de contraseña; `it('edad mínima')` con hoy simulado vía fecha calculada en el test: 13 años justos hoy → OK, 13 años menos un día → 400 con el mensaje de edad, `'2999-01-01'` y `'2000-02-30'` → 400 fecha no válida; `it('sin aceptar términos')` con `terminos: 0` → 400; `it('no se puede auto-invitar')` mandando `invitado: true, verified: true` → creado con ambos en false; `it('mail con mayúsculas')`: registrarse con `Ana@Test.Local` y entrar con `ana@test.local` (si PocketBase no lo hace solo, normalizar `email` a minúsculas en el hook).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `reglas.js` y el hook (cargar `reglas.js` con `require(`${__hooks}/reglas.js`)` dentro del handler).
- [ ] **Step 4: Run** `npx vitest run tests/cuentas.test.ts` → PASS.
- [ ] **Step 5: Commit** `feat(cuentas): validación de registro en el servidor`

### Task 3: Códigos de 6 números (confirmar mail y restablecer contraseña)

**Files:**
- Create: `server/pb_hooks/mail.js`
- Modify: `server/pb_hooks/cuentas.pb.js`
- Test: `server/tests/cuentas.test.ts`

**Interfaces:**
- Produces (`mail.js`): `enviar(app, para: string, asunto: string, html: string): void` — con `THUNDEROP_MAIL=log` hace `app.logger().info("mail", ...)`; si no, `app.newMailClient().send(new MailerMessage({ from: { address: app.settings().meta.senderAddress, name: app.settings().meta.senderName }, to: [{ address: para }], subject, html }))`.
- Produces (rutas, sin auth):
  - `POST /api/cuenta/codigo` `{ email, tipo: 'verificar'|'restablecer' }` → siempre `200 {}` (exista o no la cuenta). Si existe (y para `verificar`, si no está confirmada): borra códigos previos de ese tipo, genera 6 dígitos con `$security.randomStringWithAlphabet(6, "0123456789")`, guarda `hash = $security.sha256(codigo)`, `expira = ahora + 10 min`, `intentos = 0`, y manda el mail. Asuntos: `'Tu código para confirmar tu cuenta de Thunderop'` / `'Tu código para cambiar la contraseña de Thunderop'`; el cuerpo dice el código grande, que vence en 10 minutos y que si no lo pediste lo ignores.
  - `POST /api/cuenta/verificar` `{ email, codigo }` → `200 {}` y `verified = true`; si falla `400 'El código no es válido o venció.'`.
  - `POST /api/cuenta/restablecer` `{ email, codigo, password }` → valida `errorClave`, cambia la contraseña (`record.setPassword`) y además deja `verified = true`; `400` igual que arriba.
  - Cada intento fallido suma `intentos`; al llegar a 5 o vencido, el código se borra.

- [ ] **Step 1: Write the failing tests:** `it('confirmar con código')` — registrarse, `POST /api/cuenta/codigo`, el admin reemplaza el `hash` del código de ese usuario por `sha256('123456')` (calculado en node con `crypto`), `POST /api/cuenta/verificar` con `'123456'` → `verified` true; `it('código mal 5 veces lo invalida')` — 5 intentos con `'000000'` y después el correcto → 400; `it('código vencido')` — el admin pone `expira` en el pasado → 400; `it('pedir otro invalida el anterior')` — dos pedidos, solo queda un registro en `codigos`; `it('mail inexistente responde igual')` → 200 y ningún código creado; `it('restablecer contraseña')` — con código, contraseña nueva válida → `authWithPassword` con la nueva entra, con la vieja no; contraseña débil → 400.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `mail.js` y las tres rutas en `cuentas.pb.js`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(cuentas): códigos por mail para confirmar y restablecer`

### Task 4: Guardia global, estado, completar, invitación, términos y validación de descarga

**Files:**
- Modify: `server/pb_hooks/cuentas.pb.js`
- Test: `server/tests/cuentas.test.ts`

**Interfaces:**
- Produces: `GET /api/cuenta/estado` (auth) → `{ verificado: boolean, invitado: boolean, terminos: number, terminosVigente: number, perfilCompleto: boolean, menor: boolean, username: string }`; `falta` = lista de `'verificar' | 'invitacion' | 'terminos' | 'perfil'` en ese orden.
- Produces: `POST /api/cuenta/invitacion` `{ codigo }` (auth) → `200` y `invitado = true` si coincide con `THUNDEROP_CODIGO` (comparación sin distinguir mayúsculas y con `trim`); si no `400 'El código de invitación no es válido.'`.
- Produces: `POST /api/cuenta/completar` `{ username, nacimiento, terminos }` (auth, solo si `perfilCompleto` es false) → valida igual que el registro, guarda y pone `perfilCompleto = true`. Si ya estaba completo → `400 'Tu perfil ya está completo.'`.
- Produces: `POST /api/cuenta/terminos` `{ version }` (auth) → si `version === TERMINOS_VERSION` guarda `terminos` y `terminosFecha`.
- Produces: `POST /api/descarga/validar` `{ codigo }` (sin auth) → `200 {}` o `401 {}`; con un token de cuenta completa también `200` sin código.
- Produces: `routerUse` global: si hay `e.auth` de `users` y le falta algo de `falta`, responde `403 { message: 'Tu cuenta no está completa.', falta }` salvo para: `/api/cuenta/*`, `/api/collections/users/auth-*` (incluye `auth-refresh` y `auth-methods`), `GET /api/collections/users/records/{su id}`, `/api/descarga/validar`. Sin auth o superuser: pasa.

- [ ] **Step 1: Write the failing tests:** `it('incompleta no puede usar nada')` — `nuevoUsuario('x', { incompleta: true })`: listar `groups` → 403 con `falta: ['verificar','invitacion']`, `POST /api/rooms/{id}/token` → 403, suscribirse por realtime (`pb.collection('groups').subscribe('*', ...)`) falla; `GET /api/cuenta/estado` → 200; `it('invitación')` — código mal → 400, `'prueba26'` → invitado; `it('completar perfil')` — usuario incompleto con `perfilCompleto=false` (lo arma el admin): completar con datos válidos → `perfilCompleto` true, segunda vez → 400, usuario ya tomado → 400; `it('términos nuevos')` — harness con `TERMINOS_VERSION=2` y cuenta con `terminos: 1` → `falta: ['terminos']`, `POST /api/cuenta/terminos {version: 2}` → completa; `it('descarga')` — sin código 401, con `'PRUEBA26'` 200, con token de cuenta completa 200.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** en `cuentas.pb.js`. `menor` = `edad(nacimiento, hoy) < 18`.
- [ ] **Step 4: Run** `npx vitest run` (todo) → PASS.
- [ ] **Step 5: Commit** `feat(cuentas): guardia de cuenta completa, invitación y términos`

### Task 5: Google/Microsoft, configuración desde el entorno y limpieza

**Files:**
- Create: `server/pb_hooks/configuracion.pb.js`
- Modify: `server/pb_hooks/cuentas.pb.js`
- Test: `server/tests/cuentas.test.ts`

**Interfaces:**
- Produces (`configuracion.pb.js`, `onBootstrap` después de `e.next()`): si están las variables, aplica `meta.appURL = APP_URL`, `meta.appName = 'Thunderop'`, `meta.senderName = 'Thunderop'`, `meta.senderAddress = MAIL_REMITENTE`; `smtp` desde `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` (`tls: true` si el puerto es 465); en `users.oauth2`: `enabled = true` y proveedores `google` (`GOOGLE_ID`, `GOOGLE_SECRET`) y `microsoft` (`MICROSOFT_ID`, `MICROSOFT_SECRET`, con `authURL`/`tokenURL` de `https://login.microsoftonline.com/consumers/oauth2/v2.0/...`). Variables que faltan → no toca esa parte.
- Produces (`cuentas.pb.js`): `onRecordAuthWithOAuth2Request` de `users`: si `e.record` existe y no está confirmado → se borra y `e.record = null` (se crea uno nuevo); si `e.isNewRecord`: `username = 'u' + $security.randomStringWithAlphabet(12, 'abcdefghijklmnopqrstuvwxyz0123456789')`, `perfilCompleto = false`, `invitado = false`, `terminos = 0`, `name` = el nombre que da el proveedor (o la parte del mail antes de `@`).
- Produces: `cronAdd('cuentas-sin-confirmar', '0 * * * *', ...)` borra `users` con `verified = false` y `created < ahora - CUENTAS_SIN_CONFIRMAR_HORAS` (variable, por defecto `24`).

- [ ] **Step 1: Write the failing tests:** `it('config desde el entorno')` — harness con `GOOGLE_ID=g`, `GOOGLE_SECRET=s`, `APP_URL=https://ejemplo.test`: el admin lee `users` y ve `oauth2.enabled` y el proveedor `google` con `clientId 'g'`, y `settings.meta.appURL`; `it('limpieza de sin confirmar')` — harness con `CUENTAS_SIN_CONFIRMAR_HORAS=0` (la limpieza usa esa variable, por defecto `24`): un usuario sin confirmar y uno confirmado, el admin corre `POST /api/crons/cuentas-sin-confirmar` → el sin confirmar ya no existe y el confirmado sí. El flujo OAuth real se prueba a mano en la Task 11.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(cuentas): Google/Microsoft, configuración por entorno y limpieza`

### Task 6: Amigos por usuario

**Files:**
- Modify: `server/pb_hooks/social.pb.js:26-40`, `server/tests/social.test.ts`
- Modify: `app/src/lib/amigos.svelte.ts`, `app/src/lib/vistas/Amigos.svelte:54`

**Interfaces:**
- Produces: `POST /api/amigos/solicitar` `{ username }` busca por `username` normalizado (además de `usuario` = id, que se mantiene); error `'No hay nadie con ese usuario.'`. El body `nombre` deja de existir.
- App: el campo dice `placeholder="Usuario exacto"`, `aria-label="Usuario del amigo"`, `maxlength="20"`, y manda `{ username }`.

- [ ] **Step 1: Write the failing test** en `social.test.ts`: solicitar por `username` (con mayúsculas) encuentra al otro; por `name` ya no.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** servidor y app. **Step 4: Run** `npx vitest run` en `server` y `npm test` en `app` → PASS.
- [ ] **Step 5: Commit** `feat(amigos): agregar por usuario`

### Task 7: App — lógica de cuenta

**Files:**
- Create: `app/src/lib/reglasCuenta.ts`, `app/src/lib/reglasCuenta.test.ts`, `app/src/lib/cuenta.svelte.ts`
- Modify: `app/src/lib/sesion.svelte.ts`

**Interfaces:**
- Produces (`reglasCuenta.ts`, mismas reglas y mensajes que `server/pb_hooks/reglas.js`): `normalizarUsuario`, `errorUsuario`, `requisitosClave(s: string): { largo: boolean; mayuscula: boolean; numero: boolean; especial: boolean }`, `errorClave`, `edad(nacimiento: string, hoy: Date): number`, `errorEdad`.
- Produces (`cuenta.svelte.ts`): `export type Falta = 'verificar' | 'invitacion' | 'terminos' | 'perfil'`; `export const cuenta = $state<{ falta: Falta[] | null; menor: boolean; terminosVigente: number }>`; `cargarEstado(): Promise<void>`; `pedirCodigo(email: string, tipo: 'verificar' | 'restablecer')`; `verificar(email: string, codigo: string)`; `restablecer(email: string, codigo: string, password: string)`; `ponerInvitacion(codigo: string)`; `completar(datos: { username: string; nacimiento: string; terminos: number })`; `aceptarTerminos(version: number)`; `entrarCon(proveedor: 'google' | 'microsoft')` usando `pb.collection('users').authWithOAuth2({ provider, urlCallback: (url) => openUrl(url) })` de `@tauri-apps/plugin-opener`.
- Modifies (`sesion.svelte.ts`): `entrar(identidad: string, pass: string, recordar?: boolean)` (usuario o mail); `registrarse(datos: { email: string; username: string; name: string; password: string; nacimiento: string; terminos: number }, recordar?: boolean)` crea la cuenta y pide el código `verificar` (no entra hasta confirmar); después de `verificar`, `entrar` con la contraseña. `mensajeError` suma: usuario repetido `'Ese usuario ya existe, probá con otro.'`, 403 de cuenta incompleta pasa por `cuenta.falta`, y deja de existir el de nombre repetido.

- [ ] **Step 1: Write the failing tests** en `reglasCuenta.test.ts`: los mismos casos de usuario, contraseña y edad que la Task 2 (13 justos hoy entra, un día antes no, `'2000-02-30'` no vale), y `requisitosClave('Abc!')` → `{ largo: false, mayuscula: true, numero: false, especial: true }`.
- [ ] **Step 2: Run** `npx vitest run src/lib/reglasCuenta.test.ts` → FAIL. **Step 3: Implement.** **Step 4: Run** `npm test` y `npm run check` → PASS, 0 errores.
- [ ] **Step 5: Commit** `feat(app): lógica de cuenta (reglas, códigos, OAuth)`

### Task 8: App — pantallas

**Files:**
- Modify: `app/src/lib/vistas/Entrar.svelte`, `app/src/routes/+page.svelte`
- Create: `app/src/lib/vistas/Verificar.svelte`, `app/src/lib/vistas/Completar.svelte`, `app/src/lib/vistas/Olvide.svelte`
- Modify: `app/src/lib/novedades.ts`, `app/src-tauri/tauri.conf.json` (versión `0.6.0`)

**Interfaces:**
- Consumes: Task 7.
- `Entrar.svelte`: pestañas "Entrar" (usuario o mail + contraseña, "Recordar mi cuenta", link "Olvidé mi contraseña", botones "Entrar con Google" y "Entrar con Outlook") y "Crear cuenta" (mail, usuario, apodo, contraseña con la lista de requisitos tildándose en vivo, fecha de nacimiento con `<input type="date">`, casilla "Acepto los términos y la política de privacidad" con links a `https://thunderop.com/terminos` y `/privacidad` abiertos con el opener). Al crear la cuenta pasa a `Verificar`.
- `Verificar.svelte`: un campo de 6 dígitos (`inputmode="numeric"`, `maxlength="6"`, `autocomplete="one-time-code"`), "Reenviar código" deshabilitado 60 s, mensaje del servidor si falla.
- `Completar.svelte`: según `cuenta.falta` muestra lo que corresponde: código de invitación; perfil (usuario, fecha, términos) para Google/Outlook; aceptar términos nuevos.
- `+page.svelte`: con sesión, `cargarEstado()`; si `cuenta.falta?.length` muestra `Completar` (o `Verificar` si falta `verificar`), si no `Principal`.
- Novedades 0.6.0: cuentas nuevas (usuario, código por mail, olvidé mi contraseña, Google y Outlook) y aviso de que se empezó de cero.

- [ ] **Step 1:** Implementar las pantallas.
- [ ] **Step 2: Run** `npm run check` → 0 errores; `npm test` → PASS.
- [ ] **Step 3: Verificar a mano** contra un servidor local (`server/pocketbase.exe serve` con `THUNDEROP_MAIL=log` y `THUNDEROP_CODIGO=PRUEBA26`, `npm run tauri dev`): crear cuenta → el código sale en el log → confirmar → pide invitación → `PRUEBA26` → entra; olvidé mi contraseña con el código del log; usuario repetido muestra el mensaje.
- [ ] **Step 4: Commit** `feat(app): pantallas de cuenta y versión 0.6.0`

### Task 9: Página — cuenta, términos y descarga

**Files (repo `D:\PROYECTOS\Thunderop-Website`):**
- Create: `src/lib/pb.ts` (`new PocketBase(PUBLIC_PB_URL)`), `src/lib/reglasCuenta.ts` (copia literal de la app, con un comentario que lo dice), `src/lib/cuenta.svelte.ts` (mismas funciones que la app salvo `entrarCon`, que usa el popup normal de `authWithOAuth2({ provider })`)
- Create: `src/routes/entrar`, `crear-cuenta`, `verificar`, `olvide`, `completar`, `cuenta`, `terminos`, `privacidad` (`+page.svelte` cada una), textos en `es` y `en` con el i18n existente.
- Modify: el botón "Iniciar sesión" del header (hoy abre "Próximamente") lleva a `/entrar`; con sesión, a `/cuenta`.
- Modify: `src/routes/descargar/+server.ts`, `src/lib/server/descarga.ts` — sin hash: reenvía `{ codigo }` (o el header `Authorization` de la sesión) a `POST {PB_URL}/api/descarga/validar` y devuelve el link solo si responde 200.
- Términos y privacidad: borrador versión `1`, fecha `2026-10-23`, en castellano: edad mínima 13 y cuentas de menores; conductas prohibidas (acoso, contenido sexual con menores, contenido ilegal, spam, suplantar a otros); mentir con la edad u otros datos o romper las reglas puede terminar en suspensión o baneo; qué datos se guardan (mail, usuario, apodo, fecha de nacimiento, mensajes y archivos que se suben) y para qué; derecho a pedir el borrado; contacto `soporte@thunderop.com`; aviso de que es un servicio en beta. Arriba de cada uno: "Borrador — pendiente de revisión legal".
- Test: `tests/` de Playwright: `/crear-cuenta` muestra los requisitos de contraseña tildándose; la descarga sin código no muestra el link; `/terminos` y `/privacidad` cargan en `es` y `en`.

- [ ] **Step 1: Write the failing e2e tests.** **Step 2: Run** `npx playwright test` → FAIL.
- [ ] **Step 3: Implement.** Variable `PUBLIC_PB_URL=https://thunderop.duckdns.org` en `.env` local y en Vercel (Jorge la carga o lo hace la CLI con su OK).
- [ ] **Step 4: Run** `npx playwright test` y `npm run build` → PASS.
- [ ] **Step 5: Commit** `feat: cuentas, términos y descarga validada por el servidor`

### Task 10: Mails y proveedores (con Jorge)

**Files:** ninguno del repo. Variables en `/opt/thunderop/thunderop.env`.

- [ ] **Step 1: Resend** — Jorge crea la cuenta (gratis), agrega el dominio `thunderop.com`, y Claude lo guía a copiar en Cloudflare los registros DNS que pide Resend (SPF, DKIM, y el MX de rebotes). Esperar "Verified". Crear una API key de envío.
- [ ] **Step 2: Reenvío** — en Cloudflare, Email Routing: `soporte@thunderop.com` → el mail personal que Jorge elija.
- [ ] **Step 3: Google** — Google Cloud Console: proyecto "Thunderop", pantalla de consentimiento externa con nombre Thunderop, dominios autorizados `thunderop.com` y `duckdns.org`, links a términos y privacidad; cliente OAuth "Aplicación web" con URI de redirección `https://thunderop.duckdns.org/api/oauth2-redirect`. Si Google rechaza `duckdns.org` como dominio autorizado, anotarlo: el plan B es mover el servidor a `app.thunderop.com` (otro proyecto).
- [ ] **Step 4: Microsoft** — Entra ID (portal de Azure con la cuenta Microsoft de Jorge): registro de aplicación, tipo "Solo cuentas personales de Microsoft", redirección web `https://thunderop.duckdns.org/api/oauth2-redirect`, crear un secreto.
- [ ] **Step 5:** agregar a `/opt/thunderop/cuentas.env` (el instalador no lo toca): `THUNDEROP_CODIGO=<código de invitación>`, `TERMINOS_VERSION=1`, `APP_URL=https://thunderop.duckdns.org`, `MAIL_REMITENTE=no-responder@thunderop.com`, `SMTP_HOST=smtp.resend.com`, `SMTP_PORT=465`, `SMTP_USER=resend`, `SMTP_PASS=<api key>`, `GOOGLE_ID`, `GOOGLE_SECRET`, `MICROSOFT_ID`, `MICROSOFT_SECRET`. (Lo pega Jorge o Claude con su OK; nunca al repo.)

### Task 11: Despliegue y arranque limpio (con OK de Jorge en cada paso)

- [ ] **Step 1: Backup** — parar `thunderop-pocketbase`, copiar `/opt/thunderop/pb_data` a `/opt/thunderop/pb_data.bak-0.5.1-antes-de-cuentas`, comprobar que el tamaño coincide.
- [ ] **Step 2: Borrar** — mover `pb_data` fuera (queda el backup) y dejar que PocketBase cree uno nuevo con todas las migraciones; `pocketbase superuser upsert <mail> <clave>` (la clave la elige Jorge y la guarda él).
- [ ] **Step 3: Subir** `pb_hooks` y `pb_migrations` (con copia de los actuales), arrancar el servicio. Comprobar: `GET /api/health` 200, `POST /api/descarga/validar {codigo:'<código de invitación>'}` 200 y `{codigo:'x'}` 401, `GET /api/collections/users/auth-methods` lista `google` y `microsoft`.
- [ ] **Step 4: Prueba real** — Jorge crea su cuenta en la página: le llega el mail de `no-responder@thunderop.com` con el código, confirma, pone `<código de invitación>`, baja el instalador. Después entra con Google en la app.
- [ ] **Step 5: Publicar la 0.6.0** (`npm run release -- thunderop.duckdns.org`, copia de la 0.5.1 en `descargas.bak-0.5.1`) y la página (push a `main` del repo web). El actualizador de las apps viejas corre antes del login (`+page.svelte` muestra `Actualizacion` primero), así que al abrir ofrece la 0.6.0.
- [ ] **Step 6:** actualizar la memoria del proyecto y commitear/pushear con OK de Jorge.
