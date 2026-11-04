<script lang="ts">
  import { youtube, poner, sacar } from '../youtube/youtube.svelte';
  import { voz } from '../voz.svelte';

  // Panelcito de YouTube juntos del dock: pegar el link. El video se ve (y se maneja) en el escenario de la sala.
  let url = $state('');
  let enviando = $state(false);
  async function enviar(e: SubmitEvent) {
    e.preventDefault();
    enviando = true;
    try { if (await poner(url)) url = ''; } finally { enviando = false; }
  }
</script>

<div class="yt">
  <div class="cabecera"><h3>YouTube juntos</h3>
    {#if youtube.actual}<button class="plano peligro chico" onclick={sacar}>Sacar el video</button>{/if}</div>
  <p class="tenue">Pegá el link de un video y lo ven todos los de la sala al mismo tiempo.</p>
  <form class="fila" onsubmit={enviar}>
    <input bind:value={url} required placeholder="https://youtu.be/…" aria-label="Link de un video de YouTube" oninput={() => (youtube.error = '')} />
    <button type="submit" class="primario" disabled={!voz.salaId || voz.conectando || enviando}>{youtube.actual ? 'Cambiar' : 'Poner'}</button>
  </form>
  {#if youtube.error}<p role="alert">{youtube.error}</p>{/if}
  {#if youtube.actual}<p class="tenue ahora">Ahora: <strong>{youtube.actual.titulo}</strong></p>{/if}
</div>

<style>
  .yt { display: flex; flex-direction: column; gap: 12px; }
  h3 { margin: 0; }
  .cabecera { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .chico { padding: 4px 8px; font-size: 13px; }
  .fila { display: flex; gap: 8px; align-items: center; }
  .fila input { flex: 1; }
  .tenue { margin: 0; color: var(--tenue); font-size: 13px; }
  .ahora { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tenue strong { color: var(--texto); font-weight: 600; }
</style>
