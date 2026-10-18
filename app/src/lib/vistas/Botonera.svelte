<script lang="ts">
  import { sonidos, subir, borrar, tocar } from '../botonera.svelte';
  import { mensajeError } from '../sesion.svelte';
  import { voz } from '../voz.svelte';
  import { leerPrefs, guardarPrefs } from '../prefs';

  let { grupoId, userId, soyDueno, abierto, alAlternar }: { grupoId: string; userId: string | undefined; soyDueno: boolean; abierto: boolean; alAlternar: (a: boolean) => void } = $props();
  // Grupo.svelte está con {#key}: un grupo por instancia.
  // svelte-ignore state_referenced_locally
  const s = sonidos(grupoId);
  $effect(() => s.parar);
  let dlg = $state<HTMLDialogElement>();
  let nombre = $state('');
  let archivo = $state<File>();
  let error = $state('');
  let subiendo = $state(false);
  let modal = $state(false); // `dlg.open` no es reactivo
  let vol = $state(Math.round(leerPrefs().volBotonera * 100));

  async function enviar(e: SubmitEvent) {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    if (!archivo) return (error = 'Elegí un archivo de audio.');
    error = ''; subiendo = true;
    try { await subir(grupoId, nombre, archivo); form.reset(); nombre = ''; archivo = undefined; dlg?.close(); }
    catch (e) { error = e instanceof Error ? e.message : mensajeError(e); }
    finally { subiendo = false; }
  }
  async function quitar(id: string) {
    error = '';
    try { await borrar(id); } catch (e) { error = mensajeError(e); }
  }
</script>

<details class="seccion" open={abierto} ontoggle={(e) => alAlternar(e.currentTarget.open)}>
  <summary>Botonera</summary>
  {#if error && !modal}<p role="alert">{error}</p>{/if}
  <ul class="grilla">
    {#each s.estado.lista as x (x.id)}
      <li>
        <button disabled={!voz.salaId} onclick={() => tocar(x.id)}>{x.name}</button>
        {#if soyDueno || x.owner === userId}<button class="plano" aria-label={`Borrar ${x.name}`} onclick={() => quitar(x.id)}>Borrar</button>{/if}
      </li>
    {/each}
  </ul>
  {#if !s.estado.lista.length}<p>Todavía no hay sonidos.</p>{/if}
  <div class="fila">
    <button onclick={() => { error = ''; modal = true; dlg?.showModal(); }}>+ Sonido</button>
    <input type="range" min="0" max="100" step="5" bind:value={vol} aria-label="Volumen de la botonera"
      oninput={() => guardarPrefs({ volBotonera: vol / 100 })} />
  </div>
</details>

<dialog bind:this={dlg} onclose={() => { modal = false; error = ''; }}>
  <form onsubmit={enviar}>
    <input bind:value={nombre} required maxlength="30" placeholder="Nombre del sonido" aria-label="Nombre del sonido" />
    <input type="file" accept="audio/*" required aria-label="Archivo de audio" onchange={(e) => (archivo = e.currentTarget.files?.[0])} />
    {#if error}<p role="alert">{error}</p>{/if}
    <div class="fila">
      <button type="submit" class="primario" disabled={subiendo}>Subir</button>
      <button type="button" onclick={() => dlg?.close()}>Cancelar</button>
    </div>
  </form>
</dialog>

<style>
  .grilla { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px; margin: 8px 0; }
  .grilla li { display: flex; flex-direction: column; gap: 2px; }
  .fila { display: flex; gap: 8px; align-items: center; }
  .fila input[type='range'] { flex: 1; padding: 0; background: none; }
  form { display: flex; flex-direction: column; gap: 8px; }
</style>
