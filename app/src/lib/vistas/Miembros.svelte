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

<aside class="miembros">
  <h3>Miembros — {miembros.length}</h3>
  <ul>
    {#each miembros as m (m.id)}
      <li>
        {#if m.avatar}<img class="avatar" alt="" src={pb.files.getURL(m, m.avatar, { thumb: '64x64' })} />
        {:else}<span class="avatar" style="background:{m.color || ''}"></span>{/if}
        <div class="quien">
          <strong style="color:{m.color || 'inherit'}">{m.name}{m.id === grupo.owner ? ' 👑' : ''}</strong>
          {#if m.status}<small>{m.status}</small>{/if}
        </div>
        {#if soyDueno && m.id !== grupo.owner}<button class="plano" onclick={() => (aEchar = m)}>Echar</button>{/if}
      </li>
    {/each}
  </ul>
  {#if !soyDueno}<button class="plano" onclick={() => hacer(() => salirDe(grupo.id))}>Salir del grupo</button>{/if}
  {#if error}<p role="alert">{error}</p>{/if}
  {#if aEchar}
    <Confirmar texto={`¿Echar a ${aEchar.name}?`} cancelar={() => (aEchar = null)}
      confirmar={() => { const m = aEchar!; aEchar = null; hacer(() => echar(grupo.id, m.id)); }} />
  {/if}
</aside>

<style>
  .miembros { background: var(--panel); padding: 0 8px 12px; overflow-y: auto; }
  li { display: flex; align-items: center; gap: 8px; padding: 4px 6px; border-radius: var(--radio); }
  li:hover { background: var(--hover); }
  .quien { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .quien > * { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
