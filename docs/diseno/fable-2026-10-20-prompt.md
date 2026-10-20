# Prompt de diseño de Fable (2026-10-20)

Respuesta de Fable al pedido de diseño. Las imágenes de referencia van en esta misma carpeta.

---

Sos el desarrollador frontend senior de Thunderop, una app de escritorio tipo Discord hecha con Tauri 2 + SvelteKit (Svelte 5, runes), LiveKit self-hosted y PocketBase. Es privada, gratuita y para un grupo chico (4–6 personas por sala, 10 máximo). Te adjunto imágenes de referencia del diseño final: portada de escritorio, portada en estado vacío, portada móvil, panel de participantes y la sala de voz. Son la referencia visual obligatoria: reproducí la jerarquía, tamaños, espaciados y colores que ves ahí. No inventes otra estética ni "mejores" el diseño por tu cuenta.

## Principios no negociables
- Liviana: no puede pesar ni consumir como Discord.
- Nada recargado: sin glows, banners, efectos ni decoraciones.
- Gratis siempre, sin funciones pagas.

## Sistema de diseño (tokens CSS en src/shared/styles; nunca hardcodear valores en componentes)
- Fondo: #0E0F14. Superficies: #161821. Superficie elevada (menús, popovers): #1C1E29. Escenario de video: #0A0B10.
- Texto: #E8E9F0. Texto secundario: #9BA0B4. Íconos neutros: #B4B8C8. Texto apagado: #6B7084.
- Bordes: 1px rgba(255,255,255,0.08). Punteado (vacíos y "+"): rgba(255,255,255,0.16). Hover de filas: rgba(255,255,255,0.06).
- Acento único: violeta #8B7CF6. Se usa en botones primarios, links, selección (fondo al 14 %), insignia de fundador y contadores de no leídos. Chip NUEVO: violeta al 16 % con texto #B9B0FF.
- Verde #5BC77A: solo presencia online, "hablando" (anillo de 2 px alrededor del avatar), "N en voz" y "EN VIVO".
- Rojo #E25C6F: solo estados apagados (mic/sonido off) y acciones destructivas (Expulsar, Salir).
- Corona de dueño: #C9A85B. Cian #4FB8D8 solo en el ícono de Pantalla y magenta #C96FC9 solo en el ícono de Sonidos; nunca fuera de esos botones.
- Avatares sin foto: color derivado del hash del nombre, saturación ~45 %, luminosidad ~40 %. Degradé de tarjeta de grupo: el mismo tono de 35 % a 25 % de luminosidad, un solo color.
- Tipografía: Inter. Escala: 11 (chips), 12 (títulos de sección en mayúsculas con tracking 0.06em, texto de estado), 13, 14 (base), 15/16 (nombres de tarjeta), 20 (título de sala), 28 (saludo).
- Espaciado base 4: usar solo 4, 8, 12, 16, 24, 32, 40.
- Radios: 6 botones/inputs/filas, 8 menús, 10 tarjetas y paneles, 999 avatares y píldoras.
- Íconos: lucide-svelte con import granular por ícono, trazo 1.75, 16 px en texto y 20 px en botones del dock.
- Prohibido: box-shadow con blur, glows, backdrop-filter, degradados de dos colores, emojis en la UI, animaciones permanentes. Transiciones solo de opacity y transform, 120–200 ms. Nada animado mientras no pasa nada.

## Reglas de estado y de insignias (aplican en toda la app)
- Presencia: siempre un punto en el avatar (verde online, gris #6B7084 offline). Nunca en texto.
- Debajo del nombre solo va el texto de estado personalizado del usuario, si existe. No mezclar "En línea" / "Conectado" con el texto de estado.
- Orden fijo al lado del nombre: nombre → insignia de fundador (rayo violeta, 14 px) → corona de dueño (14 px). Máximo dos insignias. En el chat, la insignia va una sola vez por bloque de mensajes del mismo autor.
- Íconos de estado de voz a la derecha del todo, en orden fijo: mic apagado, sonido apagado, compartiendo pantalla.
- Desconectados al 45–50 % de opacidad.

## Qué implementar

1. Tokens globales, tipografía y componentes compartidos en src/shared: Avatar (tamaño, presencia, anillo de habla, mini insignia de estado superpuesta), Badge (fundador / dueño), Chip (NUEVO / ARREGLO), Button (primario / outline / ghost / icon), ContextMenu, Panel.

2. Portada (ruta principal al entrar; reemplaza la vieja "Mis grupos"):
   - Barra superior de 48 px: logo THUNDEROP violeta a la izquierda; a la derecha campanita con contador rojo, tuerquita (abre Configuración) y avatar + nombre (abre el menú "Editar perfil"). Íconos sueltos, sin fondos cuadrados.
   - Contenido en columna central de máximo 960 px, padding 32, gap 40 entre secciones.
   - Saludo como texto directo (no tarjeta): "¡Hola, {nombre}!" a 28 px; subtítulo a 14 px gris: si hay amigos en voz "tetu y mamanis están en voz en Mamanis" (nombres en verde); si no, "N amigos conectados · vX.Y.Z"; si no tiene amigos, "Thunderop vX.Y.Z".
   - "Mis grupos": tarjetas 220×128, radio 10, 64 px de imagen o degradé arriba y texto abajo. Dato: "N en voz" en verde con punto y hasta 3 avatares apilados (22 px, −8 px de solape) si hay gente en voz; si no, "N participantes" en gris. Punto violeta de 8 px si hay mensajes sin leer. Última tarjeta "+" punteada: "Crear o unirme". Orden: primero las que tienen gente en voz, después por último mensaje. Más de 4: fila con scroll horizontal y flechas al hover.
   - "Novedades" (60 %) y "Amigos" (40 %) en dos columnas, gap 32; en ventanas < 800 px todo en una columna.
   - Novedades: tarjeta con encabezado "vX.Y.Z · fecha", filas de 36 px con chip NUEVO (violeta) o ARREGLO (gris, no rojo), versiones anteriores colapsadas con "N cambios", link "Ver historial". Punto violeta al lado del título hasta que se abre después de actualizar.
   - Amigos: botón outline "Agregar amigo" arriba a la derecha del título; filas de 44 px con avatar 28 px + presencia, nombre, y a la derecha "En voz · Grupo" en verde o contador violeta de no leídos; desconectados al 50 %. Clic abre el chat privado.
   - Estados vacíos como en la imagen: sin grupos, una tarjeta ancha punteada con "Crear mi grupo" (primario) y "Unirme con código" (outline); sin amigos, texto explicativo + botón "Agregar amigo".

3. Panel de Participantes del grupo (260 px): título "Participantes — N", conectados arriba, separador de 1 px, desconectados al 45 %. Fila de 40 px: avatar 32 px con presencia y anillo verde si habla; nombre; insignias en orden fijo; texto de estado a 12 px debajo; íconos de estado a la derecha. Sin buscador. Menú contextual con clic derecho: Ver perfil, Agregar amigo, Volumen · N %; para el dueño, separador y "Expulsar del grupo" en rojo. En la sala de voz se abre como overlay desde el botón "Participantes · N" del header.

4. Sala de voz (según la imagen):
   - Sidebar izquierdo de 232 px: "Nombre del grupo ⌄" (selector), sección "Salas de voz" primero: la sala activa es una tarjeta con fondo violeta al 12 % que muestra nombre, "N en voz" en verde y los avatares de quienes están adentro; las demás muestran "vacía" en gris. Después sección "Chats" (canales de texto) con contador violeta de no leídos. "Invitar al grupo" como botón outline al fondo.
   - Header: título de la sala a 20 px, nombre del grupo en gris, botón "Participantes · N" y copiar link.
   - Franja horizontal de participantes: píldoras de 40 px con avatar 30 px, nombre, insignias y estado (anillo verde al hablar, mic tachado rojo, texto "EN VIVO" verde y borde verde al 40 % para quien transmite). Con flex-wrap.
   - Escenario: solo existe cuando alguien transmite. Fondo #0A0B10, etiqueta "Nombre · 1080p 60" arriba a la izquierda, volumen y pantalla completa abajo a la derecha. Si transmiten dos, dos escenarios en grilla. Sin transmisión, la franja de participantes crece a tarjetas de 112 px con avatar de 44 px.
   - Barra "Ahora suena" de 52 px arriba del dock, solo si hay música: ícono, título, "la puso X · N en cola", barra de progreso violeta de 3 px, tiempo, pausar y saltar (para todos) y volumen personal de música.
   - Chat de la sala a la derecha (320 px, plegable): cada sala de voz tiene su propio hilo con texto, imágenes y videos; mensajes agrupados por autor con hora a 11 px; input de 40 px con botón de adjuntar.
   - Dock inferior unificado de 56 px, fondo #161821: izquierda avatar con anillo de habla + nombre + "Sala · Grupo"; centro Mic y Sonido con medio botón chevron para elegir dispositivo, separador, Pantalla, Sonidos, Música; derecha "Salir" outline rojo. Estados de botón: normal (ícono #B4B8C8 o su color de función, sin fondo), activo (fondo violeta 14 %, ícono blanco; Pantalla usa verde 14 % cuando transmitís), apagado (fondo rojo 14 %, ícono rojo tachado; solo Mic y Sonido), deshabilitado (40 %). Tooltips con atajos.
   - Entrar a una sala: un clic en el sidebar, sonido corto de join, la vista cambia sola a la sala. Salir: solo desde el dock, sin confirmación.

5. Móvil (preparar, no implementar todavía): tratar sidebar, contenido y paneles como rutas independientes que en escritorio se renderizan juntas; ningún componente debe asumir que el sidebar está visible; todo lo tocable ≥ 44 px.

## Reglas de arquitectura (obligatorias)
- Todo dentro de src/, organizado por categoría + feature: src/<categoria>/<feature>/ (hooks, components, features, services, shared) con index.ts(x) como API pública, types.ts aparte (nunca types en el index), constants.ts si aplica. Desde afuera se importa solo por el index; sin imports profundos.
- Hooks/stores como carpeta (useX/index.ts), nunca archivos sueltos. Prohibido helpers.ts y cajones de sastre; cada archivo con un propósito único.
- Ningún archivo supera 120 líneas; si pasa, extraer responsabilidades.
- shared no depende de features; features sí de shared. Sin imports circulares.
- Sin prop drilling: composición (snippets/children), contexto acotado por feature o store cuando corresponda. Sin GlobalContext gigante.
- Estados loading / error / empty explícitos. No silenciar errores.
- Nunca eslint-disable ni @ts-ignore: se corrige el código.
- Performance primero: imports granulares, sin recomputos ni renders innecesarios, memoizar solo con valor real, lazy-load de rutas pesadas, nada pesado en el main thread.
- Early returns y ternarios simples; sin ternarios anidados; extraer condiciones a variables descriptivas.
- Tests para la lógica crítica: subtítulo del saludo, orden de grupos y participantes, color por hash, estados del dock.

## Cómo trabajar
Empezá mostrando el árbol de archivos propuesto y los tokens. Después implementá en este orden: tokens y shared → dock de voz → sala de voz → panel de participantes → portada. Antes de entregar cada bloque, repasá el checklist: filesystem + API pública + <120 líneas + sin prop drilling + dependencias correctas + performance + sin skips de linter + ternarios/early returns claros. Si rompés alguna regla, justificalo en una línea y proponé alternativa. Si algo de las imágenes es ambiguo, preguntá antes de inventar.
