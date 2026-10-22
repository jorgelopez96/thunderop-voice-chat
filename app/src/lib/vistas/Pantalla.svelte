<script lang="ts">
  import { Volume2, VolumeX, Maximize, X, User } from '@lucide/svelte';
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
  <span class="etiqueta"><span class="punto"></span>{p?.nombre ?? ''}
    <span class="espectadores" title="Personas mirando"><User size={12} strokeWidth={2.5} />{p?.espectadores ?? 0}</span></span>
  <button class="icono cerrar" onclick={() => ver(sid, false)} aria-label="Dejar de ver" title="Dejar de ver"><X size={16} strokeWidth={1.75} /></button>
  <div class="controles">
    <button class="icono" onclick={() => sonar(pct ? 0 : ultimo)} aria-label={pct ? 'Silenciar transmisión' : 'Activar sonido'}>
      {#if pct}<Volume2 size={16} strokeWidth={1.75} />{:else}<VolumeX size={16} strokeWidth={1.75} />{/if}</button>
    <input type="range" min="0" max="200" step="5" bind:value={pct} aria-label="Volumen de la transmisión" oninput={() => sonar(pct)} />
    <button class="icono" onclick={() => (document.fullscreenElement ? document.exitFullscreen() : marco?.requestFullscreen())?.catch(() => {})} aria-label="Pantalla completa" title="Pantalla completa"><Maximize size={16} strokeWidth={1.75} /></button>
  </div>
</div>

<style>
  .escenario { position: relative; min-width: 0; display: grid; place-items: center; background: var(--hondo); border: 1px solid var(--borde); border-radius: var(--radio-tarjeta); overflow: hidden; }
  /* El alto lo pone quien la usa (--alto): con una sola pantalla es más alta que con varias. */
  .escenario :global(video) { display: block; width: 100%; max-height: var(--alto, 60vh); object-fit: contain; }
  .etiqueta { position: absolute; top: 12px; left: 12px; display: flex; align-items: center; gap: 8px; padding: 4px 8px; font-size: 13px; font-weight: 500; background: rgb(0 0 0 / .6); border-radius: var(--radio); }
  .punto { width: 6px; height: 6px; border-radius: 999px; background: var(--ok); }
  .espectadores { display: inline-flex; align-items: center; gap: 2px; color: var(--peligro); font-weight: 600; }
  .cerrar { position: absolute; top: 12px; right: 12px; background: rgb(0 0 0 / .6); }
  .controles { position: absolute; right: 12px; bottom: 12px; display: flex; align-items: center; gap: 4px; padding: 2px 4px; background: rgb(0 0 0 / .6); border-radius: var(--radio); }
  .controles input { width: 100px; padding: 0; background: none; border: 0; }
  .escenario:fullscreen { border: 0; border-radius: 0; background: #000; }
  .escenario:fullscreen :global(video) { max-height: none; height: 100%; }
</style>
