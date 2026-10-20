<script lang="ts">
  import { onMount } from 'svelte';
  import { Plus } from '@lucide/svelte';
  import { pb } from '../pb';
  import { sesion, mensajeError } from '../sesion.svelte';
  import { grupos, grupoActual, crearGrupo, unirse } from '../grupos.svelte';
  import { amigos } from '../amigos.svelte';
  import { enLinea } from '../presencia.svelte';
  import Novedades from './Novedades.svelte';
  import Amigos from './Amigos.svelte';

  const yaCree = $derived(grupos.lista.some((g) => g.owner === sesion.usuario?.id));
  const conectados = $derived(amigos.lista.filter((a) => enLinea(a.usuario)).length);
  let version = $state('');
  onMount(() => { import('@tauri-apps/api/app').then((a) => a.getVersion()).then((v) => (version = v)).catch(() => {}); });

  let agregando = $state(false); // la tarjeta "+" abre crear / unirse
  let nombre = $state('');
  let codigo = $state('');
  let error = $state('');

  async function hacer(f: () => Promise<void>) {
    error = '';
    try { await f(); agregando = false; } catch (e) { error = e instanceof Error && !('status' in e) ? e.message : mensajeError(e); }
  }
</script>

<div class="inicio">
  <header class="saludo">
    <h2>¡Hola, {sesion.usuario?.name}!</h2>
    <p>{conectados} {conectados === 1 ? 'amigo conectado' : 'amigos conectados'}{version ? ` · Thunderop ${version}` : ''}</p>
  </header>

  <h3>Mis grupos</h3>
  <div class="grupos">
    {#each grupos.lista as g (g.id)}
      <button class="grupo" onclick={() => (grupoActual.id = g.id)}>
        {#if g.foto}<img alt="" src={pb.files.getURL(g, g.foto, { thumb: '480x270' })} />
        {:else}<span class="inicial">{g.name.slice(0, 1).toUpperCase()}</span>{/if}
        <strong>{g.name}</strong>
        <small>{g.members.length} {g.members.length === 1 ? 'participante' : 'participantes'}</small>
      </button>
    {/each}
    <button class="grupo nuevo" aria-label="Crear o unirme a un grupo" onclick={() => (agregando = !agregando)}><Plus size={32} strokeWidth={1.75} /></button>
  </div>
  {#if grupos.cargado && !grupos.lista.length}<p class="tenue">Todavía no estás en ningún grupo: tocá + para crear uno o unirte con un código.</p>{/if}

  {#if agregando}
    <div class="tarjeta agregar">
      {#if !yaCree}
        <form class="fila" onsubmit={(e) => { e.preventDefault(); hacer(async () => { await crearGrupo(nombre.trim()); nombre = ''; }); }}>
          <input bind:value={nombre} required maxlength="40" placeholder="Nombre del grupo nuevo" />
          <button type="submit" class="primario">Crear grupo</button>
        </form>
      {/if}
      <form class="fila" onsubmit={(e) => { e.preventDefault(); hacer(async () => { await unirse(codigo); codigo = ''; }); }}>
        <input bind:value={codigo} required placeholder="Código o link de invitación" />
        <button type="submit">Unirme con código</button>
      </form>
      {#if error}<p role="alert">{error}</p>{/if}
    </div>
  {/if}

  <div class="columnas">
    <Novedades />
    <Amigos />
  </div>
</div>

<style>
  .inicio { flex: 1; overflow: auto; padding: 24px; display: flex; flex-direction: column; gap: 12px; }
  .saludo h2 { margin: 0; font-size: 24px; }
  .saludo p, .tenue { color: var(--tenue); margin: 4px 0 0; }
  h3 { margin: 8px 0 0; font-size: 15px; }
  .grupos { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 4px; }
  .grupo { flex: none; width: 200px; display: flex; flex-direction: column; gap: 4px; padding: 0 0 10px; text-align: left;
    background: var(--panel); border-radius: 10px; overflow: hidden; }
  .grupo img, .inicial { width: 100%; aspect-ratio: 16 / 9; object-fit: cover; }
  .inicial { display: grid; place-items: center; font-size: 40px; font-weight: 700; color: #fff;
    background: linear-gradient(135deg, var(--acento), var(--azul)); }
  .grupo strong, .grupo small { padding: 0 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .grupo small { color: var(--tenue); }
  .nuevo { align-items: center; justify-content: center; padding: 0; min-height: 150px; color: var(--tenue); border: 2px dashed var(--borde); background: none; }
  .agregar { display: flex; flex-direction: column; gap: 8px; max-width: 520px; }
  .agregar input { flex: 1; }
  .columnas { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; align-items: start; }
</style>
