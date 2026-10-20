<script lang="ts">
  import { NOVEDADES } from '../novedades';
  let todas = $state(false);
  const visibles = $derived(todas ? NOVEDADES : NOVEDADES.slice(0, 2));
</script>

<section class="tarjeta">
  <h3>Novedades</h3>
  {#each visibles as n (n.version)}
    <h4>Versión {n.version} <small>{new Date(n.fecha + 'T12:00').toLocaleDateString('es', { day: 'numeric', month: 'long' })}</small></h4>
    <ul>
      {#each n.cambios as c, i (i)}
        <li><span class="chip" class:arreglo={c.tipo === 'arreglo'}>{c.tipo === 'nuevo' ? 'NUEVO' : 'ARREGLO'}</span> {c.texto}</li>
      {/each}
    </ul>
  {/each}
  {#if NOVEDADES.length > 2}<button class="plano" onclick={() => (todas = !todas)}>{todas ? 'Ver menos' : 'Ver todas'}</button>{/if}
</section>

<style>
  h3 { margin: 0 0 8px; font-size: 15px; }
  h4 { margin: 12px 0 6px; font-size: 13px; }
  small { color: var(--tenue); font-weight: 400; }
  ul { display: flex; flex-direction: column; gap: 6px; }
  li { font-size: 13px; }
  .chip { display: inline-block; font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 4px; margin-right: 4px;
    color: var(--acento); border: 1px solid var(--acento); }
  .arreglo { color: var(--ok); border-color: var(--ok); }
</style>
