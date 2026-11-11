# Cámara, modos de transmisión, ensordecido visible y sonidos de otros grupos

Fecha: 2026-11-11. Pedido de Jorge; maqueta aprobada: `.superpowers/brainstorm/443-1794366780/content/camara-modos.html`.

## Por qué

Dos amigos pidieron usar la cámara, desde la PC y desde el navegador. Jorge además la quiere "modo streamer":
transmitir la pantalla con su cámara en un costado, como un stream. Aparte, hoy en la lista de quién está en voz solo se ve
el micrófono tachado: tiene que verse también quién está ensordecido, en todos lados. Y quiere tocar en una llamada los
sonidos que tiene en sus otros grupos.

Más adelante (no ahora): que la app funcione como OBS y transmita a Twitch y otras plataformas.

## 1. Cámara

- **Botón "Cámara"** en el dock de la llamada (al lado de Transmitir). Prendida, tu tarjeta en la llamada muestra tu video
  en vez de la foto (maqueta: tarjeta de Jorge). Anda en la app de PC y en el navegador, también en el celular (cámara de
  adelante). *(Celular y cámara de adelante: idea mía.)*
- Si hay más de una cámara, se elige en **Configuración → Voz** (como el micrófono), y es la misma en el dock y en
  Transmitir. *(Idea mía.)*
- **Calidad: la mejor que dé la cámara** (Jorge: "en la calidad que se pueda según la cámara"), con tope en 1080p a 60 fps.
  Va con simulcast: a quien la ve en una tarjeta chica le llega una versión más liviana, y una tarjeta que no está a la vista
  no baja video (adaptiveStream). *(Tope y simulcast: decisión mía.)*
- Las cámaras de la llamada le llegan solas a todos (como los micrófonos); el ahorro de bajada lo hace lo de arriba.
  *(Decisión mía.)*
- Una tarjeta con video se puede agrandar y poner en pantalla completa como una transmisión.
- Silenciado por un moderador no corta la cámara (igual que hoy no corta la transmisión).

### Modos de transmisión (Jorge eligió la opción A: la cámara viaja aparte)

El cuadro de **Transmitir** suma, antes de lo de siempre (qué pantalla y calidad), el modo:

1. **Pantalla** — como hoy.
2. **Pantalla + cámara** — la pantalla con la cámara en una ventanita encima, como un stream. La cámara viaja como una
   pista aparte y la app de cada uno que mira la dibuja sobre la pantalla.

**"La cámara sola" es el botón Cámara del dock** (Jorge aceptó simplificarlo así): no hay un tercer modo de transmisión.
Es una sola cámara: si está prendida en la tarjeta y se arranca "Pantalla + cámara", es la misma pista, que se ve en la
tarjeta y en la ventanita. En el celular no se puede transmitir pantalla, pero sí prender la cámara.

- **Quien transmite acomoda la ventanita de la cámara donde quiera** (pedido de Jorge): la arrastra sobre la vista previa de
  su transmisión y puede cambiarle el tamaño *(tamaño: idea mía)*. Esa posición y tamaño los ven todos. Por defecto, abajo
  a la derecha, al 25 % del ancho.
- El que mira puede **esconder** la ventanita (✕) solo para él. *(Moverla solo para él: no; manda la de quien transmite.)*
- La pantalla y la cámara siguen siendo la misma transmisión para todo lo demás: el EN VIVO, los espectadores, el sonido de
  la pantalla, "Ver" y dejar de ver.
- Cambiar de modo sin cortar la transmisión no es necesario: se corta y se vuelve a empezar.

## 2. Muteado y ensordecido en todos lados

- Ensordecido se muestra con el **auricular tachado**; muteado, con el micrófono tachado (como hoy). Ensordecido ya implica
  el micrófono apagado: se muestra solo el auricular. *(Idea mía.)*
- Tiene que verse en: la lista de salas (debajo de cada sala de voz), las tarjetas de la llamada, el panel de
  participantes, el inicio ("quién está en voz") y el celular. Jorge: "en todos los lugares tiene que figurar".
- Quien tiene la cámara prendida lleva un iconito de cámara en esas mismas listas.
- Se tiene que ver para los que están en la llamada y también para los que miran desde afuera (la lista de salas de
  alguien que no entró a la voz).

## 3. Sonidos de otros grupos

- La botonera de la llamada suma **pestañas**: primero el grupo de la llamada, después una por cada otro grupo del usuario
  que tenga sonidos.
- Tocar un sonido de otro grupo suena para **todos** los de la llamada, igual que uno propio, aunque no sean miembros de ese
  grupo. No se copia: sigue siendo del otro grupo.
- Lo puede tocar cualquiera (tocar sonidos no pide permiso). En las pestañas de otros grupos no se edita ni se sube nada:
  eso se hace en el grupo de cada sonido, con sus permisos.
- Hoy cada app busca el sonido por id en su propio grupo y descarta los de otro grupo: con esto, el aviso de "sonó" tiene que
  traer lo necesario para que lo pueda reproducir alguien que no es miembro del otro grupo.

## Restricciones

- Las apps viejas (0.8.0 y anteriores) tienen que seguir andando en la misma llamada que una nueva: ignoran lo que no
  conocen (la cámara de otro no la ven, un sonido de otro grupo no les suena) sin romperse ni mostrar errores.
- La cámara no puede saturar el internet: respetar la calidad elegida, igual que la transmisión.
- Todo lo de la PC tiene que andar también en el navegador, salvo lo que el navegador no permita (avisar con un mensaje claro).
- Tests unitarios y e2e (cámara falsa de Chromium: `--use-fake-device-for-media-stream` ya está en la config de Playwright).

## No es parte de esto

- OBS / transmitir a Twitch, YouTube u otras plataformas (para más adelante; ahí se pega la cámara a la imagen, opción B).
- Fondos virtuales, filtros, desenfoque.
- Cambiar de modo sin cortar la transmisión.

## Para quien lo construya

- Cómo se publica la cámara (pista de cámara de LiveKit) y cómo se marca que va con la transmisión, la posición y el tamaño.
- Cómo viaja el estado ensordecido (hoy el servidor arma la presencia de `/api/groups/{id}/voz` desde LiveKit).
- Qué datos lleva el aviso de un sonido de otro grupo para que lo reproduzca un no miembro, sin abrir más de lo necesario.
- Topes razonables de tamaño de la ventanita (sugerido: entre 15 % y 45 % del ancho).
