# Thunderop — Amigos, presencia, insignia de fundador y configuración

Fecha: 2026-10-20. Sigue al diseño inicial (`2026-10-18-diseno-inicial.md`); la app ya está publicada (v0.1.1) y la usan el dueño (Jorge, nombre en la app "osidis") y sus amigos.

## Intención

Después de la primera prueba real con amigos, el dueño quiere que la app se sienta más "viva" y social: ver quién está conectado, tener una lista de amigos con mensajes privados, que se note que él es el fundador, y ordenar el perfil y la configuración en un lugar claro. Éxito = sus amigos se agregan entre ellos y se escriben por privado dentro de Thunderop en vez de usar otra app.

## Objetivos

### 1. Presencia (conectado / desconectado)
- Al lado de la foto de cada persona, una lucecita: **verde** si tiene Thunderop abierto y **gris** si no.
- Se ve en el panel de Participantes y en la lista de amigos.
- *Decisión del redactor:* en Participantes, arriba los conectados y abajo los desconectados (más apagados), como en el mockup del kit de diseño (`Imagenes/Thunderop_App_UI_Kit_ClaudeCode/Imagen de ChatGPT 19 oct 2026, 12_12_57 a.m.png`).
- Al cerrar la app (o perder conexión) la lucecita pasa a gris en, como mucho, 1 o 2 minutos. No hace falta que sea instantáneo.
- Cómo se detecta (latido periódico, conexión realtime de PocketBase, etc.): *a cargo del constructor*.

### 2. Panel "Participantes"
- El panel derecho que hoy dice "Miembros — N" pasa a decir **"Participantes — N"** (decisión del dueño: palabra genérica/formal, no la de Discord).
- Muestra quién tiene el **micrófono apagado** (ícono 🔇) entre los que están en una sala de voz del grupo. *Decisión del redactor:* cuenta tanto el que se silenció solo (estado de LiveKit) como el que silenció el dueño (`groups.silenciados`). Para verlo desde fuera de la sala hay que extender `/api/groups/{id}/voz` con el estado de mute y refrescarlo (el refresco de presencia que ya existe alcanza; unos segundos de demora están bien). Quien no está en voz no muestra ícono de micrófono.
- **Clic derecho** sobre una persona → menú con **"Agregar amigo"** (si no son amigos ni hay solicitud pendiente). Las acciones del dueño del grupo que hoy hay ahí (echar) pueden ir en ese mismo menú: *a cargo del constructor*.

### 3. Insignia de fundador
- El usuario del dueño lleva una insignia de **fundador de Thunderop** al lado del nombre, en **toda la app**: Participantes, chat (grupo y privado), tarjetas de voz y lista de amigos.
- Es distinta de la corona 👑 de dueño de grupo, que se mantiene como está.
- *Decisión del redactor:* un campo booleano en el usuario (`fundador`), que se activa a mano desde el panel de PocketBase. Ningún usuario puede ponérselo a sí mismo desde la app (el servidor lo rechaza). Diseño visual de la insignia (rayo violeta del logo, tilde de verificado o similar, con tooltip "Fundador de Thunderop"): *a cargo del constructor*, coherente con la paleta Thunderop Pulse.

### 4. Nombre de usuario único
- El nombre pasa a ser **único** (decisión del dueño). Si alguien elige uno que ya existe, al registrarse o al cambiarlo, ve: **"Ese nombre ya existe, probá con otro."**
- *Decisión del redactor:* la comparación no distingue mayúsculas ("Tetu" = "tetu"). Es el mismo nombre que se muestra; no se agrega un segundo "@usuario".
- Usuarios existentes con nombres repetidos: hoy son muy pocos (el dueño y sus amigos). *Decisión del redactor:* la migración no debe fallar; si hay repetidos, renombra los más nuevos agregando un número ("tetu2") y el dueño avisa por fuera.

### 5. Amigos y mensajes privados
- **Agregar amigo**, por dos caminos:
  - Un botón **"Agregar amigo"** en la sección de amigos: se escribe el nombre exacto y se manda la solicitud. Si no existe: "No hay nadie con ese nombre." No hay buscador ni lista de sugerencias (no se exponen los perfiles de todos).
  - **Clic derecho → Agregar amigo** en Participantes.
- La solicitud **hay que aceptarla**. Le llega al otro en una **campanita** de notificaciones arriba, con un contador, y desde ahí la acepta o la rechaza. Por ahora la campanita es **solo** para solicitudes de amistad.
- **Lista de amigos**: muestra a cada amigo con foto, nombre, insignia si corresponde y lucecita de conectado. Desde ahí se puede eliminar a un amigo (*decisión del redactor*).
- Tocar a un amigo abre un **chat privado** entre los dos:
  - Texto, imágenes y videos cortos, con los mismos límites, el pegado con Ctrl+V, la vista previa y la foto en grande que el chat de grupo.
  - Cada uno puede borrar sus propios mensajes.
  - *Decisión del redactor:* un **puntito o número** al lado del amigo con mensajes sin leer. Los mensajes privados no van a la campanita. Lo leído se guarda en la PC (localStorage), no en el servidor: cada uno usa una sola PC.
  - *Decisión del redactor:* hay una conversación por par de personas. Si uno elimina al otro de amigos, el historial queda guardado pero ninguno puede escribir; si vuelven a ser amigos, sigue la misma conversación.
- Una vez amigos, se ven el perfil, la foto y la presencia entre sí aunque no compartan grupo.
- Dónde vive la sección de amigos en la pantalla (por ejemplo, una entrada "Amigos" en la pantalla de inicio o en la barra lateral): *a cargo del constructor*, siguiendo el mockup.

### 6. Menú del perfil y configuración
- Al tocar tu nombre o tu foto (arriba) se abre un menú con **"Editar perfil"**: cambiar el nombre (respetando la unicidad) y agregar o cambiar la foto. El color y el estado que ya existen se mantienen en esa misma pantalla.
- Una **tuerquita** abre la **Configuración**, una pantalla aparte que reúne:
  - Todo lo que hoy está en "Ajustes de voz": micrófono, salida, GPU y vista previa de la transmisión.
  - **Supresión de ruido** (la de RNNoise que ya existe): **activada por defecto** para todos. *Decisión del redactor:* con esta versión se prende una única vez para todos los que ya tienen la app (la app lleva un día publicada); si después alguien la apaga, se respeta.
  - **Ganancia del micrófono** en dB: una barra para subir o bajar **cómo escuchan los demás tu voz**, por ejemplo de −20 a +20 dB, con 0 por defecto. Se guarda en la PC de cada uno. *Decisión del redactor:* se aplica después de la supresión de ruido, en lo que se envía.
- *Decisión del redactor:* el botón "Ajustes" de los controles de voz abre esta misma Configuración. El botón "Supresión de ruido" de los controles de voz puede quedar como acceso rápido o irse: *a cargo del constructor*.

### 7. Cartel de actualización
- Al abrir la app, si hay una versión nueva, aparece un cartel en el centro: **"Actualizando Thunderop a la versión X…"** con una barra de progreso de la descarga. **No deja entrar** hasta terminar (decisión del dueño, como Discord o Steam). Al terminar, la app se reinicia sola con la versión nueva.
- Si no hay actualización, no aparece nada. *Decisión del redactor:* si falla la consulta o la descarga (sin internet, servidor caído), se avisa en el cartel y se deja entrar igual, para que un error del servidor de descargas no deje a nadie afuera.

### 8. Pantalla principal (portada)
- Reemplaza la pantalla "Mis grupos" actual. El dueño eligió el boceto **B · Portada con saludo** (`.superpowers/brainstorm/…/content/inicio.html`). No tiene que parecerse a Discord: funcional y amigable para todo público.
- Arriba, una barra con el logo, la **campanita**, la **tuerquita** y tu foto con tu nombre (que abre el menú del perfil).
- Un saludo: **"¡Hola, {nombre}!"**, con cuántos amigos hay conectados y la versión de la app.
- **Mis grupos**: tarjetas grandes en fila, cada una con la **foto del grupo**, el nombre y un dato breve (cuántos están en voz o cuántos participantes hay). La última tarjeta es **"+"** para crear un grupo o unirse con un código. Al tocar una tarjeta se entra al grupo como hoy.
  - Los grupos pasan a tener **foto**. *Decisión del redactor:* la elige y cambia el dueño del grupo; si no hay, se muestra un degradé con la inicial.
- **Novedades**: la lista de cambios de la app por versión, con etiquetas como **NUEVO** y **ARREGLO** ("Se agregó…", "Se arregló el error que hacía que…"). *Decisión del redactor:* viajan dentro de la app (un archivo que se completa en cada release), no desde el servidor; se muestran las últimas versiones y se puede ver el historial completo.
- **Amigos**: la lista de amigos con su lucecita, el botón "Agregar amigo" y, al tocar a un amigo, su chat privado. Esta es la sección de amigos de la parte 5.

### 9. Recordar la cuenta en el login
- Pedido del dueño: no tener que escribir email y contraseña cada vez.
- Casilla **"Recordar mi cuenta"**, tildada por defecto: la sesión queda abierta al cerrar y reabrir la app, y el email queda precargado. Destildada, la sesión dura hasta cerrar la app.
- *Decisión del redactor:* nunca se guarda la contraseña; se guarda la sesión (token), que se renueva sola en cada arranque y dura 30 días sin abrir la app.

## No objetivos (por ahora)
- Llamadas de voz o pantalla compartida por privado.
- Notificaciones en la campanita de otras cosas (mensajes, menciones).
- Notificaciones de Windows o sonidos de aviso.
- Bloquear usuarios, estados de "ausente" o "no molestar".
- Noise gate con umbral (el dueño eligió quedarse con la supresión de ruido).
- El rediseño visual completo del kit (VoiceDock, íconos, móvil): sigue pendiente aparte.

## Anti-objetivos
- Que cualquiera pueda listar o buscar a todos los usuarios: solo se encuentra a alguien escribiendo su nombre exacto.
- Que alguien pueda darse la insignia de fundador a sí mismo.
- Que un chat privado lo pueda leer alguien que no sea uno de los dos.
- Romper lo que ya anda: voz, transmisión, chat de grupo, actualizador.

## Restricciones
- Stack existente: Tauri 2 + SvelteKit (Svelte 5) en `app/`, PocketBase con migraciones y hooks JS en `server/`. Seguir sus convenciones (código y comentarios en español, archivos chicos).
- Servidor en la PC del dueño (WSL), con poco tráfico; nada que necesite servicios pagos.
- Se publica como actualización (`npm run release`, subir versión en `tauri.conf.json`); las migraciones nuevas tienen que aplicarse solas al reiniciar PocketBase en el servidor existente sin perder datos.
- El dueño cuida los tokens: nada de tests end-to-end ni verificación en el navegador salvo que lo pida. Los chequeos unitarios mínimos sí.
