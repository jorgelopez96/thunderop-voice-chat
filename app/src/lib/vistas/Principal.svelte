<script lang="ts">
    import { grupos, grupoActual, iniciarGrupos } from '../grupos.svelte';
  import Inicio from './Inicio.svelte';
  import MenuPerfil from './MenuPerfil.svelte';
  import Configuracion from './Configuracion.svelte';
  import { Settings, Zap } from '@lucide/svelte';
  import Grupo from './Grupo.svelte';
  import Dock from './Dock.svelte';
  import { voz } from '../voz.svelte';
  import { iniciarPresencia } from '../presencia.svelte';
  import { iniciarAmigos } from '../amigos.svelte';
  import { iniciarPrivados } from '../privados.svelte';
  import { iniciarNoLeidos } from '../noLeidos.svelte';
  import Campanita from './Campanita.svelte';
  import { ubicarReproductor } from '../musica/musica.svelte';

  $effect(iniciarGrupos);
  $effect(iniciarPresencia);
  $effect(iniciarAmigos);
  $effect(iniciarPrivados);
  $effect(iniciarNoLeidos);

  const actual = $derived(grupos.lista.find((g) => g.id === grupoActual.id));
  let config = $state(false);
  let hostMusica = $state<HTMLElement>();
  // El reproductor vive acá y no en la vista de la sala: cambiar de chat o de grupo no corta la música.
  $effect(() => {
    if (!hostMusica) return;
    ubicarReproductor(hostMusica);
    return () => ubicarReproductor(null);
  });

</script>

<main>
  <header class="barra">
    <h1><button class="plano logo" onclick={() => (grupoActual.id = null)} aria-label="Inicio"><Zap size={18} strokeWidth={1.75} /> THUNDEROP</button></h1>
    <Campanita />
    <button class="plano icono" aria-label="Configuración" title="Configuración" onclick={() => (config = true)}><Settings size={20} strokeWidth={1.75} /></button>
    <MenuPerfil />
  </header>
  {#if config}<Configuracion cerrar={() => (config = false)} />{/if}
  {#if voz.error}
    <p class="aviso" role="alert">{voz.error} <button class="plano" aria-label="Cerrar aviso" onclick={() => (voz.error = '')}>✕</button></p>
  {/if}

  {#if actual}
    {#key actual.id}
      <Grupo grupo={actual} volver={() => (grupoActual.id = null)} />
    {/key}
  {:else}
    <Inicio />
  {/if}
  {#if voz.salaId}<Dock />{/if}
  <div class="reproductor" bind:this={hostMusica}></div>
</main>

<style>
  main { height: 100%; display: flex; flex-direction: column; }
  .barra { display: flex; align-items: center; gap: 8px; padding: 0 12px; height: 48px; background: var(--fondo); border-bottom: 1px solid var(--borde); flex: none; }
  .barra h1 { margin-right: auto; }
  .logo { color: var(--acento); font-size: 14px; font-weight: 700; letter-spacing: .06em; gap: 8px; padding: 4px 0; }
  .logo:hover:not(:disabled) { color: var(--acento); background: none; }
  .icono { display: grid; place-items: center; padding: 6px; }
  .aviso { display: flex; align-items: center; gap: 8px; padding: 6px 12px; background: var(--hondo); border-top: 1px solid var(--hover); flex: none; }
  .aviso button { margin-left: auto; }
  /* Fuera de pantalla y no display:none: oculto, el iframe de YouTube puede dejar de sonar. */
  .reproductor { position: fixed; left: -10000px; top: 0; width: 240px; height: 135px; }
  .reproductor :global(iframe) { width: 100%; height: 100%; border: 0; }
</style>
