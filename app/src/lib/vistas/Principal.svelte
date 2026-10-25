<script lang="ts">
  import LogoThunderop from './LogoThunderop.svelte';
  import BarraTitulo from './BarraTitulo.svelte';
  import Amigos from './Amigos.svelte';
  import Pestanas from './movil/Pestanas.svelte';
  import PerfilMovil from './movil/PerfilMovil.svelte';
  import { pantalla } from '../plataforma.svelte';
  import { navMovil, conAtras } from '../navMovil.svelte';
  import { grupos, grupoActual, iniciarGrupos, miga } from '../grupos.svelte';
  import Inicio from './Inicio.svelte';
  import MenuPerfil from './MenuPerfil.svelte';
  import Configuracion from './Configuracion.svelte';
  import { Settings } from '@lucide/svelte';
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
  // Celular: entrar a un grupo deja una capa en el historial (atrás vuelve a la pestaña).
  let grupoPrevio: string | null = null;
  $effect(() => {
    const id = grupoActual.id;
    if (pantalla.movil && id && !grupoPrevio) conAtras(() => (grupoActual.id = null));
    grupoPrevio = id;
  });
  let hostMusica = $state<HTMLElement>();
  // El reproductor vive acá y no en la vista de la sala: cambiar de chat o de grupo no corta la música.
  $effect(() => {
    if (!hostMusica) return;
    ubicarReproductor(hostMusica);
    return () => ubicarReproductor(null);
  });

</script>

<main>
  {#if pantalla.movil}
    <!-- Celular: afuera, barra simple arriba y pestañas abajo; adentro de un grupo, la cabecera del chat o la sala. -->
    {#if !actual}<header class="barra-movil"><LogoThunderop /><Campanita /></header>{/if}
  {:else}
  <BarraTitulo>
    <h1><button class="plano logo" onclick={() => (grupoActual.id = null)} aria-label="Inicio"><LogoThunderop /></button></h1>
    <div class="libre" data-tauri-drag-region>
      {#if actual && miga.sala}<span class="miga"><b>{actual.name}</b> › {miga.voz ? `${miga.sala} · sala de voz` : `# ${miga.sala}`}</span>{/if}
    </div>
    <Campanita />
    <button class="plano icono engranaje" aria-label="Configuración" title="Configuración" onclick={() => (config = true)}><Settings size={20} strokeWidth={1.75} /></button>
    <MenuPerfil />
  </BarraTitulo>
  {/if}
  {#if config}<Configuracion cerrar={() => (config = false)} />{/if}
  {#if voz.error}
    <p class="aviso" role="alert">{voz.error} <button class="plano" aria-label="Cerrar aviso" onclick={() => (voz.error = '')}>✕</button></p>
  {/if}

  {#if actual}
    {#key actual.id}
      <Grupo grupo={actual} volver={() => (grupoActual.id = null)} />
    {/key}
  {:else if pantalla.movil}
    {#if navMovil.pestana === 'grupos'}<Inicio vista="grupos" />
    {:else if navMovil.pestana === 'amigos'}<Amigos />
    {:else if navMovil.pestana === 'perfil'}<PerfilMovil abrirConfig={() => (config = true)} />
    {:else}<Inicio />{/if}
  {:else}
    <Inicio />
  {/if}
  {#if voz.salaId}<Dock />{/if}
  {#if pantalla.movil && !actual}<Pestanas />{/if}
  <div class="reproductor" bind:this={hostMusica}></div>
</main>

<style>
  main { height: 100%; display: flex; flex-direction: column; }
  .barra-movil { flex: none; display: flex; align-items: center; justify-content: space-between; height: calc(52px + env(safe-area-inset-top));
    padding: env(safe-area-inset-top) 8px 0 16px; background: var(--fondo); border-bottom: 1px solid var(--borde); }
  .logo { padding: 0 8px; min-height: 36px; border-radius: var(--radio); }
  .miga { padding-left: 12px; font-size: 13px; color: var(--tenue); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .miga b { color: var(--texto); font-weight: 600; }
  /* Modo moderno: el rayo parpadea y el engranaje gira un diente (60°, queda igual que en reposo). */
  :global([data-modo='moderno']) .logo:hover :global(svg) { animation: relampago 380ms linear; }
  @keyframes relampago { 25% { opacity: .3; } 50% { opacity: 1; } 75% { opacity: .55; } }
  :global([data-modo='moderno']) .engranaje :global(svg) { transition: transform 420ms var(--curva-salida); }
  :global([data-modo='moderno']) .engranaje:hover :global(svg) { transform: rotate(60deg); }
  .aviso { display: flex; align-items: center; gap: 8px; padding: 6px 12px; background: var(--hondo); border-top: 1px solid var(--hover); flex: none; }
  .aviso button { margin-left: auto; }
  /* Fuera de pantalla y no display:none: oculto, el iframe de YouTube puede dejar de sonar. */
  .reproductor { position: fixed; left: -10000px; top: 0; width: 240px; height: 135px; }
  .reproductor :global(iframe) { width: 100%; height: 100%; border: 0; }
</style>
