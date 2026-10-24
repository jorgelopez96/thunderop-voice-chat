import type { Estado, Fuente, Opciones } from './transmisorNativo';

// Solo para desarrollo y los E2E, fuera de Tauri: hace de transmisor nativo publicando un <canvas> con la hora
// como `<usuario>.pantalla`. transmisorNativo lo importa dinámicamente bajo `import.meta.env.DEV`, así no entra al build.

export const fuentesSimuladas = (): Fuente[] => [
  { tipo: 'monitor', id: 'simulado', titulo: 'Pantalla 1 (principal)', pid: 0, png_base64: null },
];

export function simularNativo(op: Opciones, canal: (m: Estado) => void): { detener(): void; calidad(fps: number, alto: number): void } {
  const canvas = document.createElement('canvas');
  const ajustar = (alto: number) => { canvas.height = alto; canvas.width = Math.round((alto * 16) / 9); };
  ajustar(op.alto);
  const g = canvas.getContext('2d')!;
  const pintar = () => {
    g.fillStyle = '#123'; g.fillRect(0, 0, canvas.width, canvas.height);
    g.fillStyle = '#fff'; g.font = `${canvas.height / 5}px sans-serif`;
    g.fillText(new Date().toISOString().slice(11, 23), 20, canvas.height / 2);
  };
  pintar();
  const timer = setInterval(pintar, 100);

  let room: import('livekit-client').Room | undefined;
  let cortado = false;
  const detener = () => {
    if (cortado) return;
    cortado = true;
    clearInterval(timer);
    void room?.disconnect();
    canal({ tipo: 'fin', codigo: 0, registro: 'simulado' });
  };
  const fallo = () => {
    if (cortado) return;
    cortado = true;
    clearInterval(timer);
    void room?.disconnect();
    canal({ tipo: 'fin', codigo: 5, registro: 'simulado: no conecta' });
  };

  void (async () => {
    const lk = await import('livekit-client');
    room = new lk.Room();
    await room.connect(op.url, op.token);
    if (cortado) { void room.disconnect(); return; }
    const [pista] = canvas.captureStream(op.fps).getVideoTracks();
    await room.localParticipant.publishTrack(pista, { source: lk.Track.Source.ScreenShare });
    if (cortado) return;
    canal({ tipo: 'transmitiendo' });
  })().catch(fallo);

  return { detener, calidad: (_fps, alto) => ajustar(alto) };
}
