import { cargarApi, type Reproductor } from '../musica/reproductor';

// Reproductor de video para YouTube juntos: el mismo trato que el de la música (misma IFrame API cargada una sola vez),
// pero a la vista y sin los controles de YouTube: se maneja con los de la tarjeta, que avisan a toda la sala.

type YTPlayer = {
  cueVideoById(o: { videoId: string; startSeconds: number }): void;
  loadVideoById(o: { videoId: string; startSeconds: number }): void;
  playVideo(): void; pauseVideo(): void; seekTo(s: number, permitir: boolean): void;
  getCurrentTime(): number; getDuration(): number; setVolume(v: number): void; destroy(): void;
};

export function crearReproductorVideo(host: HTMLElement): Reproductor {
  const caja = document.createElement('div'), div = document.createElement('div');
  caja.style.cssText = 'position:absolute;inset:0';
  caja.append(div); host.append(caja);
  let p: YTPlayer | null = null, vivo = true;
  // Como en la música: el video se le pasa a YouTube recién con play/pause (load si suena, cue si queda parado).
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
      playerVars: { playsinline: 1, rel: 0, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3, origin: location.origin },
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
