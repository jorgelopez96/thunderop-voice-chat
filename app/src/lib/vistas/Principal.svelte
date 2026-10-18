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
  <header class="barra">
    <h1>Discord mejorado</h1>
    <span class="yo" style="color:{sesion.usuario?.color || 'inherit'}">{sesion.usuario?.name}</span>
    <button class="plano" onclick={() => (verPerfil = !verPerfil)}>Mi perfil</button>
    <button class="plano" onclick={salir}>Salir</button>
  </header>
  {#if verPerfil}<div class="perfil"><Perfil /></div>{/if}

  {#if actual}
    {#key actual.id}
      <Grupo grupo={actual} volver={() => (grupoActual.id = null)} />
    {/key}
  {:else}
    <div class="inicio"><div class="tarjeta">
    <h2>Mis grupos</h2>
    <ul class="grupos">
      {#each grupos.lista as g (g.id)}
        <li><button onclick={() => (grupoActual.id = g.id)}>{g.name}</button></li>
      {/each}
    </ul>
    {#if grupos.cargado && !grupos.lista.length}<p>Todavía no estás en ningún grupo.</p>{/if}

    {#if !yaCree}
      {#if creando}
        <form class="fila" onsubmit={(e) => { e.preventDefault(); hacer(async () => { await crearGrupo(nombre.trim()); nombre = ''; creando = false; }); }}>
          <input bind:value={nombre} required maxlength="40" placeholder="Nombre del grupo" />
          <button type="submit">Crear</button>
          <button type="button" onclick={() => (creando = false)}>Cancelar</button>
        </form>
      {:else}
        <button class="primario" onclick={() => (creando = true)}>Crear grupo</button>
      {/if}
    {/if}

    {#if uniendo}
      <form class="fila" onsubmit={(e) => { e.preventDefault(); hacer(async () => { await unirse(codigo); codigo = ''; uniendo = false; }); }}>
        <input bind:value={codigo} required placeholder="Código o link de invitación" />
        <button type="submit">Unirme</button>
        <button type="button" onclick={() => (uniendo = false)}>Cancelar</button>
      </form>
    {:else}
      <button onclick={() => (uniendo = true)}>Unirme con código</button>
    {/if}
    {#if error}<p role="alert">{error}</p>{/if}
    </div></div>
  {/if}
</main>

<style>
  main { height: 100%; display: flex; flex-direction: column; }
  .barra { display: flex; align-items: center; gap: 8px; padding: 0 12px; height: 44px; background: var(--hondo); flex: none; }
  .barra h1 { font-size: 15px; margin-right: auto; }
  .yo { font-weight: 600; }
  .perfil { position: fixed; top: 52px; right: 12px; z-index: 10; width: 320px; box-shadow: 0 8px 24px rgb(0 0 0 / .5); border-radius: 10px; }
  .inicio { flex: 1; display: grid; place-items: center; padding: 16px; overflow: auto; }
  .tarjeta { width: min(420px, 100%); }
  .grupos { display: flex; flex-direction: column; gap: 6px; }
  .grupos button { width: 100%; text-align: left; background: var(--hover); padding: 10px 12px; }
  form.fila input { flex: 1; }
</style>
