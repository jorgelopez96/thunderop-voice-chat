<script lang="ts">
  import { untrack } from 'svelte';
  import { lleno } from '../rango';
  import type { RecordModel } from 'pocketbase';
  import { Play, Pause, RotateCcw, Volume2, VolumeX, Maximize, X, TvMinimalPlay } from '@lucide/svelte';
  import { youtube, ubicarVideo, pausar, reanudar, ir, sacar, deNuevo, volumenVideo, progreso } from '../youtube/youtube.svelte';
  import { mmss } from '../youtube/sincro';
  import { volumenYoutube } from '../prefs';
  import { grupos } from '../grupos.svelte';
  import { voz } from '../voz.svelte';
  import { completa, entrarPantallaCompleta, salirPantallaCompleta } from '../pantallaCompleta.svelte';
  import Confirmar from './Confirmar.svelte';

  // El video de YouTube juntos como una tarjeta más del escenario. Todo lo que se toca acá le pasa a toda la sala.
  let host = $state<HTMLElement>();
  $effect(() => {
    const el = host;
    if (!el) return;
    untrack(() => ubicarVideo(el)); // sin untrack, cada cambio del video recreaba el reproductor
    return () => ubicarVideo(null);
  });
  $effect(() => () => { if (completa.sid === 'youtube') void salirPantallaCompleta(); });

  let p = $state(progreso());
  $effect(() => { const i = setInterval(() => (p = progreso()), 500); return () => clearInterval(i); });
  let arrastre = $state<number | null>(null); // mientras se arrastra la barra, no salta con el progreso
  const t = $derived(arrastre ?? Math.min(p.t, p.dur || p.t));

  let vol = $state(volumenYoutube());
  let antes = volumenYoutube() || 70; // a dónde vuelve al quitar el mute
  function mutear() {
    if (vol) antes = vol;
    vol = vol ? 0 : antes;
    volumenVideo(vol);
  }

  const miembros = $derived((grupos.lista.find((g) => g.id === voz.grupoId)?.expand?.members ?? []) as RecordModel[]);
  const quien = $derived(miembros.find((m) => m.id === youtube.actual?.puestoPor)?.name);
  let sacando = $state(false);
</script>

<div class="escenario" class:completa={completa.sid === 'youtube'} class:pausado={youtube.pausado || youtube.terminado}>
  <div class="video" bind:this={host}></div>
  <!-- Tapa el iframe: los clics no le llegan a YouTube (si no, cada uno pausaría solo el suyo). -->
  <div class="tapa"></div>
  {#if youtube.error}<p class="error" role="alert">{youtube.error}</p>{/if}
  <span class="arriba"><span class="yt"><TvMinimalPlay size={14} strokeWidth={2} />YouTube</span>
    <span class="titulo" title={youtube.actual?.titulo}>{youtube.actual?.titulo}{quien ? ` · lo puso ${quien}` : ''}</span></span>
  <button class="icono cerrar" onclick={() => (sacando = true)} aria-label="Sacar el video" title="Sacar el video (para todos)"><X size={16} strokeWidth={1.75} /></button>
  <div class="controles">
    {#if youtube.terminado}
      <button class="icono" onclick={deNuevo} aria-label="Ver de nuevo" title="Ver de nuevo (para todos)"><RotateCcw size={16} strokeWidth={1.75} /></button>
    {:else}
      <button class="icono" onclick={() => (youtube.pausado ? reanudar() : pausar())} aria-label={youtube.pausado ? 'Reanudar' : 'Pausar'} title={youtube.pausado ? 'Reanudar (para todos)' : 'Pausar (para todos)'}>
        {#if youtube.pausado}<Play size={16} strokeWidth={1.75} />{:else}<Pause size={16} strokeWidth={1.75} />{/if}</button>
    {/if}
    <input class="barra" type="range" min="0" max={p.dur || 1} step="1" value={t} style={lleno(t, 0, p.dur || 1)} disabled={!p.dur}
      aria-label="Ir a otro momento del video" oninput={(e) => (arrastre = +e.currentTarget.value)}
      onchange={(e) => { arrastre = null; void ir(+e.currentTarget.value); }} />
    <small class="tiempo">{mmss(t)}{p.dur ? ` / ${mmss(p.dur)}` : ''}</small>
    <button class="icono" onclick={mutear} aria-label={vol ? 'Silenciar video' : 'Activar sonido del video'}>
      {#if vol}<Volume2 size={16} strokeWidth={1.75} />{:else}<VolumeX size={16} strokeWidth={1.75} />{/if}</button>
    <input class="vol" type="range" min="0" max="100" step="5" bind:value={vol} style={lleno(vol, 0, 100)} aria-label="Volumen del video" oninput={() => volumenVideo(vol)} />
    <button class="icono" onclick={() => (completa.sid !== null ? salirPantallaCompleta() : entrarPantallaCompleta('youtube'))} aria-label="Pantalla completa" title="Pantalla completa"><Maximize size={16} strokeWidth={1.75} /></button>
  </div>
</div>
{#if sacando}
  <Confirmar texto="¿Sacar el video? Se deja de ver para todos los de la sala." accion="Sacar"
    cancelar={() => (sacando = false)} confirmar={() => { sacando = false; void sacar(); }} />
{/if}

<style>
  .escenario { position: relative; min-width: 0; height: 100%; min-height: 0; background: #000; border: 1px solid var(--borde);
    border-radius: var(--radio-grande); overflow: hidden; box-shadow: var(--sombra-2); }
  :global([data-modo='moderno']) .escenario { animation: aparece 280ms var(--curva-salida); }
  @keyframes aparece { from { opacity: 0; transform: scale(.985); } }
  .video, .tapa { position: absolute; inset: 0; }
  .error { position: absolute; inset: auto 12px 64px; margin: 0; padding: 8px 12px; font-size: 13px; text-align: center;
    background: rgb(8 9 13 / .85); border-radius: var(--radio-menu); }
  .arriba { position: absolute; top: 12px; left: 12px; right: 56px; display: flex; gap: 6px; min-width: 0; }
  .yt, .titulo { display: inline-flex; align-items: center; gap: 5px; height: 24px; padding: 0 8px; border-radius: var(--radio); font-size: 11.5px; font-weight: 650; }
  .yt { flex: none; color: #fff; background: var(--rojo-yt); font-weight: 750; letter-spacing: .03em; }
  .titulo { display: block; line-height: 24px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #fff; background: rgb(8 9 13 / .75); }
  /* Controles: aparecen al pasar el mouse; en pausa quedan a la vista. */
  .cerrar, .controles { opacity: 0; transition: opacity var(--dur-media); }
  .escenario:hover .cerrar, .escenario:hover .controles, .pausado .controles, .cerrar:focus-visible, .controles:focus-within { opacity: 1; }
  .cerrar { position: absolute; top: 12px; right: 12px; background: rgb(8 9 13 / .75); }
  .controles { position: absolute; left: 12px; right: 12px; bottom: 12px; display: flex; align-items: center; gap: 6px; padding: 2px 6px;
    background: rgb(8 9 13 / .75); border-radius: var(--radio-menu); }
  .controles input { padding: 0; background: none; border: 0; }
  .barra { flex: 1; min-width: 60px; }
  .vol { width: 80px; }
  .tiempo { flex: none; font-variant-numeric: tabular-nums; color: #fff; }
  :global(.escenarios.completa) .controles { bottom: 92px; }
  .escenario.completa { position: fixed; inset: 0; z-index: 100; height: auto; border: 0; border-radius: 0; }
  .escenario.completa .controles { bottom: 92px; } /* arriba de la barrita de la llamada */
</style>
