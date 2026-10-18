<script lang="ts">
  import type { RecordModel } from 'pocketbase';
  import { pb } from '../pb';
  import { sesion, mensajeError } from '../sesion.svelte';
  import { echar, salirDe } from '../grupos.svelte';
  import Confirmar from './Confirmar.svelte';

  let { grupo }: { grupo: RecordModel } = $props();
  const miembros = $derived((grupo.expand?.members ?? []) as RecordModel[]);
  const soyDueno = $derived(grupo.owner === sesion.usuario?.id);
  let aEchar = $state<RecordModel | null>(null);
  let error = $state('');

  async function hacer(f: () => Promise<void>) {
    error = '';
    try { await f(); } catch (e) { error = mensajeError(e); }
  }
</script>

<section>
  <h3>Miembros ({miembros.length})</h3>
  <ul>
    {#each miembros as m (m.id)}
      <li>
        {#if m.avatar}
          <img alt="" width="24" height="24" src={pb.files.getURL(m, m.avatar, { thumb: '64x64' })} />
        {/if}
        <strong style="color:{m.color || 'inherit'}">{m.name}</strong>
        {#if m.status}<small>{m.status}</small>{/if}
        {#if soyDueno && m.id !== grupo.owner}<button onclick={() => (aEchar = m)}>Echar</button>{/if}
      </li>
    {/each}
  </ul>
  {#if !soyDueno}<button onclick={() => hacer(() => salirDe(grupo.id))}>Salir del grupo</button>{/if}
  {#if error}<p role="alert" style="color:#c00">{error}</p>{/if}
  {#if aEchar}
    <Confirmar texto={`¿Echar a ${aEchar.name}?`} cancelar={() => (aEchar = null)}
      confirmar={() => { const m = aEchar!; aEchar = null; hacer(() => echar(grupo.id, m.id)); }} />
  {/if}
</section>
