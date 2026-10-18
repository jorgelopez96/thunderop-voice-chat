# Resultado — prueba técnica de pantalla compartida

Plan: `docs/plans/2026-10-18-plan-1-prueba-pantalla.md`. PC de prueba: Windows 11, RTX 3060 (driver 610.88), WebView2 155, Tauri 2.12, livekit-client 2.23, LiveKit server 1.13.10.

## Veredicto

**Seguir con WebView2 (Tauri), sin módulo nativo**, siempre que la app fuerce H.264 **Baseline** en el codificador local (ver "Causa raíz"). Con eso, la app transmite 1080p a ~56–58 fps codificando con NVENC, y un espectador en otro dispositivo (celular, red local) lo ve fluido y nítido a 16 Mbps.

El criterio "<~10% de pérdida de FPS" está **cumplido de forma cualitativa, no medido con números**: el usuario jugó Valorant (~400 fps) transmitiendo y no notó una caída apreciable. Hay que repetir la medición con números (promedio de FPS en la misma escena) en la etapa 4.

## Causa raíz del códec por software

| Perfil H.264 negociado | Codificador que elige WebView2/Chromium |
|---|---|
| `42e01f` Constrained Baseline (el que negocia LiveKit por defecto) | **OpenH264 (CPU)** |
| `42001f` Baseline | **MediaFoundation / NVIDIA H.264 Encoder MFT (GPU)** |

Se aisló con un loopback RTCPeerConnection dentro de la app: `contentHint`, `degradationPreference` y `maxFramerate` no cambian nada; solo el perfil.

- LiveKit server **no** acepta `42001f` en `room.enabled_codecs`: cae a VP8 (también por software, `libvpx`).
- **Arreglo usado:** reescribir el perfil en la **respuesta remota** (`42e0xx → 4200xx`) del lado del cliente (`spikes/pantalla/src/sdp.ts`, con tests). El servidor y los espectadores siguen viendo `42e01f` y decodifican sin problema: un espectador automático mostró 1920×1080 a 57–58 fps con 0 cuadros descartados.
- VP8, VP9 y AV1 no tienen codificación por hardware en este equipo (`powerEfficient: false`; la RTX 3060 no codifica AV1).

## Mediciones

| Caso | Codificador | Captura → enviados | ms por cuadro | Notas |
|---|---|---|---|---|
| 1080p60, 8 Mbps, GPU | NVENC (hardware) | 57 → 56 fps | 7,5 | sin limitación; QP ~34 (borroso en movimiento brusco) |
| 1080p60, 8 Mbps, sin GPU | OpenH264 (software) | 57 → 48 fps | 20,5 | descarta ~10 cuadros/s; CPU total ~49% |
| 1080p60, 16 Mbps, GPU | NVENC | — | — | **celular: fluido, sin pérdida de detalle** (observación del usuario) |

- **Bitrate:** a 8 Mbps la imagen se borronea en movimientos bruscos de Valorant; a 16 Mbps se ve bien. Conviene un default de 1080p60 a 12–16 Mbps, ajustable. Cada espectador necesita esa misma bajada.
- **Espectador en la misma PC que el juego:** no sirve para juzgar la fluidez. Chrome compite por la GPU con el juego a 400 fps y dibuja con saltos aunque reciba ~57 fps. Hay que juzgar desde otro dispositivo.
- **RAM** (modo dev, compilación debug + Vite + depuración remota, conectado y sin transmitir): árbol de la app = 8 procesos, **525 MB privados**. Discord abierto en el mismo momento: 6 procesos, 867 MB. Medición indicativa; una compilación release va a dar otro número. Hay que repetirla en la etapa 4.

## Limitaciones y hallazgos para las etapas siguientes

1. **El selector de pantalla de WebView2 se dibuja dentro de la ventana de la app** y en ventanas chicas queda cortado o pasa inadvertido (WebView2Feedback #2184, #5173). La app real necesita un tamaño mínimo de ventana (≥1280×800 funcionó).
2. **Audio del sistema:** al activar "Compartir con audio del sistema" apareció `NotReadableError: Could not start audio source`. Sin resolver; queda para la etapa 4 (alternativa: capturar el audio con un módulo nativo, es decir, loopback WASAPI).
3. **Bug abierto de WebView2 #5763** (Tauri 2.12 + WebView2 155): posible bloqueo al cerrar el selector si el capturador está dibujando una ventana de la propia app. Raro, pero hay que tenerlo presente.
4. **Seguridad del servidor de tokens:** el emisor de tokens no puede quedar abierto. En la prueba se resolvió con lista de orígenes, secreto aleatorio y PIN para la red local. La app real (etapa 2) emite tokens desde PocketBase con usuarios autenticados.
5. **No medido:** internet real (NAT/TURN, subida y bajada de amigos), 720p30, 4–8 espectadores simultáneos, y FPS de Valorant con números. Va a la etapa 6 (despliegue) y a la etapa 4.
