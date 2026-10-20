<script lang="ts">
  import { musica, agregar, pausar, reanudar, saltar, quitar, volumenMusica } from '../musica/musica.svelte';
  import { voz } from '../voz.svelte';
  import { leerPrefs } from '../prefs';

  let { abierto, alAlternar }: { abierto: boolean; alAlternar: (a: boolean) => void } = $props();
  let url = $state('');
  let vol = $state(leerPrefs().volMusica);
  async function enviar(e: SubmitEvent) {
    e.preventDefault();
    if (await agregar(url.trim())) url = '';
  }
</script>

<details class="seccion" open={abierto} ontoggle={(e) => alAlternar(e.currentTarget.open)}>
  <summary>Música</summary>
  <form class="fila" onsubmit={enviar}>
    <input bind:value={url} required placeholder="Pegá un link de YouTube" aria-label="Pegá un link de YouTube" />
    <button type="submit" disabled={!voz.salaId || voz.conectando}>Agregar</button>
  </form>
  {#if musica.error}<p role="alert">{musica.error}</p>{/if}
  {#if musica.actual}
    <div class="fila">
      <strong class="titulo">{musica.actual.titulo}</strong>
      <button onclick={() => (musica.pausado ? reanudar() : pausar())}>{musica.pausado ? 'Reanudar' : 'Pausar'}</button>
      <button onclick={saltar}>Saltar</button>
    </div>
  {/if}
  <ul>
    {#each musica.cola as c (c.id)}
      <li class="fila">
        <span class="titulo">{c.titulo}{c.estado === 'error' ? ' — No se puede reproducir acá' : ''}</span>
        {#if c.estado !== 'error'}<button class="plano" aria-label={`Quitar ${c.titulo}`} onclick={() => quitar(c.id)}>Quitar</button>{/if}
      </li>
    {/each}
  </ul>
  <input type="range" min="0" max="100" step="5" bind:value={vol} aria-label="Volumen de la música" oninput={() => volumenMusica(vol)} />
</details>

<style>
  .fila { display: flex; gap: 8px; align-items: center; margin: 6px 0; }
  .fila input { flex: 1; }
  .titulo { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  input[type='range'] { width: 100%; padding: 0; background: none; }
</style>
