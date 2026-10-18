import { describe, it, expect, beforeEach } from 'vitest';
import { crearReproductor } from './reproductor';

// `reproductorYT` con un `YT.Player` de mentira: cargar → play ⇒ loadVideoById; cargar → pause ⇒ cueVideoById;
// nada de seekTo mientras la carga está pendiente (cueVideoById + playVideo seguidos da error 2 en YouTube).
type Llamada = [string, ...unknown[]];
let llamadas: Llamada[];
let listo: () => void;

const elemento = () => ({ style: {}, append() {}, remove() {} });
beforeEach(() => {
  llamadas = [];
  const g = globalThis as Record<string, unknown>;
  g.document = { createElement: elemento, head: { append() {} } };
  g.location = { origin: 'http://tauri.localhost' };
  const target = Object.fromEntries(['cueVideoById', 'loadVideoById', 'playVideo', 'pauseVideo', 'seekTo', 'setVolume', 'destroy']
    .map((m) => [m, (...a: unknown[]) => llamadas.push([m, ...a])]));
  g.YT = { loaded: 1, Player: class { constructor(_el: unknown, o: { events: { onReady(e: unknown): void } }) { listo = () => o.events.onReady({ target }); } } };
});
const nuevo = async () => {
  const r = crearReproductor(elemento() as unknown as HTMLElement);
  await new Promise((ok) => setTimeout(ok)); // la API ya está "cargada": el Player se crea en un then
  return r;
};
const deVideo = () => llamadas.filter(([m]) => m !== 'setVolume');

describe('reproductorYT', () => {
  it('antes de onReady: cargar → play carga sonando (loadVideoById) y nada más', async () => {
    const r = await nuevo();
    r.cargar('aaaaaaaaaaa', 4); r.play();
    listo();
    expect(deVideo()).toEqual([['loadVideoById', { videoId: 'aaaaaaaaaaa', startSeconds: 4 }]]);
  });

  it('listo: cargar → pause usa cueVideoById; el play siguiente es playVideo', async () => {
    const r = await nuevo(); listo();
    r.cargar('bbbbbbbbbbb', 10); r.pause();
    r.play();
    expect(deVideo()).toEqual([['cueVideoById', { videoId: 'bbbbbbbbbbb', startSeconds: 10 }], ['playVideo']]);
  });

  it('seek con la carga pendiente no llama a seekTo: mueve el inicio', async () => {
    const r = await nuevo(); listo();
    r.cargar('ccccccccccc', 0); r.seek(7);
    expect(deVideo()).toEqual([]);
    r.play();
    r.seek(9);
    expect(deVideo()).toEqual([['loadVideoById', { videoId: 'ccccccccccc', startSeconds: 7 }], ['seekTo', 9, true]]);
  });
});
