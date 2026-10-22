<script lang="ts">
  import type { RecordModel } from 'pocketbase';
  import { subir, editar } from '../botonera.svelte';
  import { mensajeError } from '../sesion.svelte';
  import BotonEmoji from './BotonEmoji.svelte';

  // Modal para subir un sonido al grupo, o para editar `sonido` (nombre y volumen). Quien lo usa lo monta con {#if} y lo desmonta en `cerrar`.
  let { grupoId, cerrar, sonido }: { grupoId: string; cerrar: () => void; sonido?: RecordModel } = $props();
  let dlg = $state<HTMLDialogElement>();
  $effect(() => { dlg?.showModal(); });
  // svelte-ignore state_referenced_locally
  let nombre = $state(sonido?.name ?? '');
  let archivo = $state<File>();
  // svelte-ignore state_referenced_locally
  let volumen = $state(sonido?.volumen || 100);
  let error = $state('');
  let subiendo = $state(false);

  async function enviar(e: SubmitEvent) {
    e.preventDefault();
    if (sonido) return guardar(() => editar(sonido.id, { name: nombre.trim(), volumen }));
    if (!archivo) return (error = 'Elegí un archivo de audio.');
    const a = archivo;
    await guardar(() => subir(grupoId, nombre, a, volumen));
  }
  async function guardar(f: () => Promise<unknown>) {
    error = ''; subiendo = true;
    try { await f(); dlg?.close(); }
    catch (e) { error = e instanceof Error ? e.message : mensajeError(e); }
    finally { subiendo = false; }
  }
</script>

<dialog bind:this={dlg} onclose={cerrar}>
  <form onsubmit={enviar}>
    <h3>{sonido ? 'Editar sonido' : 'Subir un sonido'}</h3>
    <div class="nombre">
      <input bind:value={nombre} required maxlength="30" placeholder="Nombre del sonido" aria-label="Nombre del sonido" />
      <BotonEmoji elegir={(e) => (nombre += e)} />
    </div>
    {#if !sonido}<input type="file" accept="audio/*" required aria-label="Archivo de audio" onchange={(e) => (archivo = e.currentTarget.files?.[0])} />{/if}
    <label>Volumen para todos: {volumen}%
      <input type="range" min="5" max="200" step="5" bind:value={volumen} aria-label="Volumen del sonido" /></label>
    {#if error}<p role="alert">{error}</p>{/if}
    <div class="fila">
      <button type="submit" class="primario" disabled={subiendo}>{sonido ? 'Guardar' : 'Subir'}</button>
      <button type="button" onclick={() => dlg?.close()}>Cancelar</button>
    </div>
  </form>
</dialog>

<style>
  form { display: flex; flex-direction: column; gap: 8px; }
  form h3 { margin: 0 0 4px; }
  .nombre { display: flex; align-items: center; gap: 4px; }
  .nombre input { flex: 1; }
  label input { padding: 0; border: 0; background: none; }
  .fila { display: flex; gap: 8px; align-items: center; }
</style>
