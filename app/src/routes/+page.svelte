<script lang="ts">
  import '@fontsource-variable/inter';
  import '../app.css';
  import Entrar from '$lib/vistas/Entrar.svelte';
  import Principal from '$lib/vistas/Principal.svelte';
  import { onMount } from 'svelte';
  import { sesion, validarSesionAlIniciar } from '$lib/sesion.svelte';
  import { actualizacion, buscarActualizacion } from '$lib/actualizacion.svelte';
  import Actualizacion from '$lib/vistas/Actualizacion.svelte';

  onMount(validarSesionAlIniciar);
  onMount(buscarActualizacion);
</script>

{#if actualizacion.estado !== 'lista'}
  <Actualizacion />
{:else if !sesion.usuario}
  <Entrar />
{:else}
  <Principal />
{/if}
