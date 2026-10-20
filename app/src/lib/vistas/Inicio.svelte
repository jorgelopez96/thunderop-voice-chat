<script lang="ts">
  import { onMount } from 'svelte';
  import { Plus } from '@lucide/svelte';
  import type { RecordModel } from 'pocketbase';
  import { pb } from '../pb';
  import { sesion, mensajeError } from '../sesion.svelte';
  import { grupos, grupoActual, crearGrupo, unirse } from '../grupos.svelte';
  import { amigos } from '../amigos.svelte';
  import { enLinea } from '../presencia.svelte';
  import { delGrupo } from '../noLeidos.svelte';
  import { foto } from '../foto';
  import Novedades from './Novedades.svelte';
  import Amigos from './Amigos.svelte';

  const yaCree = $derived(grupos.lista.some((g) => g.owner === sesion.usuario?.id));
  const conectados = $derived(amigos.lista.filter((a) => enLinea(a.usuario)).length);
  let version = $state('');
  onMount(() => { import('@tauri-apps/api/app').then((a) => a.getVersion()).then((v) => (version = v)).catch(() => {}); });

  // Quiénes están en voz en cada grupo (presencia del servidor), refrescado cada 15 s mientras se ve la portada.
  type EnVoz = { id: string; name: string };
  let enVozDe = $state<Record<string, EnVoz[]>>({});
  $effect(() => {
    const cargar = () => {
      for (const g of grupos.lista) pb.send(`/api/groups/${g.id}/voz`, {}).then((r: Record<string, EnVoz[]>) => (enVozDe[g.id] = Object.values(r).flat()), () => {});
    };
    cargar();
    const i = setInterval(cargar, 15_000);
    return () => clearInterval(i);
  });
  const ordenados = $derived([...grupos.lista].sort((a, b) => (enVozDe[b.id]?.length ?? 0) - (enVozDe[a.id]?.length ?? 0)));
  const esAmigo = (id: string) => amigos.lista.some((a) => a.usuario.id === id);
  const amigosEnVoz = $derived(grupos.lista.flatMap((g) => (enVozDe[g.id] ?? []).filter((p) => esAmigo(p.id)).map((p) => ({ nombre: p.name, grupo: g.name }))));
  const nombresEnVoz = $derived([...new Set(amigosEnVoz.map((a) => a.nombre))]);
  const gruposEnVoz = $derived([...new Set(amigosEnVoz.map((a) => a.grupo))]);
  const juntar = (n: string[]) => (n.length > 1 ? `${n.slice(0, -1).join(', ')} y ${n.at(-1)}` : n[0]);
  const miembro = (g: RecordModel, id: string) => ((g.expand?.members ?? []) as RecordModel[]).find((m) => m.id === id);
  // Degradé de un solo tono, derivado del nombre del grupo.
  const tono = (n: string) => [...n].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  const degrade = (n: string) => `linear-gradient(135deg, hsl(${tono(n)} 45% 35%), hsl(${tono(n)} 45% 25%))`;

  let agregando = $state(false); // "+" o el estado vacío abren crear / unirse
  let nombre = $state('');
  let codigo = $state('');
  let error = $state('');

  async function hacer(f: () => Promise<void>) {
    error = '';
    try { await f(); agregando = false; } catch (e) { error = e instanceof Error && !('status' in e) ? e.message : mensajeError(e); }
  }
</script>

<div class="inicio"><div class="columna">
  <header class="saludo">
    <h2>¡Hola, {sesion.usuario?.name}!</h2>
    {#if nombresEnVoz.length}
      <p><span class="verde">{juntar(nombresEnVoz)}</span> {nombresEnVoz.length > 1 ? 'están' : 'está'} en voz en {juntar(gruposEnVoz)}</p>
    {:else if amigos.lista.length}<p>{conectados} {conectados === 1 ? 'amigo conectado' : 'amigos conectados'}{version ? ` · v${version}` : ''}</p>
    {:else}<p>Thunderop{version ? ` v${version}` : ''}</p>{/if}
  </header>

  <section>
    <h3>Mis grupos</h3>
    {#if grupos.cargado && !grupos.lista.length}
      <div class="vacio">
        <p>Todavía no estás en ningún grupo. Creá uno para tus amigos o entrá con el código que te pasaron.</p>
        <div class="fila"><button class="primario" onclick={() => (agregando = true)}>Crear mi grupo</button><button onclick={() => (agregando = true)}>Unirme con código</button></div>
      </div>
    {:else}
      <div class="grupos">
        {#each ordenados as g (g.id)}
          {@const v = enVozDe[g.id] ?? []}
          <button class="grupo" onclick={() => (grupoActual.id = g.id)}>
            {#if g.foto}<img alt="" src={pb.files.getURL(g, g.foto, { thumb: '480x270' })} />
            {:else}<span class="portada" style="background:{degrade(g.name)}"></span>{/if}
            <span class="datos">
              <strong>{g.name}</strong>
              {#if delGrupo(g.id)}<span class="punto-nuevo" aria-label="Mensajes sin leer"></span>{/if}
              {#if v.length}
                <small class="verde"><span class="punto"></span>{v.length} en voz
                  <span class="pila">{#each v.slice(0, 3) as p (p.id)}{@const m = miembro(g, p.id)}
                    <span title={p.name} style="background:{m?.color || ''}"><img alt="" src={foto(m)} /></span>
                  {/each}</span></small>
              {:else}<small>{g.members.length} {g.members.length === 1 ? 'participante' : 'participantes'}</small>{/if}
            </span>
          </button>
        {/each}
        <button class="grupo nuevo" aria-label="Crear o unirme a un grupo" onclick={() => (agregando = !agregando)}><Plus size={20} strokeWidth={1.75} /> Crear o unirme</button>
      </div>
    {/if}

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
          <button type="submit">Unirme</button>
        </form>
        {#if error}<p role="alert">{error}</p>{/if}
      </div>
    {/if}
  </section>

  <div class="columnas">
    <Novedades />
    <Amigos enVoz={(id) => grupos.lista.find((g) => enVozDe[g.id]?.some((p) => p.id === id))?.name} />
  </div>
</div></div>

<style>
  .inicio { flex: 1; overflow: auto; }
  .columna { max-width: 960px; margin: 0 auto; padding: 32px; display: flex; flex-direction: column; gap: 40px; }
  .saludo h2 { font-size: 28px; font-weight: 600; }
  .saludo p { color: var(--tenue); margin: 4px 0 0; }
  .verde { color: var(--ok); }
  section h3 { margin: 0 0 12px; }
  .grupos { display: flex; gap: 16px; overflow-x: auto; padding-bottom: 4px; }
  .grupo { flex: none; width: 220px; height: 128px; padding: 0; flex-direction: column; align-items: stretch; justify-content: flex-start; gap: 0;
    background: var(--panel); border-radius: var(--radio-tarjeta); overflow: hidden; text-align: left; }
  .grupo > img, .portada { width: 100%; height: 64px; object-fit: cover; flex: none; }
  .datos { position: relative; flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 2px; padding: 0 12px; min-width: 0; }
  .datos strong { font-size: 15px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding-right: 12px; }
  .datos small { display: flex; align-items: center; gap: 6px; font-size: 12px; }
  .punto { width: 6px; height: 6px; border-radius: 999px; background: var(--ok); }
  .punto-nuevo { position: absolute; top: 14px; right: 12px; width: 8px; height: 8px; border-radius: 999px; background: var(--acento); }
  .pila { display: flex; margin-left: 4px; }
  .pila span { width: 22px; height: 22px; margin-left: -8px; border-radius: 999px; border: 2px solid var(--panel); display: grid; place-items: center;
    font-size: 10px; font-weight: 600; color: #fff; background: var(--hover); overflow: hidden; }
  .pila span:first-child { margin-left: 0; }
  .pila img { width: 100%; height: 100%; object-fit: cover; }
  .nuevo { flex-direction: row; align-items: center; justify-content: center; gap: 8px; color: var(--tenue); border: 1px dashed var(--punteado); background: none; }
  .vacio { display: flex; flex-direction: column; gap: 16px; padding: 24px; border: 1px dashed var(--punteado); border-radius: var(--radio-tarjeta); color: var(--tenue); }
  .vacio p { margin: 0; }
  .agregar { margin-top: 16px; max-width: 520px; }
  .agregar input { flex: 1; }
  .columnas { display: grid; grid-template-columns: 3fr 2fr; gap: 32px; align-items: start; }
  @media (max-width: 800px) { .columnas { grid-template-columns: 1fr; } }
</style>
