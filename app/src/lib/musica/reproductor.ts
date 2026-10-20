// Reproductor de YouTube (IFrame API directa, camino A de la Task 1) detrás de una interfaz chica.
// En DEV, con `globalThis.__ytFalso`, se usa uno falso que avanza con el reloj: los E2E no tocan YouTube ni suenan.

/** Estados del reproductor de YouTube que usamos. */
export const FIN = 0, SONANDO = 1, PAUSADO = 2;

export interface Reproductor {
  /** Elige `videoId` desde `desdeS`; se carga con el `play()` (sonando) o `pause()` (parado) que sigue. */
  cargar(videoId: string, desdeS: number): void;
  play(): void;
  pause(): void;
  seek(s: number): void;
  tiempo(): number;
  /** Segundos; 0 mientras no se sabe. */
  duracion(): number;
  /** 0 a 100. */
  volumen(v: number): void;
  destruir(): void;
  onEstado(cb: (estado: number) => void): void;
  /** Códigos de la IFrame API (2, 5, 100, 101, 150); -1 si no se pudo cargar la API. */
  onError(cb: (codigo: number) => void): void;
}

/** Ajustes del falso: `duracion` en segundos (30 por defecto) y `errores` (videoId → código) para simular un error al cargar ese video. */
type Falso = { duracion?: number; errores?: Record<string, number> };

/** `host`: donde va el reproductor (YouTube pide que se vea, al menos 200×113). */
export function crearReproductor(host: HTMLElement): Reproductor {
  const falso = import.meta.env.DEV ? (globalThis as unknown as { __ytFalso?: Falso }).__ytFalso : undefined;
  return falso ? reproductorFalso(falso) : reproductorYT(host);
}

// Mínimo de la IFrame API que usamos (no hay @types/youtube instalado).
type YTPlayer = {
  cueVideoById(o: { videoId: string; startSeconds: number }): void;
  loadVideoById(o: { videoId: string; startSeconds: number }): void;
  playVideo(): void; pauseVideo(): void; seekTo(s: number, permitir: boolean): void;
  getCurrentTime(): number; getDuration(): number; setVolume(v: number): void; destroy(): void;
};
type YTApi = { Player: new (el: HTMLElement, o: object) => YTPlayer };

let api: Promise<YTApi> | null = null;
function cargarApi(): Promise<YTApi> {
  const g = globalThis as unknown as { YT?: YTApi & { loaded?: number }; onYouTubeIframeAPIReady?: () => void };
  return api ??= new Promise<YTApi>((ok, mal) => {
    if (g.YT?.loaded) return ok(g.YT);
    g.onYouTubeIframeAPIReady = () => ok(g.YT!);
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = () => { api = null; s.remove(); mal(new Error('iframe_api')); }; // el próximo intento vuelve a probar
    document.head.append(s);
  });
}

function reproductorYT(host: HTMLElement): Reproductor {
  // Caja propia: la API reemplaza `div` por el iframe, y al destruir se borra la caja entera (aunque no haya llegado `onReady`).
  const caja = document.createElement('div'), div = document.createElement('div');
  caja.style.cssText = 'width:100%;height:100%';
  caja.append(div); host.append(caja);
  let p: YTPlayer | null = null, vivo = true;
  // El video pedido se le pasa a YouTube recién con play/pause (o en `onReady`): `loadVideoById` si tiene que sonar,
  // `cueVideoById` si queda parado. `cueVideoById` + `playVideo()` seguidos no anda: en un reproductor nuevo da error 2
  // y en uno con video el tema nuevo queda parado (probado en WebView2, Task 7).
  let pendiente: { id: string; desde: number } | null = null, sonar = false, vol = 50, desde = 0;
  const aplicar = () => {
    if (!p || !pendiente) return false;
    const o = { videoId: pendiente.id, startSeconds: pendiente.desde };
    pendiente = null;
    if (sonar) p.loadVideoById(o); else p.cueVideoById(o);
    return true;
  };
  let alEstado = (_: number) => {}, alError = (_: number) => {};
  cargarApi().then((YT) => {
    if (!vivo) return;
    new YT.Player(div, {
      width: '100%', height: '100%',
      playerVars: { playsinline: 1, rel: 0, disablekb: 1, origin: location.origin },
      events: {
        onReady: (e: { target: YTPlayer }) => {
          if (!vivo) return e.target.destroy();
          p = e.target; p.setVolume(vol);
          if (!aplicar() && sonar) p.playVideo();
        },
        onStateChange: (e: { data: number }) => alEstado(e.data),
        onError: (e: { data: number }) => alError(e.data),
      },
    });
  }, () => { if (vivo) alError(-1); });
  return {
    cargar(id, s) { pendiente = { id, desde: s }; desde = s; sonar = false; },
    play() { sonar = true; if (!aplicar()) p?.playVideo(); },
    pause() { sonar = false; if (!aplicar()) p?.pauseVideo(); },
    seek(s) { desde = s; if (pendiente) pendiente.desde = s; else p?.seekTo(s, true); },
    tiempo: () => p?.getCurrentTime() ?? desde,
    duracion: () => p?.getDuration() ?? 0,
    volumen(v) { vol = v; p?.setVolume(v); },
    destruir() { vivo = false; try { p?.destroy(); } catch { /* ya no está */ } p = null; caja.remove(); },
    onEstado(cb) { alEstado = cb; },
    onError(cb) { alError = cb; },
  };
}

/** Falso para los E2E: `tiempo` avanza con `Date.now()` mientras suena y al llegar a la duración avisa FIN. */
function reproductorFalso(cfg: Falso): Reproductor {
  let base = 0, desde = 0, sonando = false, cargado = false;
  let alEstado = (_: number) => {}, alError = (_: number) => {};
  const t = () => (sonando ? base + (Date.now() - desde) / 1000 : base);
  const reloj = setInterval(() => {
    const dur = cfg.duracion ?? 30;
    if (sonando && t() >= dur) { base = dur; sonando = false; alEstado(FIN); }
  }, 250);
  return {
    cargar(id, s) {
      const error = cfg.errores?.[id];
      base = s; sonando = false; cargado = !error;
      if (error) setTimeout(() => alError(error));
    },
    play() { if (!cargado || sonando) return; desde = Date.now(); sonando = true; alEstado(SONANDO); },
    pause() { if (!sonando) return; base = t(); sonando = false; alEstado(PAUSADO); },
    seek(s) { base = s; desde = Date.now(); },
    tiempo: t,
    duracion: () => cfg.duracion ?? 30,
    volumen() {},
    destruir() { clearInterval(reloj); sonando = false; },
    onEstado(cb) { alEstado = cb; },
    onError(cb) { alError = cb; },
  };
}
