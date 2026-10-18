# App de voz para amigos — Diseño inicial

Nombre de trabajo: "Discord mejorado". El nombre final queda pendiente. No se puede usar "Discord" ni su marca en el producto publicado.

## Intención

Una app privada para que un grupo de amigos hable por voz, chatee, comparta pantalla y escuche música juntos, **sin depender de Discord ni de sus funciones pagas**. El problema que resuelve:

- Discord consume mucha RAM y GPU, y **baja los FPS de los juegos al compartir pantalla**, que es algo que el grupo hace seguido (mostrar un juego, ver un video o una película juntos).
- Transmitir en buena calidad (1080p / 60 fps) en Discord requiere pagar Nitro.
- Los bots de música (Jockie, musicobot) son incómodos de configurar.

Éxito = el grupo la usa en lugar de Discord porque pesa mucho menos, transmite mejor y no cobra nada.

## Escala

Uso real: 4 personas normalmente, 5 o 6 a veces y 8 a 10 como máximo absoluto por sala. Se transmite pantalla de a 1 o 2 personas a la vez, nunca todos. No es un producto masivo.

## Objetivos (primera versión)

### Cuentas y perfil
- Registro y login con cuenta propia (usuario + contraseña). El registro es abierto dentro de la app, pero la app solo se distribuye desde una página web que el usuario comparte en privado con sus amigos. **Decisión del usuario:** no hace falta protección pesada contra abuso (CAPTCHA, moderación de denuncias). *Decisión del redactor:* igual se activan los límites de frecuencia que trae PocketBase y un tope de espacio por grupo, porque es barato y protege el disco gratuito.
- Perfil personalizable pero simple: nombre visible, foto de perfil y, como mucho, un color o un texto corto de estado. *Decisión del redactor:* nada de banners animados, marcos, efectos ni decoraciones.

### Grupos
- Cada usuario puede **crear 1 solo grupo** y **unirse a los que quiera**.
- Se entra a un grupo por **link o código de invitación**. Cualquier miembro puede generar y compartir invitaciones.
- El **creador del grupo** puede: echar miembros, silenciar miembros (en voz), borrar mensajes de cualquiera y crear, renombrar o borrar salas.
- Los demás miembros pueden chatear, hablar, compartir pantalla, manejar la música, usar la botonera e invitar.

### Salas
- Los "canales" se llaman **salas**. Hay **salas de voz** y **salas de chat**. *Decisión del redactor:* la UI las nombra "Sala de voz" y "Sala de chat".

### Chat
- Mensajes de texto, **imágenes** y **videos cortos**. *Decisión del redactor:* la palabra "mensajes" en el pedido se interpreta como texto + imágenes.
- **No** se pueden enviar archivos genéricos por ahora.
- Límites de tamaño o duración de video: *a cargo del constructor*, con valores razonables para el almacenamiento gratuito (por ejemplo, video de 60 s / 25 MB como máximo).
- El creador del grupo puede borrar cualquier mensaje; cada uno puede borrar los suyos.

### Voz
- Elegir dispositivo de **entrada** (micrófono) y de **salida** (auriculares/parlantes).
- **Micrófono siempre abierto**: sin detección de actividad ni umbral de sensibilidad. Se escucha siempre, de forma clara. Con un botón para silenciarse uno mismo.
- **Supresión de ruido** (equivalente a Krisp): un único interruptor de activar/desactivar, sin más filtros ni ajustes. Tiene que ser liviana.
- Volumen individual por persona. *Decisión del redactor:* es estándar y barato.

### Compartir pantalla
- **Todos** pueden transmitir, sin pago: 720p o 1080p, a 30 o 60 fps, a elección de quien transmite.
- Requisito central: **impactar lo mínimo posible en los FPS del juego** de quien transmite. Hay que usar el codificador por hardware de la GPU (NVENC / AMF / QuickSync) siempre que esté disponible.
- **El sonido de lo que se transmite (juego o video) se comparte automáticamente, como en Discord**, sin que el usuario active nada en el selector. Solo el audio de lo compartido: no las voces de la sala. **Decisión del usuario (2026-10-18).** La prueba técnica mostró que el motor web solo ofrece el audio de todo el sistema y con un interruptor manual, y que falló de forma intermitente (`NotReadableError`). Lo esperable es un módulo nativo de captura de audio por proceso (WASAPI process loopback) dentro de Tauri.

### Botonera de sonidos
- Cada grupo tiene su botonera. Los miembros suben sonidos de **hasta 10 segundos**.
- Al apretar un sonido estando en una sala de voz, lo escuchan todos los de la sala.

### Música (YouTube sincronizado)
- Cada sala de voz tiene una **cola de reproducción compartida**. Cualquiera pega un link de YouTube y la canción se agrega al final.
- Todos escuchan **la misma canción en el mismo segundo**. Quien entra a mitad de una canción se engancha en el punto donde va.
- Cuando termina una canción, arranca sola la siguiente.
- **Cualquier miembro de la sala** puede pausar, reanudar, saltar y quitar canciones de la cola.
- Cada uno ajusta el volumen de la música aparte del de las voces. *Decisión del redactor.*
- Se usa el **reproductor oficial de YouTube** (embed) en cada cliente, coordinado por el servidor. **No** se descarga ni se retransmite audio: eso viola las condiciones de YouTube y es frágil.
- El costo de rendimiento tiene que ser bajo: el reproductor solo existe mientras hay música en la cola.

## No-objetivos (por ahora)
- Spotify: descartado por el usuario.
- Envío de archivos genéricos.
- Android, iOS y la página web de descarga: vienen después. Esta versión es **Windows primero**, y el mismo código debería poder servir como versión web.
- Suscripciones, Nitro, mejoras de servidor o cualquier cosa paga.
- Filtros de audio aparte de la supresión de ruido.
- Bots.
- Escalar a miles de usuarios.

## Anti-objetivos (fracaso aunque funcione)
- Que la app de Windows pese o consuma parecido a Discord.
- Que compartir pantalla baje notablemente los FPS del juego.
- Que haga falta pagar algo para usarla en esta etapa.
- Quedar atado a un proveedor de hosting sin poder mudarse.
- Un perfil o una interfaz recargados de efectos visuales.

## Restricciones
- **Costo cero** de hosting en esta etapa, usando servicios gratuitos que funcionen bien.
- Tiene que poder **mudarse a un servidor pago** más adelante sin reescribir nada: copiar datos y cambiar direcciones o configuración.
- Windows 10/11 como plataforma principal.

## Decisiones técnicas (tomadas por el redactor; el usuario delegó y puede cambiarlas)
- **Cliente de escritorio: Tauri** (usa WebView2, que ya viene en Windows) con un frontend web. Es mucho más liviano que Electron, que es lo que usa Discord, y el mismo frontend sirve como versión web.
- **Voz, video y pantalla: LiveKit** (SFU de código abierto, self-hosted). Es necesario un SFU, porque una conexión directa entre PCs obligaría a subir la pantalla una vez por cada espectador.
- **Backend: PocketBase** (un solo binario con autenticación, base de datos SQLite, tiempo real y almacenamiento de archivos). Ahí van cuentas, grupos, salas, mensajes, invitaciones, botonera, cola de música y estado de reproducción.
- **Supresión de ruido: RNNoise** (gratis, liviano) en el cliente.
- **Hosting: Oracle Cloud "Always Free"** (VM ARM). LiveKit y PocketBase corren ahí, con un dominio o subdominio gratuito y TLS (por ejemplo, con Caddy). Antes de usarlo hay que verificar las condiciones actuales de Oracle: política de reclamo de instancias inactivas, disponibilidad de ARM por región y requisito de tarjeta.
  - Las cuentas de Oracle y, si hace falta, del dominio las crea y las administra el usuario, con una guía paso a paso del constructor.
  - **Plan B (decisión del usuario):** si Oracle no se puede usar, más adelante se paga un VPS chico (~5 USD/mes). Por ahora se intenta solo la opción gratuita. Si Oracle falla, se frena y se le avisa al usuario.
- Para la mudanza, todo se configura por variables o archivo de configuración (URLs, claves). Los datos son la carpeta de PocketBase.

## A cargo del constructor
- Estructura del proyecto, librerías de UI y diseño visual (dentro del anti-objetivo de "nada recargado").
- Cómo sincronizar la música (por ejemplo, estado en PocketBase con canción, momento de inicio y estado de pausa, y cada cliente calcula su posición).
- Cómo se reproduce la botonera para todos (por ejemplo, un evento que hace que cada cliente reproduzca el archivo localmente).
- Límites concretos de tamaño de imágenes y videos.
- **Primero, una prueba técnica (spike) de compartir pantalla**, antes de construir el resto: verificar lo que WebView2 permite en la práctica (captura de pantalla y ventana, audio del sistema, codificación por hardware, permisos de micrófono). *Decisión del redactor:* si WebView2 no alcanza, se agrega un módulo nativo dentro de la misma app Tauri, que captura con Windows Graphics Capture, codifica con la GPU y publica con el SDK de LiveKit para Rust. Tauri no se reemplaza. Criterio de aprobación: una pérdida de FPS del juego de menos de ~10% al transmitir en 1080p60 con codificador por hardware.
- La versión web **no entra en la primera versión**; solo se cuida que el código no la impida. *Decisión del redactor.*
- Sincronización de YouTube: cada cliente puede recibir publicidad distinta. Al terminar el anuncio, se vuelve a sincronizar con la posición compartida. Las canciones que no se pueden reproducir embebidas se saltan solas y se muestra un aviso en la cola. Si el embed no funciona desde el origen local de Tauri, se sirve desde un origen http(s). *Decisión del redactor.*
- Medir el consumo real (RAM, CPU, GPU e impacto en FPS al transmitir) contra Discord, como verificación de los anti-objetivos.
