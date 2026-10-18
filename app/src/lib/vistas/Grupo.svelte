<script lang="ts">
  import type { RecordModel } from 'pocketbase';
  import { sesion, mensajeError } from '../sesion.svelte';
  import { salas, crearInvitacion, crearSala, renombrarSala, borrarSala, borrarGrupo } from '../grupos.svelte';
  import Miembros from './Miembros.svelte';
  import Confirmar from './Confirmar.svelte';

  let { grupo, volver }: { grupo: RecordModel; volver: () => void } = $props();
  const soyDueno = $derived(grupo.owner === sesion.usuario?.id);
  // svelte-ignore state_referenced_locally
  const s = salas(grupo.id); // el componente se recrea por grupo (clave en Principal)
  $effect(() => s.parar);

  const chat = $derived(s.estado.lista.filter((r) => r.kind === 'chat'));
  const voz = $derived(s.estado.lista.filter((r) => r.kind === 'voz'));

  let link = $state('');
  let error = $state('');
  let nueva = $state({ chat: '', voz: '' });
  let editando = $state<{ id: string; name: string } | null>(null);
  let confirmar = $state<null | { texto: string; hacer: () => Promise<void> }>(null);

  async function hacer(f: () => Promise<void>) {
    error = '';
    try { await f(); } catch (e) { error = mensajeError(e); }
  }
  async function invitar() {
    link = await crearInvitacion(grupo.id);
    try { await navigator.clipboard.writeText(link); } catch { /* sin permiso: el link queda visible */ }
  }
  async function agregar(kind: 'chat' | 'voz') {
    const name = nueva[kind].trim();
    if (!name) return;
    await crearSala(grupo.id, name, kind, s.estado.lista.length);
    nueva[kind] = '';
  }
  async function guardarNombre() {
    if (editando?.name.trim()) await renombrarSala(editando.id, editando.name.trim());
    editando = null;
  }
</script>

{#snippet sala(r: RecordModel, deshabilitada: boolean)}
  <li>
    {#if editando?.id === r.id}
      <input bind:value={editando.name} maxlength="40" />
      <button onclick={() => hacer(guardarNombre)}>Guardar</button>
      <button onclick={() => (editando = null)}>Cancelar</button>
    {:else}
      <button disabled={deshabilitada}>{r.kind === 'chat' ? '#' : '🔊'} {r.name}</button>
      {#if deshabilitada}<small>Disponible en la próxima versión</small>{/if}
      {#if soyDueno}
        <button onclick={() => (editando = { id: r.id, name: r.name })}>Renombrar</button>
        <button onclick={() => (confirmar = { texto: `¿Borrar la sala "${r.name}"?`, hacer: () => borrarSala(r.id) })}>Borrar sala</button>
      {/if}
    {/if}
  </li>
{/snippet}

<section>
  <button onclick={volver}>← Grupos</button>
  <h2>{grupo.name}</h2>
  <button onclick={() => hacer(invitar)}>Invitar</button>
  {#if link}<p role="status">Link copiado: <code data-testid="link-invitacion">{link}</code></p>{/if}
  {#if soyDueno}<button onclick={() => (confirmar = { texto: `¿Borrar el grupo "${grupo.name}"? Se pierden salas y mensajes.`, hacer: () => borrarGrupo(grupo.id) })}>Borrar grupo</button>{/if}
  {#if error}<p role="alert" style="color:#c00">{error}</p>{/if}

  <h3>Salas de chat</h3>
  <ul>{#each chat as r (r.id)}{@render sala(r, false)}{/each}</ul>
  {#if soyDueno}
    <input placeholder="Nueva sala de chat" bind:value={nueva.chat} maxlength="40" />
    <button onclick={() => hacer(() => agregar('chat'))}>Crear sala de chat</button>
  {/if}

  <h3>Salas de voz</h3>
  <ul>{#each voz as r (r.id)}{@render sala(r, true)}{/each}</ul>
  {#if soyDueno}
    <input placeholder="Nueva sala de voz" bind:value={nueva.voz} maxlength="40" />
    <button onclick={() => hacer(() => agregar('voz'))}>Crear sala de voz</button>
  {/if}

  <Miembros {grupo} />
  {#if confirmar}
    <Confirmar texto={confirmar.texto} cancelar={() => (confirmar = null)}
      confirmar={() => { const c = confirmar!; confirmar = null; hacer(c.hacer); }} />
  {/if}
</section>
