<script lang="ts">
  import type { RecordModel } from 'pocketbase';
  import { pb } from '../pb';
  import { enLinea } from '../presencia.svelte';
  let { usuario, tam = 32 }: { usuario: RecordModel; tam?: number } = $props();
  const conectado = $derived(enLinea(usuario));
</script>

<span class="caja" style="width:{tam}px;height:{tam}px">
  {#if usuario.avatar}<img class="avatar" alt="" style="width:100%;height:100%" src={pb.files.getURL(usuario, usuario.avatar, { thumb: '64x64' })} />
  {:else}<span class="avatar" style="width:100%;height:100%;background:{usuario.color || ''}"></span>{/if}
  <span class="luz" class:conectado title={conectado ? 'Conectado' : 'Desconectado'}></span>
</span>

<style>
  .caja { position: relative; display: inline-block; flex: none; }
  .luz { position: absolute; right: -1px; bottom: -1px; width: 30%; height: 30%; min-width: 8px; min-height: 8px;
    border-radius: 50%; background: var(--tenue); border: 2px solid var(--panel); }
  .conectado { background: var(--ok); }
</style>
