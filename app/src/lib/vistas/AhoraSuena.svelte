<script lang="ts">
  import { lleno } from '../rango';
  import type { RecordModel } from 'pocketbase';
  import { Music, Pause, Play, SkipForward, Volume2, VolumeX } from '@lucide/svelte';
  import { musica, pausar, reanudar, saltar, volumenMusica, progreso } from '../musica/musica.svelte';
  import { grupos } from '../grupos.svelte';
  import { voz } from '../voz.svelte';
  import { leerPrefs } from '../prefs';

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
</script>

{#if musica.actual}
  <div class="barra" aria-label="Ahora suena">
    <span class="icono-musica"><Music size={16} strokeWidth={1.75} /></span>
    <div class="info">
      <div class="texto"><strong>{musica.actual.titulo}</strong>
        <small>{quien ? ` · la puso ${quien}` : ''}{enCola ? ` · ${enCola} en cola` : ''}</small></div>
      <div class="pista"><span style="transform:scaleX({pct / 100})"></span></div>
    </div>
    <small class="tiempo">{mmss(p.t)}{p.dur ? ` / ${mmss(p.dur)}` : ''}</small>
    <button class="icono" onclick={() => (musica.pausado ? reanudar() : pausar())} aria-label={musica.pausado ? 'Reanudar' : 'Pausar'} title={musica.pausado ? 'Reanudar' : 'Pausar'}>
      {#if musica.pausado}<Play size={16} strokeWidth={1.75} />{:else}<Pause size={16} strokeWidth={1.75} />{/if}</button>
    <button class="icono" onclick={saltar} disabled={!enCola} aria-label="Saltar" title={enCola ? 'Pasar a la siguiente (para todos)' : 'No hay otra canción en la cola'}><SkipForward size={16} strokeWidth={1.75} /></button>
    <button class="icono" onclick={mutear} aria-label={vol ? 'Silenciar música' : 'Activar música'} title={vol ? 'Silenciar música' : 'Activar música'}>
      {#if vol}<Volume2 size={16} strokeWidth={1.75} />{:else}<VolumeX size={16} strokeWidth={1.75} />{/if}</button>
    <input type="range" min="0" max="100" step="5" bind:value={vol} style={lleno(vol, 0, 100)} aria-label="Volumen de la música" oninput={() => volumenMusica(vol)} />
  </div>
{/if}

<style>
  .barra { flex: none; height: 52px; display: flex; align-items: center; gap: 12px; padding: 0 12px; background: var(--panel); border: 1px solid var(--borde);
    border-radius: var(--radio-tarjeta); box-shadow: var(--luz-borde), var(--sombra-1); }
  .icono-musica { display: grid; place-items: center; width: 32px; height: 32px; border-radius: var(--radio); background: var(--acento-suave); color: var(--acento); }
  .info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
  .texto { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
  .texto strong { font-weight: 600; }
  .pista { height: 3px; border-radius: 999px; background: var(--elevado-2); overflow: hidden; }
  .pista span { display: block; height: 100%; background: var(--acento); transform-origin: left; }
  :global([data-modo='moderno']) .pista span { transition: transform .5s linear; }
  .tiempo { font-variant-numeric: tabular-nums; }
  input[type='range'] { width: 80px; padding: 0; background: none; border: 0; }
</style>
