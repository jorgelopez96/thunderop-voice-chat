# Cámara: vista previa antes de compartir + fondo difuminado

## Por qué
Hoy el botón de la cámara la manda al aire de una. Si se toca sin querer, o uno no está listo, los demás ya lo ven.
Se quiere ver primero cómo se ve y qué se ve, y poder difuminar el fondo (como Meet, Zoom o Discord) antes de compartir.

## Qué hace
- Tocar "Prender la cámara" abre una ventana con la vista previa. Solo la ve uno mismo ("Solo vos ves esto").
- En la ventana: selector de cámara (si hay más de una) y fondo **Sin efecto / Suave / Fuerte**.
- "Compartir cámara" la manda a la llamada. "Cancelar", Esc o cerrar la ventana apagan la cámara y nadie vio nada.
- Enter = compartir.
- La vista previa se ve espejada, como en un espejo. Lo que se manda no va espejado.
- El fondo elegido se guarda en las preferencias y la próxima vez arranca con ese.
- Con la cámara ya compartida, en "Más" se puede cambiar el fondo sin apagarla.
- "Pantalla + cámara" sigue prendiendo la cámara sin vista previa (ya se eligió a propósito), con el fondo guardado.
- Apagar la cámara sigue siendo inmediato.
- Mientras carga el efecto de fondo se ve "Preparando el fondo…". Si el equipo o navegador no lo soporta
  (posible en iPhone), las opciones de fondo aparecen deshabilitadas con una leyenda y la vista previa anda igual.

## No entra
- Fondos de imagen o de color (se descartó, no interesa por ahora).
- Cámara trasera en el celular: va en el paso siguiente, con un botón en esta misma ventana.

## Enfoques
1. **Elegido: la vista previa es la misma cámara que se comparte.** Se crea la pista local con
   `createLocalVideoTrack` y el procesador de fondo, se muestra en la ventana y "Compartir" la publica con
   `publishTrack` (simulcast 360p/720p como hoy). Pasa sin cortes ni reabrir la cámara.
2. Abrir la cámara para la vista previa, cerrarla y reabrirla con `setCameraEnabled` como hoy: corte negro,
   la luz de la cámara parpadea y el fondo tarda en aplicarse.
3. Efecto propio con MediaPipe + canvas: más control del borde, mucho más código. Solo si el oficial se ve mal.

## Cómo
- `@livekit/track-processors` (0.8.x, `BackgroundBlur` / `supportsBackgroundProcessors`). Suave ≈ radio 10, fuerte ≈ 25.
- Los archivos del modelo (wasm + .tflite) se sirven desde la app, no desde un CDN externo.
- `alternarCamara` se parte en abrir vista previa / compartir / apagar. Cambiar el fondo en vivo usa
  `setProcessor` / `stopProcessor` sobre la pista publicada.
- Nuevo componente `CamaraPrevia.svelte` (un `<dialog>` como los del Dock).
- Pruebas: e2e con la cámara falsa de Playwright (abre previa, cancela sin publicar, comparte y publica, fondo guardado).

## A criterio de quien lo arme
Radios exactos del difuminado, textos finales, diseño de la ventana siguiendo el estilo actual.
