<script lang="ts">
  import '../app.css';
  import Entrar from '$lib/vistas/Entrar.svelte';
  import Principal from '$lib/vistas/Principal.svelte';
  import { onMount } from 'svelte';
  import { sesion, validarSesionAlIniciar } from '$lib/sesion.svelte';
  import { check } from '@tauri-apps/plugin-updater';

  onMount(validarSesionAlIniciar);
  // Al abrir, si el servidor tiene una versión nueva se instala sola (Windows cierra la app y la reabre).
  if (!import.meta.env.DEV) onMount(() => { check().then((u) => u?.downloadAndInstall()).catch(console.error); });
</script>

{#if !sesion.usuario}
  <Entrar />
{:else}
  <Principal />
{/if}
