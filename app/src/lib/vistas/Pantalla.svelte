<script lang="ts">
  import { lleno } from '../rango';
  import { Volume2, VolumeX, Maximize, X, Eye } from '@lucide/svelte';
  import { voz, ver, pistaPantalla, volumenPantalla } from '../voz.svelte';
  import Video from './Video.svelte';

  // Una pantalla que se está mirando: video, quién transmite, espectadores, volumen, pantalla completa y cerrar.
  let { sid }: { sid: string } = $props();
  // Se recalcula con cada cambio de `voz.participantes`: así se entera de que llegó la pista.
  const info = $derived((void voz.participantes, pistaPantalla(sid)));
  const pista = $derived(info?.pista);
  const p = $derived(voz.participantes.find((x) => x.id === info?.identidad));
  let marco = $state<HTMLElement>();
  let pct = $state(100);
  let ultimo = 100;
  function sonar(v: number) {
    if (v) ultimo = v;
    pct = v;
    if (info) volumenPantalla(info.identidad, v / 100);
  }
</script>

<!-- Pantalla completa sobre el contenedor (no el <video>): el mute nativo del video no toca el audio, que va por otra pista. -->
<div class="escenario" bind:this={marco}>
  {#if pista}<Video {pista} etiqueta={`Pantalla de ${p?.nombre ?? ''}`} />{/if}
  <span class="arriba"><span class="vivo"><span class="punto"></span>EN VIVO</span>
    <span class="espectadores num" title="Personas mirando"><Eye size={14} strokeWidth={1.75} />{p?.espectadores ?? 0}</span></span>
  <span class="etiqueta">{p?.nombre ?? ''}</span>
  <button class="icono cerrar" onclick={() => ver(sid, false)} aria-label="Dejar de ver" title="Dejar de ver"><X size={16} strokeWidth={1.75} /></button>
  <div class="controles">
    <button class="icono" onclick={() => sonar(pct ? 0 : ultimo)} aria-label={pct ? 'Silenciar transmisión' : 'Activar sonido'}>
      {#if pct}<Volume2 size={16} strokeWidth={1.75} />{:else}<VolumeX size={16} strokeWidth={1.75} />{/if}</button>
    <input type="range" min="0" max="200" step="5" bind:value={pct} style={lleno(pct, 0, 200)} aria-label="Volumen de la transmisión" oninput={() => sonar(pct)} />
    <button class="icono" onclick={() => (document.fullscreenElement ? document.exitFullscreen() : marco?.requestFullscreen())?.catch(() => {})} aria-label="Pantalla completa" title="Pantalla completa"><Maximize size={16} strokeWidth={1.75} /></button>
  </div>
</div>

<style>
  .escenario { position: relative; min-width: 0; display: grid; place-items: center; background: var(--hondo); border: 1px solid var(--borde);
    border-radius: var(--radio-grande); overflow: hidden; box-shadow: var(--sombra-2); }
  :global([data-modo='moderno']) .escenario { animation: aparece 280ms var(--curva-salida); }
  @keyframes aparece { from { opacity: 0; transform: scale(.985); } }
  /* El alto lo pone quien la usa (--alto): con una sola pantalla es más alta que con varias. */
  .escenario :global(video) { display: block; width: 100%; max-height: var(--alto, 60vh); object-fit: contain; }
  .arriba { position: absolute; top: 12px; left: 12px; display: flex; gap: 6px; }
  .vivo, .espectadores { display: inline-flex; align-items: center; gap: 5px; height: 24px; padding: 0 8px; border-radius: var(--radio); font-size: 11.5px; font-weight: 750; }
  .vivo { color: #07210F; background: var(--ok); letter-spacing: .03em; }
  .punto { width: 6px; height: 6px; border-radius: 50%; background: #07210F; }
  :global([data-modo='moderno']) .punto { animation: latido 2s ease-in-out infinite; }
  @keyframes latido { 50% { opacity: .35; } }
  .espectadores { color: #fff; background: rgb(8 9 13 / .75); font-weight: 650; }
  .etiqueta { position: absolute; left: 12px; bottom: 12px; display: flex; align-items: center; height: 28px; padding: 0 12px; font-size: 13px; font-weight: 600;
    background: rgb(8 9 13 / .75); border-radius: var(--radio-pildora); }
  /* Controles arriba a la derecha y abajo: aparecen al pasar el mouse (por opacidad). */
  .cerrar, .controles { opacity: 0; transition: opacity var(--dur-media); }
  .escenario:hover .cerrar, .escenario:hover .controles, .cerrar:focus-visible, .controles:focus-within { opacity: 1; }
  .cerrar { position: absolute; top: 12px; right: 12px; background: rgb(8 9 13 / .75); }
  .controles { position: absolute; right: 12px; bottom: 12px; display: flex; align-items: center; gap: 4px; padding: 2px 6px; background: rgb(8 9 13 / .75); border-radius: var(--radio-menu); }
  .controles input { width: 100px; }
  .escenario:fullscreen { border: 0; border-radius: 0; background: #000; }
  .escenario:fullscreen :global(video) { max-height: none; height: 100%; }
</style>
