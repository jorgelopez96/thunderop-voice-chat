# Thunderop en el navegador (versión web)

Fecha: 2026-10-25. Estado: para aprobar (decisiones de navegación, transmitir solo desde PC, mantener apretado, instalable, una sola voz por cuenta e iPhone ya confirmadas por Jorge).

## Para qué y por qué

Thunderop hoy es solo una app de Windows. La versión web es la forma de usarla **sin instalar nada**, para dos casos que pidió Jorge:

- **Desde el celular**, mientras no exista la app de Android (que no se va a hacer todavía).
- **Desde una PC donde no se puede o no conviene instalar la de Windows**: Mac, compu del trabajo, alguien al que el antivirus le bloquea el instalador.

Se entra desde el botón **"Aplicación web"** de thunderop.com, que hoy lleva a una página de "Próximamente".

La regla de Jorge: **tiene que poder hacer lo mismo que en la app de PC y verse igual** (mismo rediseño 0.7, mismos temas de color, modos Básico/Moderno), bien acomodada para el celular.

## Objetivos

1. Todo lo de la app de escritorio funcionando en el navegador: cuenta y login (usuario/contraseña y Google), grupos, salas, chats, privados, menciones, reacciones, GIFs, fotos, música, botonera, notificaciones, voz, mirar transmisiones y **transmitir** pantalla.
2. Mismo aspecto que la app de escritorio. En una PC con navegador se ve prácticamente igual que la app de Windows.
3. Pensada para el celular (≈360–430 px de ancho), con la navegación que eligió Jorge (abajo).
4. Un solo código: la versión web sale del mismo proyecto que la de escritorio (`M:\THUNDEROP\Aplicacion\app`). Un arreglo o mejora sirve para las dos.

## No objetivos

- App nativa de Android o iOS.
- Notificaciones con la pestaña cerrada (push). Con la pestaña abierta, sí (notificaciones del navegador).
- El transmisor nativo, la bandeja del sistema, el actualizador, abrir con Windows y la barra de título propia: son de escritorio y en la web no aparecen.
- Igualar la calidad de transmisión del transmisor nativo: en la web se usa el compartir pantalla del navegador.

## Anti-objetivos (sería un fracaso aunque "funcione")

- **Dos códigos separados** (una carpeta "Aplicacion web" copiada) que se van desincronizando.
- **Romper o empeorar la app de escritorio**: ni funciones, ni rendimiento, ni el diseño 0.7.
- Una web que en el celular se use "achicada", con la vista de PC encogida o con scroll horizontal.
- Que el celular se sienta como un sitio y no como una app (botones chicos, menús que se salen de la pantalla).

## Lo que decidió Jorge

- **Mismo proyecto, no carpeta aparte.**
- **Mismas visuales** que la app de PC.
- **Se puede transmitir desde la web**, aunque sea con el compartir pantalla del navegador (con su cartel y algo menos de calidad).
- **Misma cuenta en PC y celular:** entrar a la voz desde un dispositivo desconecta la voz del otro ("me paso la llamada"). Es lo que ya hace LiveKit con la identidad = id del usuario: sin cambios en el servidor. Conviene que el dispositivo que queda afuera lo diga claro ("Te conectaste desde otro dispositivo") en vez de un error genérico.
- **iPhone también:** dos amigos usan iPhone; tiene que andar en Safari de iOS además de Chrome de Android (con los límites propios de Safari, avisados), y sirve para probarlo.
- **Navegación en el celular: una mezcla** (aprobó el boceto en `.superpowers/brainstorm/749-1792965798/content/celular-mezcla.html`):
  1. **Pantallas de afuera** (Inicio, Grupos, Amigos, Perfil): **pestañas fijas abajo**.
  2. **Adentro de un chat**: el chat ocupa toda la pantalla y las **pestañas se ocultan**. Arriba: ☰, nombre del chat y 👥. El ☰ (o deslizar desde el borde izquierdo) abre un **cajón lateral** con los grupos en una columnita y las salas del grupo elegido al lado. 👥 (o deslizar desde la derecha) abre Participantes.
  3. **En la sala de voz**: las tarjetas de la gente en grilla y, **donde estaban las pestañas, los botones de la llamada** (micrófono, auriculares, música, chat de la sala, colgar).

## Decisiones mías (Jorge puede cambiarlas)

- **Llamada mientras mirás otra pantalla:** si estás en una llamada pero en otro chat o en Inicio, la llamada queda como una **barrita chica abajo** ("General · 3 en voz", silenciar y colgar), arriba de las pestañas o de la caja de mensaje; al tocarla vuelve a la sala.
- **Dónde vive:** en **app.thunderop.com**, publicada en Vercel (gratis, como la página), desde el mismo repo. El botón "Aplicación web" de la página pasa a llevar ahí cuando esté lista (hoy va a `/web`, "Próximamente").
- **Cuándo es "celular":** ancho de pantalla de 768 px o menos. Por encima, el layout de escritorio de siempre (tres columnas).
- **Pantalla Grupos en el celular:** la lista de tus grupos (las mismas tarjetas de Inicio); tocar uno abre su último chat con el cajón disponible.
- **Pantalla Perfil en el celular:** tu perfil (el editor nuevo de la 0.7.1) más el acceso a Configuración, Notificaciones (la campanita) y Cerrar sesión, que en la PC están en la barra de arriba.
- **Avisos de invitación** (`thunderop://invite/...`) siguen funcionando dentro de los chats con el botón "Unirme al grupo".
- **Todo lo tocable de 44 px o más** en el celular.
- **Transmitir es solo desde un navegador de PC.** Los navegadores de celular (Chrome de Android, Safari de iOS) no permiten compartir pantalla: ahí el botón de transmitir no aparece. Mirar transmisiones sí, en todos lados.
- **Lo que en la PC es pasar el mouse, clic derecho o arrastrar**, en el celular se hace **manteniendo apretado**: abre un menú que sube desde abajo con las mismas opciones (en un mensaje: reaccionar, responder, editar, borrar; en una persona: volumen, ver perfil y lo del dueño; en una sala: cambiar nombre, borrar). Ordenar salas: mantener apretado y arrastrar. Adjuntar archivos: con el clip (no hay soltar archivos).
- **Instalable en la pantalla de inicio** (manifest e ícono): así abre sin la barra del navegador y se siente como una app, respetando el notch. Sigue funcionando igual como pestaña común.

## Cómo funciona cada cosa en el navegador

| Cosa | Escritorio hoy | En la web |
|---|---|---|
| Login con Google | ventana del sistema vía Tauri | el popup normal de PocketBase (como ya hace thunderop.com) |
| Voz (LiveKit, supresión de ruido, ganancia) | WebView2 | igual: es WebRTC y AudioWorklet del navegador |
| Transmitir | transmisor nativo (Rust) | `getDisplayMedia` del navegador, con las calidades 720p/1080p y 30/60 fps que el navegador permita. Audio: el de una pestaña o del sistema si el navegador lo ofrece (Chrome sí); no el de un juego en particular |
| Mirar transmisiones | igual | igual (incluida la pantalla completa) |
| Notificaciones | plugin de Tauri | API de notificaciones del navegador, pidiendo permiso la primera vez |
| Abrir links | navegador del sistema | pestaña nueva |
| Música (YouTube) | iframe | igual |
| Actualizaciones | updater de Tauri + campanita | no hace falta: siempre se carga la última |
| Barra de título | propia (0.7.0) | no hay: la barra de arriba de la app sin los botones de ventana |
| Bandeja / salir de Thunderop | sí | no |

Gran parte de esto ya existe: el código tiene ramas `isTauri()` y en el navegador muchas cosas ya andan (así se corren los e2e).

## Restricciones

- **Servidor sin cambios grandes.** PocketBase ya acepta pedidos de otros orígenes (CORS `*`). LiveKit tiene que ser accesible por `wss://` desde una página https (verificar; si hoy solo anda por la red local o sin TLS, hay que sumarlo en Caddy).
- **El celular suspende el audio al bloquear la pantalla o cambiar de app** (sobre todo iPhone/Safari). Es un límite del navegador: la llamada puede cortarse o quedar muda. Hay que avisarlo con un cartel claro y probar en Android con Chrome y en iPhone con Safari.
- **Rendimiento:** el modo Básico/Moderno se respeta igual. En el celular, por defecto Básico.
- Sin librerías nuevas pesadas; seguir las reglas del rediseño (`C:\Users\jorgl\Downloads\prompt-claude-code-thunderop.md`).
- Sin tests nuevos salvo los que haga falta arreglar o los del cambio de servidor, si lo hubiera.

## Qué queda para quien lo construya

- Cómo separar la compilación web de la de escritorio (variable de entorno, script `build:web`, proyecto aparte en Vercel apuntando a `app/`).
- La CSP y la URL de PocketBase/LiveKit para la web.
- Cómo se implementan el cajón (deslizar con el dedo) y las pestañas, mientras se vean y se comporten como en el boceto.
- Qué hace la página de thunderop.com con `/web` cuando la app esté publicada (redirigir o enlazar directo).
- El orden de trabajo, de a una parte por vez con el OK de Jorge, como en el rediseño.
