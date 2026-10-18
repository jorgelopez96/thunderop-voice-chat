<script lang="ts">
  import { sesion, salir, mensajeError } from '../sesion.svelte';
  import { grupos, grupoActual, iniciarGrupos, crearGrupo, unirse } from '../grupos.svelte';
  import Perfil from './Perfil.svelte';
  import Grupo from './Grupo.svelte';

  $effect(iniciarGrupos);

  const yaCree = $derived(grupos.lista.some((g) => g.owner === sesion.usuario?.id));
  const actual = $derived(grupos.lista.find((g) => g.id === grupoActual.id));
  let nombre = $state('');
  let creando = $state(false);
  let codigo = $state('');
  let uniendo = $state(false);
  let verPerfil = $state(false);
  let error = $state('');

  async function hacer(f: () => Promise<void>) {
    error = '';
    try { await f(); } catch (e) { error = e instanceof Error && !('status' in e) ? e.message : mensajeError(e); }
  }
</script>

<main>
  <header>
    <h1>Discord mejorado</h1>
    <button onclick={() => (verPerfil = !verPerfil)}>Mi perfil</button>
    <button onclick={salir}>Salir</button>
  </header>
  {#if verPerfil}<Perfil />{/if}

  {#if actual}
    {#key actual.id}
      <Grupo grupo={actual} volver={() => (grupoActual.id = null)} />
    {/key}
  {:else}
    <h2>Mis grupos</h2>
    <ul>
      {#each grupos.lista as g (g.id)}
        <li><button onclick={() => (grupoActual.id = g.id)}>{g.name}</button></li>
      {/each}
    </ul>
    {#if grupos.cargado && !grupos.lista.length}<p>Todavía no estás en ningún grupo.</p>{/if}

    {#if !yaCree}
      {#if creando}
        <form onsubmit={(e) => { e.preventDefault(); hacer(async () => { await crearGrupo(nombre.trim()); nombre = ''; creando = false; }); }}>
          <input bind:value={nombre} required maxlength="40" placeholder="Nombre del grupo" />
          <button type="submit">Crear</button>
          <button type="button" onclick={() => (creando = false)}>Cancelar</button>
        </form>
      {:else}
        <button onclick={() => (creando = true)}>Crear grupo</button>
      {/if}
    {/if}

    {#if uniendo}
      <form onsubmit={(e) => { e.preventDefault(); hacer(async () => { await unirse(codigo); codigo = ''; uniendo = false; }); }}>
        <input bind:value={codigo} required placeholder="Código o link de invitación" />
        <button type="submit">Unirme</button>
        <button type="button" onclick={() => (uniendo = false)}>Cancelar</button>
      </form>
    {:else}
      <button onclick={() => (uniendo = true)}>Unirme con código</button>
    {/if}
    {#if error}<p role="alert" style="color:#c00">{error}</p>{/if}
  {/if}
</main>
