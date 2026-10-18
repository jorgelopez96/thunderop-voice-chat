# Resultado — YouTube embebido en Tauri

Plan: `docs/plans/2026-10-18-plan-5-botonera-musica.md` (Task 1). PC de prueba: Windows 11, Tauri 2.12, wry 0.57, WebView2.

## Veredicto

**Camino A: IFrame API de YouTube directo en la app.** No hace falta la página puente en `pb_public` (plan B).

El reproductor llegó a `PLAYING` (estado 1) y `getCurrentTime()` avanzó ~1 s por segundo en los dos orígenes:

| Origen | Resultado |
|---|---|
| `tauri dev` (`http://localhost:<puerto>`) | `PLAYING`, 0 → 8,5 s en 10 s, `isMuted() = true`, sin violaciones de CSP |
| Release (`http://tauri.localhost`) con el CSP nuevo | `PLAYING`, 0,08 → 9,08 s en 10 s, `isMuted() = true`, sin violaciones de CSP |
| Release con el CSP anterior | Falla: `script-src-elem` bloquea `https://www.youtube.com/iframe_api` |

No apareció el error 153 (Referer u origen faltante): con `origin` en `playerVars`, YouTube aceptó los dos orígenes.

Videos probados: `M7lc1UVf-VE` (demo oficial de la IFrame API), `dQw4w9WgXcQ`, `kJQP7kiw5Fk` y `RgKAFK5djSk` llegaron a `PLAYING`. Un id inexistente (`xxxxxxxxxxx`) dispara `onError` con **150**. No se probó un video real con embebido deshabilitado; según la documentación, también da 101 o 150, que la Task 5 ya trata como "No se puede reproducir acá".

Todas las pruebas se hicieron silenciadas: `playerVars.mute = 1`, `mute()` en `onReady` y WebView2 con `--mute-audio`.

## CSP

Se agrega lo mismo en `csp` y `devCsp`:

```
script-src 'self' 'wasm-unsafe-eval' https://www.youtube.com; frame-src https://www.youtube.com;
```

- `script-src`: `iframe_api` y el `www-widgetapi.js` que este carga salen de `www.youtube.com`.
- `frame-src`: el iframe `https://www.youtube.com/embed/...`. Si no se declara, `frame-src` cae en `default-src 'self'` y bloquea el iframe.
- No hizo falta abrir `img-src`, `connect-src` ni `media-src`: el video, las miniaturas y los anuncios corren dentro del iframe, que tiene su propio origen.

En `tauri dev`, Tauri no aplica `devCsp` a las páginas que sirve Vite (no llega el header). Por eso **solo el build de release valida el CSP**.

## Navegación (`on_navigation`)

No hubo que tocar `lib.rs`. En Windows, wry engancha `on_navigation` a `NavigationStarting` de `ICoreWebView2`, que solo se dispara para el marco principal. Las navegaciones de iframes pasan por `FrameNavigationStarting`, que no se intercepta.

Comprobado en los dos orígenes:

- El iframe de YouTube carga.
- Navegar la ventana principal a `https://example.com/` sigue cancelado (`ERR_ABORTED`) y la app no se mueve de su URL.

## Limitaciones

- `script-src https://www.youtube.com` habilita cualquier script de ese host, no solo la API. Restringirlo por ruta (`/iframe_api`, `/s/player/`) sería frágil: YouTube cambia esas rutas, y CSP ignora las rutas después de una redirección.
- Los links del reproductor que abren ventanas nuevas ("Ver en YouTube") pasan por `NewWindowRequested`, no por `on_navigation`. Hay que verificar en la Task 5 que no abran una ventana de la app con un origen ajeno.
- Los anuncios de YouTube pueden aparecer. Pausan el `PLAYING`, y la resincronización de la Task 5 lo cubre.
