<script lang="ts">
  import '@fontsource-variable/inter';
  import '../app.css';
  import Entrar from '$lib/vistas/Entrar.svelte';
  import Principal from '$lib/vistas/Principal.svelte';
  import { onMount } from 'svelte';
  import { sesion, validarSesionAlIniciar } from '$lib/sesion.svelte';
  import { actualizacion, buscarActualizacion } from '$lib/actualizacion.svelte';
  import Actualizacion from '$lib/vistas/Actualizacion.svelte';
  import { voz } from '$lib/voz.svelte';

  onMount(validarSesionAlIniciar);
  onMount(() => {
    buscarActualizacion();
    // Con la bandeja la app casi no se reabre: se vuelve a buscar cada hora, pero nunca en plena llamada.
    const t = setInterval(() => { if (!voz.salaId) buscarActualizacion(true); }, 60 * 60_000);
    return () => clearInterval(t);
  });
</script>

{#if actualizacion.estado !== 'lista'}
  <Actualizacion />
{:else if !sesion.usuario}
  <Entrar />
{:else}
  <Principal />
{/if}
