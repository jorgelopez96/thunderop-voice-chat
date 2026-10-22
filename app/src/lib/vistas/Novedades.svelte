<script lang="ts">
  import { NOVEDADES } from '../novedades';
  let todas = $state(false);
  const [ultima, ...anteriores] = NOVEDADES;
  const visibles = $derived(todas ? anteriores : anteriores.slice(0, 2));
  const fecha = (f: string) => new Date(f + 'T12:00').toLocaleDateString('es', { day: 'numeric', month: 'long' });
</script>

{#snippet cambios(n: (typeof NOVEDADES)[number])}
  <ul>
    {#each n.cambios as c, i (i)}
      <li><span class="chip" class:arreglo={c.tipo === 'arreglo'}>{c.tipo === 'nuevo' ? 'NUEVO' : 'ARREGLO'}</span><span>{c.texto}</span></li>
    {/each}
  </ul>
{/snippet}

<section>
  <h3>Novedades</h3>
  <div class="tarjeta">
    {#if ultima}
      <h4>v{ultima.version} · {fecha(ultima.fecha)}</h4>
      {@render cambios(ultima)}
    {/if}
    {#each visibles as n (n.version)}
      <details>
        <summary>v{n.version} · {fecha(n.fecha)} <small>{n.cambios.length} {n.cambios.length === 1 ? 'cambio' : 'cambios'}</small></summary>
        {@render cambios(n)}
      </details>
    {/each}
    {#if anteriores.length > 2}<button class="plano historial" onclick={() => (todas = !todas)}>{todas ? 'Ver menos' : 'Ver historial'}</button>{/if}
  </div>
</section>

<style>
  h3 { margin: 0 0 12px; }
  .tarjeta { gap: 8px; padding: 16px; }
  h4 { margin: 0 0 4px; font-size: 14px; font-weight: 600; }
  ul { display: flex; flex-direction: column; }
  li { display: flex; align-items: flex-start; gap: 12px; min-height: 36px; padding: 8px 0; font-size: 13px; border-top: 1px solid var(--borde); }
  li:first-child { border-top: 0; }
  .chip { flex: none; width: 64px; text-align: center; font-size: 11px; font-weight: 600; padding: 2px 0; border-radius: 999px;
    color: var(--acento-texto); background: var(--acento-suave); }
  .arreglo { color: var(--tenue); background: var(--hover); }
  details { border-top: 1px solid var(--borde); padding-top: 8px; }
  summary { cursor: pointer; font-size: 13px; color: var(--tenue); padding: 4px 0; }
  summary small { margin-left: 8px; color: var(--apagado); }
  .historial { align-self: flex-start; color: var(--acento); padding: 4px 0; }
</style>
