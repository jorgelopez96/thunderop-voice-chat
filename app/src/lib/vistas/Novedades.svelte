<script lang="ts">
  import { NOVEDADES } from '../novedades';
  const ultima = NOVEDADES[0];
  const fecha = (f: string) => new Date(f + 'T12:00').toLocaleDateString('es', { day: 'numeric', month: 'long' });
</script>

{#if ultima}
  <section>
    <div class="encabezado"><h2>Novedades</h2><span class="version num">v{ultima.version} · {fecha(ultima.fecha)}</span></div>
    <ul class="tarjeta">
      {#each ultima.cambios as c, i (i)}
        <li><span class="chip" class:arreglo={c.tipo === 'arreglo'}>{c.tipo === 'nuevo' ? 'Nuevo' : 'Arreglo'}</span><span>{c.texto}</span></li>
      {/each}
    </ul>
  </section>
{/if}

<style>
  .version { color: var(--apagado); font-size: 13px; }
  .tarjeta { gap: 0; padding: 4px 16px; }
  li { display: grid; grid-template-columns: 72px 1fr; align-items: start; gap: 12px; padding: 12px 0; font-size: 13.5px; border-top: 1px solid var(--borde); }
  li:first-child { border-top: 0; }
  .chip { justify-self: start; font-size: 11.5px; font-weight: 600; padding: 2px 8px; border-radius: var(--radio-pildora);
    color: var(--acento-texto); background: var(--acento-suave); }
  .arreglo { color: var(--tenue); background: var(--hover-fuerte); }
</style>
