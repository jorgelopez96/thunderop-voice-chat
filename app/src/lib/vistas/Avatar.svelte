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
  /* El anillo del punto toma el color de lo que hay detrás: cada contenedor puede poner --anillo. */
  .caja { position: relative; display: inline-block; flex: none; }
  .luz { position: absolute; right: -2px; bottom: -2px; width: clamp(8px, 34%, 11px); aspect-ratio: 1; box-sizing: content-box;
    border-radius: 50%; background: var(--anillo, var(--panel)); border: 2.5px solid var(--anillo, var(--panel)); }
  .desconectado { box-shadow: inset 0 0 0 2.5px var(--apagado); }
  .disponible { background: var(--ok); }
  .ausente { background: var(--ausente); }
  .ocupado { background: var(--peligro); }
  .ocupado::after { content: ''; position: absolute; inset: 42% 22%; border-radius: 1px; background: var(--anillo, var(--panel)); }
  /* Al hablar: anillo verde por opacidad (los dos modos) y, en moderno, un halo que crece apenas. */
  .caja::before, .caja::after { content: ''; position: absolute; inset: -2px; border-radius: 50%; opacity: 0; pointer-events: none;
    transition: opacity var(--dur-media) var(--curva-salida); }
  .caja::before { border: 2px solid var(--ok); }
  .hablando::before { opacity: 1; }
  :global([data-modo='moderno']) .caja::after { inset: -4px; box-shadow: 0 0 10px 1px color-mix(in srgb, var(--ok) 55%, transparent);
    transform: scale(.9); transition: opacity var(--dur-media) var(--curva-salida), transform var(--dur-media) var(--curva-salida); }
  :global([data-modo='moderno']) .hablando::after { opacity: 1; transform: scale(1); }
</style>
