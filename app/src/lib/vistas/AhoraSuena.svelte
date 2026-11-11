<script lang="ts">
  import { puedoEnLaLlamada } from '../grupos.svelte';
  // Pausar y saltear piden "cola" (permisos.ts); el volumen es de cada uno.
  const puedoCola = $derived(puedoEnLaLlamada('cola'));
  import { lleno } from '../rango';
  import type { RecordModel } from 'pocketbase';
  import { Music, Pause, Play, SkipForward, Volume2, VolumeX } from '@lucide/svelte';
  import { musica, pausar, reanudar, saltar, volumenMusica, progreso } from '../musica/musica.svelte';
  import { grupos } from '../grupos.svelte';
  import { voz } from '../voz.svelte';
  import { leerPrefs } from '../prefs';

  // Píldora de lo que suena (en el dock; en el celular, abajo de la sala). Con `cola`, el título abre el panel de la cola.
  let { cola }: { cola?: (e: MouseEvent) => void } = $props();

  let vol = $state(leerPrefs().volMusica);
  let antes = leerPrefs().volMusica || 50; // a dónde vuelve al quitar el mute
  function mutear() {
    if (vol) antes = vol;
    vol = vol ? 0 : antes;
    volumenMusica(vol);
  }
  let p = $state(progreso());
  $effect(() => { const i = setInterval(() => (p = progreso()), 500); return () => clearInterval(i); });

  const miembros = $derived((grupos.lista.find((g) => g.id === voz.grupoId)?.expand?.members ?? []) as RecordModel[]);
  const quien = $derived(miembros.find((m) => m.id === musica.actual?.agregadoPor)?.name);
  const enCola = $derived(musica.cola.filter((c) => c.estado === 'cola').length);
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const pct = $derived(p.dur ? Math.min(100, (p.t / p.dur) * 100) : 0);
  const detalle = $derived(`${musica.actual?.titulo}${quien ? ` · la puso ${quien}` : ''}${enCola ? ` · ${enCola} en cola` : ''} · ${mmss(p.t)}${p.dur ? ` / ${mmss(p.dur)}` : ''}`);
</script>

{#if musica.actual}
  <div class="barra" aria-label="Ahora suena">
    <span class="icono-musica"><Music size={15} strokeWidth={1.75} /></span>
    {#if cola}<button class="titulo" popovertarget="dock-musica" onclick={cola} title="{detalle} · Ver la cola"><strong>{musica.actual.titulo}</strong></button>
    {:else}<span class="titulo" title={detalle}><strong>{musica.actual.titulo}</strong></span>{/if}
    {#if puedoCola}<button class="icono" onclick={() => (musica.pausado ? reanudar() : pausar())} aria-label={musica.pausado ? 'Reanudar' : 'Pausar'} title={musica.pausado ? 'Reanudar' : 'Pausar'}>
      {#if musica.pausado}<Play size={16} strokeWidth={1.75} />{:else}<Pause size={16} strokeWidth={1.75} />{/if}</button>
    <button class="icono" onclick={saltar} disabled={!enCola} aria-label="Saltar" title={enCola ? 'Pasar a la siguiente (para todos)' : 'No hay otra canción en la cola'}><SkipForward size={16} strokeWidth={1.75} /></button>{/if}
    <button class="icono" onclick={mutear} aria-label={vol ? 'Silenciar música' : 'Activar música'} title={vol ? 'Silenciar música' : 'Activar música'}>
      {#if vol}<Volume2 size={16} strokeWidth={1.75} />{:else}<VolumeX size={16} strokeWidth={1.75} />{/if}</button>
    <input type="range" min="0" max="100" step="5" bind:value={vol} style={lleno(vol, 0, 100)} aria-label="Volumen de la música" oninput={() => volumenMusica(vol)} />
    <div class="pista"><span style="transform:scaleX({pct / 100})"></span></div>
  </div>
{/if}

<style>
  .barra { position: relative; overflow: hidden; flex: none; max-width: 100%; height: 40px; display: flex; align-items: center; gap: 6px; padding: 0 6px 0 4px;
    background: var(--superficie); border: 1px solid var(--borde); border-radius: 999px; box-shadow: var(--luz-borde), var(--sombra-2); }
  .icono-musica { flex: none; display: grid; place-items: center; width: 30px; height: 30px; border-radius: 50%; background: var(--acento-suave); color: var(--acento); }
  .titulo { flex: 0 1 auto; min-width: 0; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12.5px;
    display: block; height: auto; min-height: 0; padding: 0; background: none; border: 0; color: var(--texto); text-align: left; }
  button.titulo { cursor: pointer; }
  button.titulo:hover { color: var(--acento-texto); }
  .titulo strong { font-weight: 600; }
  .icono { flex: none; width: 32px; height: 32px; min-height: 32px; border-radius: 50%; }
  /* El progreso: una línea finita en el borde de abajo. */
  .pista { position: absolute; left: 14px; right: 14px; bottom: 0; height: 2px; border-radius: 999px; background: var(--elevado-2); overflow: hidden; }
  .pista span { display: block; height: 100%; background: var(--acento); transform-origin: left; }
  :global([data-modo='moderno']) .pista span { transition: transform .5s linear; }
  /* El volumen aparece al pasar el mouse (o al llegar con el teclado). */
  input[type='range'] { flex: none; width: 0; opacity: 0; padding: 0; background: none; border: 0; transition: width .2s, opacity .2s; }
  .barra:hover input[type='range'], .barra:focus-within input[type='range'] { width: 64px; opacity: 1; }
</style>
