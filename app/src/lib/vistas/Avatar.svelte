<script lang="ts">
  import type { RecordModel } from 'pocketbase';
  import { foto } from '../foto';
  import { estado } from '../presencia.svelte';
  let { usuario, tam = 32, hablando = false }: { usuario: RecordModel; tam?: number; hablando?: boolean } = $props();
  const e = $derived(estado(usuario));
  const TITULOS = { disponible: 'Disponible', ausente: 'Ausente', ocupado: 'Ocupado', desconectado: 'Desconectado' };
</script>

<span class="caja" class:hablando style="width:{tam}px;height:{tam}px">
  <img class="avatar" alt="" style="width:100%;height:100%" src={foto(usuario)} />
  <span class="luz {e}" title={TITULOS[e]}></span>
</span>

<style>
  .caja { position: relative; display: inline-block; flex: none; }
  .luz { position: absolute; right: -1px; bottom: -1px; width: 30%; height: 30%; min-width: 8px; min-height: 8px;
    border-radius: 50%; background: var(--apagado); border: 2px solid var(--panel); }
  .caja > :global(.avatar) { transition: box-shadow .12s; }
  .hablando > :global(.avatar) { box-shadow: 0 0 0 2px var(--ok); }
  .disponible { background: var(--ok); }
  .ausente { background: var(--ausente); }
  .ocupado { background: var(--peligro); }
</style>
