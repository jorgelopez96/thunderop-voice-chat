<script lang="ts">
  import { Plus, Search, Volume2, Hash, UserPlus, Users } from '@lucide/svelte';
  import type { RecordModel } from 'pocketbase';
  import { pb } from '../pb';
  import { sesion, mensajeError } from '../sesion.svelte';
  import { grupos, grupoActual, crearGrupo, unirse } from '../grupos.svelte';
  import { voz, entrarVoz } from '../voz.svelte';
  import { delGrupo } from '../noLeidos.svelte';
  import { resumen } from '../notificaciones.svelte';
  import { horaDe } from '../hora.svelte';
  import Avatar from './Avatar.svelte';
  import Amigos from './Amigos.svelte';
  import Invitar from './Invitar.svelte';
  import Novedades from './Novedades.svelte';
  import { NOVEDADES } from '../novedades';

  // Inicio de la PC: grupos a la izquierda, vista previa del grupo marcado al centro y amigos a la derecha.
  type Persona = { id: string; name: string };
  let enVozDe = $state<Record<string, Record<string, Persona[]>>>({});
  $effect(() => {
    const cargar = () => {
      for (const g of grupos.lista) pb.send(`/api/groups/${g.id}/voz`, {}).then((r: Record<string, Persona[]>) => { enVozDe[g.id] = r; }, () => {});
    };
    cargar();
    const i = setInterval(cargar, 15_000);
    return () => clearInterval(i);
  });

  // Salas de todos mis grupos (nombres y la primera de voz de cada uno).
  let salas = $state<RecordModel[]>([]);
  $effect(() => {
    if (!grupos.lista.length) return;
    pb.collection('rooms').getFullList({ fields: 'id,name,kind,group', sort: 'position' }).then((r) => (salas = r), () => {});
  });
  const nombreSala = (id: string) => salas.find((s) => s.id === id)?.name ?? 'Sala de voz';

  // Último mensaje de cada grupo (para la lista) y los tres últimos del grupo marcado.
  let ultimo = $state<Record<string, RecordModel | null>>({});
  let charla = $state<RecordModel[]>([]);
  const deGrupo = (g: string) => ({ filter: pb.filter('room.group = {:g}', { g }), sort: '-created', expand: 'author,room', requestKey: null });
  const cargarUltimo = (g: string) => pb.collection('messages').getList(1, 1, deGrupo(g)).then((r) => { ultimo[g] = r.items[0] ?? null; }, () => {});
  const cargarCharla = (g: string) => pb.collection('messages').getList(1, 3, deGrupo(g)).then((r) => { if (marcado?.id === g) charla = r.items.reverse(); }, () => {});
  $effect(() => { for (const g of grupos.lista) if (!(g.id in ultimo)) { ultimo[g.id] = null; cargarUltimo(g.id); } });
  $effect(() => {
    const sub = pb.collection('messages').subscribe('*', (e) => {
      if (e.action !== 'create') return;
      const g = salas.find((s) => s.id === e.record.room)?.group;
      if (!g) return;
      cargarUltimo(g);
      if (g === marcado?.id) cargarCharla(g);
    });
    return () => { sub.then((f) => f()).catch(() => {}); };
  });

  const gente = (g: string) => Object.values(enVozDe[g] ?? {}).flat();
  const salaConGente = (g: string) => Object.entries(enVozDe[g] ?? {}).find(([, p]) => p.length);
  const miembro = (g: RecordModel, id: string) => ((g.expand?.members ?? []) as RecordModel[]).find((m) => m.id === id);
  const tono = (n: string) => [...n].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  const degrade = (n: string) => `linear-gradient(135deg, hsl(${tono(n)} 45% 38%), hsl(${tono(n)} 45% 24%))`;
  const cuando = (f: string) => {
    const d = new Date(f.replace(' ', 'T'));
    return d.toDateString() === new Date().toDateString() ? horaDe(f) : d.toLocaleDateString('es', { day: 'numeric', month: 'short' });
  };

  let buscar = $state('');
  let filtro = $state<'todos' | 'voz' | 'leer'>('todos');
  const ordenados = $derived([...grupos.lista].sort((a, b) => gente(b.id).length - gente(a.id).length));
  const visibles = $derived(ordenados.filter((g) => g.name.toLowerCase().includes(buscar.trim().toLowerCase())
    && (filtro === 'todos' || (filtro === 'voz' ? gente(g.id).length : delGrupo(g.id)))));
  let elegido = $state<string | null>(null);
  const marcado = $derived(visibles.find((g) => g.id === elegido) ?? visibles[0]);
  $effect(() => { if (marcado) { charla = []; cargarCharla(marcado.id); } });

  function mover(e: KeyboardEvent) {
    if ((e.key !== 'ArrowDown' && e.key !== 'ArrowUp') || !marcado || (e.target as HTMLElement).closest('input, textarea, [contenteditable], dialog')) return;
    e.preventDefault();
    const i = visibles.indexOf(marcado);
    elegido = visibles[(i + (e.key === 'ArrowDown' ? 1 : -1) + visibles.length) % visibles.length].id;
  }

  async function entrar(g: RecordModel, sala: string) {
    if (voz.salaId !== sala) await entrarVoz(sala, nombreSala(sala), g.id);
    grupoActual.id = g.id;
  }

  let agregando = $state(false);
  let invitando = $state(false);
  let nombre = $state('');
  let codigo = $state('');
  let error = $state('');
  async function hacer(f: () => Promise<void>) {
    error = '';
    try { await f(); agregando = false; } catch (e) { error = e instanceof Error && !('status' in e) ? e.message : mensajeError(e); }
  }
</script>

<svelte:window onkeydown={mover} />

{#snippet icono(g: RecordModel, grande = false)}
  <span class="ig" class:grande>
    {#if g.foto}<img alt="" src={pb.files.getURL(g, g.foto, { thumb: '100x100' })} />
    {:else}<span class="letra" style="background:{degrade(g.name)}">{g.name.slice(0, 1).toUpperCase()}</span>{/if}
    {#if gente(g.id).length}<span class="en-voz" aria-label="Hay gente en voz"><Volume2 size={10} strokeWidth={2.5} /></span>{/if}
  </span>
{/snippet}

{#snippet formulario()}
  <div class="agregar">
    <form class="fila-form" onsubmit={(e) => { e.preventDefault(); hacer(async () => { await crearGrupo(nombre.trim()); nombre = ''; }); }}>
      <input bind:value={nombre} required maxlength="40" placeholder="Nombre del grupo nuevo" />
      <button type="submit">Crear grupo</button>
    </form>
    <form class="fila-form" onsubmit={(e) => { e.preventDefault(); hacer(async () => { await unirse(codigo); codigo = ''; }); }}>
      <input bind:value={codigo} required placeholder="Código o link de invitación" />
      <button class="primario">Unirme</button>
    </form>
    {#if error}<p role="alert">{error}</p>{/if}
  </div>
{/snippet}

<div class="paneles">
  <aside class="panel izq">
    <header>
      <div class="titulo"><h2>¡Hola, {sesion.usuario?.name}!</h2>
        <button class="icono" aria-label="Crear o unirme a un grupo" title="Crear o unirme" aria-pressed={agregando} onclick={() => (agregando = !agregando)}><Plus size={18} strokeWidth={1.75} /></button></div>
      {#if agregando && grupos.lista.length}{@render formulario()}{/if}
      {#if grupos.lista.length}
        <label class="buscar"><Search size={16} strokeWidth={1.75} /><input bind:value={buscar} placeholder="Buscar grupos" aria-label="Buscar grupos" /></label>
        <div class="filtros" role="group" aria-label="Filtrar grupos">
          <button aria-pressed={filtro === 'todos'} onclick={() => (filtro = 'todos')}>Todos</button>
          <button aria-pressed={filtro === 'voz'} onclick={() => (filtro = 'voz')}>En voz<span class="n num">{grupos.lista.filter((g) => gente(g.id).length).length}</span></button>
          <button aria-pressed={filtro === 'leer'} onclick={() => (filtro = 'leer')}>Sin leer<span class="n num">{grupos.lista.filter((g) => delGrupo(g.id)).length}</span></button>
        </div>
      {/if}
    </header>
    <div class="lista" role="listbox" aria-label="Grupos">
      {#each visibles as g (g.id)}
        {@const s = salaConGente(g.id)}
        {@const u = ultimo[g.id]}
        {@const n = delGrupo(g.id)}
        <button class="fila" role="option" aria-selected={g.id === marcado?.id} onclick={() => (elegido = g.id)} ondblclick={() => (grupoActual.id = g.id)}>
          {@render icono(g)}
          <span class="t"><b>{g.name}</b>
            {#if s}<small class="verde">{s[1][0].name}{s[1].length > 1 ? ` y ${s[1].length - 1} más` : ''} en {nombreSala(s[0])}</small>
            {:else if u}<small>{u.expand?.author?.name ?? 'Alguien'}: {resumen(u)}</small>
            {:else}<small>{g.descripcion || 'Sin mensajes todavía'}</small>{/if}</span>
          <span class="lado">{#if u}<time class="num">{cuando(u.created)}</time>{/if}
            {#if n}<span class="contador num" aria-label="{n} sin leer">{n}</span>{/if}</span>
        </button>
      {:else}
        {#if grupos.lista.length}<p class="nada">Ningún grupo coincide.</p>{/if}
      {/each}
    </div>
  </aside>

  <main class="panel centro">
    {#if grupos.cargado && !grupos.lista.length}
      <section class="vacio">
        <span class="vacio-icono"><Users size={28} strokeWidth={1.75} /></span>
        <h2>Todavía no estás en ningún grupo</h2>
        <p>Creá uno para tus amigos o entrá con el código de invitación que te pasaron.</p>
        <div class="fila-form"><button class="primario" onclick={() => (agregando = true)}>Crear mi grupo</button><button onclick={() => (agregando = true)}>Unirme con código</button></div>
        {#if agregando}{@render formulario()}{/if}
      </section>
    {:else if marcado}
      {@const g = marcado}
      {@const s = salaConGente(g.id)}
      {@const primeraVoz = salas.find((x) => x.group === g.id && x.kind === 'voz')}
      <div class="heroe" style="--h:{tono(g.name)}">
        {@render icono(g, true)}
        <div class="nombre"><h2>{g.name}</h2><p>{g.descripcion ? `${g.descripcion} · ` : ''}{(g.members ?? []).length} miembros</p></div>
        <div class="botones"><button onclick={() => (invitando = true)}><UserPlus size={16} strokeWidth={1.75} /> Invitar</button>
          <button class="primario" onclick={() => (grupoActual.id = g.id)}>Abrir el grupo</button></div>
      </div>

      <section class="sec">
        {#if s}
          {@const mia = voz.salaId === s[0]}
          {@const quienes = mia ? voz.participantes.map((p) => ({ id: p.id, name: p.nombre, hablando: p.hablando, transmite: p.transmite })) : s[1].map((p) => ({ ...p, hablando: false, transmite: false }))}
          <h3><span class="vivo"></span>En voz en {nombreSala(s[0])}
            <button class="primario" onclick={() => entrar(g, s[0])}><Volume2 size={16} strokeWidth={1.75} /> {mia ? 'Ir a la sala' : 'Entrar'}</button></h3>
          <div class="mosaico">
            {#each quienes as p (p.id)}
              {@const m = miembro(g, p.id)}
              {#if p.transmite}
                <div class="baldosa pantalla"><span class="tag">En vivo</span>
                  <span class="quien">{#if m}<Avatar usuario={m} tam={18} />{/if}{p.name} está transmitiendo</span></div>
              {:else}
                <div class="baldosa" class:habla={p.hablando} style="--c:{m?.color || 'var(--acento)'}">
                  {#if m}<Avatar usuario={m} tam={64} hablando={p.hablando} />{/if}<span class="quien">{p.name}</span></div>
              {/if}
            {/each}
            {#if !mia}<button class="baldosa libre" onclick={() => entrar(g, s[0])}><Plus size={18} strokeWidth={1.75} /> Tu lugar</button>{/if}
          </div>
        {:else}
          <h3>Salas de voz</h3>
          <div class="nadie">Nadie está en voz en este grupo ahora.
            {#if primeraVoz}<button onclick={() => entrar(g, primeraVoz.id)}>Entrar a {primeraVoz.name}</button>{/if}</div>
        {/if}
      </section>

      {#if charla.length}
        <section class="sec"><h3>Charla reciente</h3>
          <button class="mensajes" onclick={() => (grupoActual.id = g.id)}>
            {#each charla as m (m.id)}
              {@const a = m.expand?.author}
              <span class="m">{#if a}<Avatar usuario={a} tam={36} />{/if}
                <span><b style="color:{a?.color || 'var(--texto)'}">{a?.name ?? 'Alguien'}</b><span class="donde"><Hash size={12} strokeWidth={2} />{m.expand?.room?.name}</span><time class="num">{cuando(m.created)}</time>
                  <span class="texto">{resumen(m)}</span></span></span>
            {/each}
          </button>
        </section>
      {/if}
      {#if NOVEDADES[0]}<details class="sec novedades"><summary>Novedades de la versión {NOVEDADES[0].version}</summary><Novedades /></details>{/if}
    {/if}
  </main>

  <div class="panel der"><Amigos /></div>
</div>

{#if invitando && marcado}<Invitar grupo={marcado} cerrar={() => (invitando = false)} />{/if}

<style>
  .paneles { flex: 1; min-height: 0; display: grid; grid-template-columns: 330px minmax(0, 1fr) 280px; gap: 8px; padding: 8px; background: var(--hondo); }
  .panel { min-height: 0; display: flex; flex-direction: column; overflow: hidden; background: var(--panel); border: 1px solid var(--borde); border-radius: 18px; }
  .der :global(.amigos) { border-left: 0; }

  .izq header { padding: 16px 16px 10px; display: flex; flex-direction: column; gap: 12px; }
  .titulo { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding-left: 4px; }
  .titulo h2 { font-size: 18px; font-weight: 720; letter-spacing: -.015em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .buscar { flex-direction: row; align-items: center; gap: 8px; height: 38px; padding: 0 12px; border-radius: 10px; background: var(--hondo); border: 1px solid var(--borde); color: var(--apagado); }
  .buscar:focus-within { border-color: var(--acento-borde); }
  .buscar input { flex: 1; min-width: 0; padding: 0; border: 0; background: none; outline: none; }
  .filtros { display: flex; gap: 6px; }
  .filtros button { height: 30px; min-height: 0; padding: 0 12px; border-radius: 999px; background: none; color: var(--tenue); font-size: 12.5px; font-weight: 600; }
  .filtros button[aria-pressed='true'] { background: var(--texto); border-color: transparent; color: var(--fondo); }
  .filtros .n { margin-left: -4px; opacity: .6; }
  .agregar { display: flex; flex-direction: column; gap: 8px; }
  .fila-form { display: flex; gap: 8px; }
  .fila-form input { flex: 1; min-width: 0; }

  .lista { flex: 1; overflow-y: auto; padding: 4px 8px 12px; }
  .fila { width: 100%; display: grid; grid-template-columns: 46px 1fr auto; gap: 12px; align-items: center; padding: 10px; border: 0; border-radius: 14px; background: none; text-align: left; }
  .fila:hover:not(:disabled) { background: var(--hover); }
  .fila[aria-selected='true'], .fila[aria-selected='true']:hover:not(:disabled) { background: var(--elevado); box-shadow: inset 0 0 0 1px var(--borde-fuerte); }
  .ig { position: relative; width: 46px; height: 46px; flex: none; --borde-icono: var(--panel); }
  .fila[aria-selected='true'] .ig { --borde-icono: var(--elevado); }
  .ig img, .letra { width: 100%; height: 100%; border-radius: 15px; object-fit: cover; display: grid; place-items: center; color: #fff; font-size: 18px; font-weight: 750; }
  .en-voz { position: absolute; right: -4px; bottom: -4px; width: 18px; height: 18px; border-radius: 50%; display: grid; place-items: center;
    background: var(--ok); color: var(--fondo); border: 3px solid var(--borde-icono); box-sizing: content-box; }
  .fila .t { min-width: 0; display: flex; flex-direction: column; }
  .fila b { font-weight: 650; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .fila small { font-size: 12.5px; color: var(--apagado); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .verde { color: var(--ok) !important; }
  .lado { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; font-size: 11.5px; color: var(--apagado); }
  .contador { min-width: 20px; height: 20px; padding: 0 6px; border-radius: 999px; display: grid; place-items: center; background: var(--acento); color: var(--sobre-acento); font-size: 11.5px; font-weight: 750; }
  .nada { padding: 16px 12px; color: var(--apagado); font-size: 13px; }

  .centro { overflow-y: auto; }
  .heroe { flex: none; display: flex; align-items: center; gap: 18px; padding: 28px 28px 22px;
    background: radial-gradient(90% 160% at 0% 0%, hsl(var(--h) 55% 30% / .85), transparent 65%), radial-gradient(60% 120% at 100% 0%, color-mix(in srgb, var(--acento) 22%, transparent), transparent 70%); }
  .ig.grande { width: 64px; height: 64px; --borde-icono: var(--panel); }
  .ig.grande img, .ig.grande .letra { border-radius: 20px; font-size: 26px; box-shadow: 0 8px 24px -6px rgb(0 0 0 / .6); }
  .nombre { min-width: 0; }
  .nombre h2 { font-size: 26px; font-weight: 750; letter-spacing: -.025em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .nombre p { margin: 2px 0 0; color: var(--tenue); }
  .botones { margin-left: auto; display: flex; gap: 8px; flex: none; }
  .sec { flex: none; padding: 4px 28px 24px; }
  .sec h3 { display: flex; align-items: center; gap: 8px; min-height: 36px; margin: 0 0 12px; font-size: 13px; font-weight: 650; text-transform: none; letter-spacing: 0; color: var(--tenue); }
  .sec h3 button { margin-left: auto; }
  .vivo { width: 8px; height: 8px; border-radius: 50%; background: var(--ok); box-shadow: 0 0 0 4px var(--ok-suave); }

  .mosaico { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 10px; }
  .baldosa { position: relative; aspect-ratio: 16 / 10; border-radius: 14px; overflow: hidden; display: grid; place-items: center; --anillo: var(--superficie);
    background: radial-gradient(circle at 50% 45%, color-mix(in srgb, var(--c) 30%, var(--superficie)), var(--superficie) 70%); }
  .baldosa.habla { box-shadow: inset 0 0 0 2px var(--c), 0 0 24px -6px var(--c); }
  .quien { position: absolute; left: 8px; bottom: 8px; display: flex; align-items: center; gap: 6px; padding: 3px 8px; border-radius: 8px; background: rgb(0 0 0 / .5); font-size: 12px; font-weight: 650; }
  .pantalla { background: linear-gradient(160deg, color-mix(in srgb, var(--cian) 25%, var(--superficie)), var(--hondo)); }
  .tag { position: absolute; top: 8px; left: 8px; padding: 2px 7px; border-radius: 6px; background: var(--peligro); color: #fff; font-size: 11px; font-weight: 750; }
  .libre { min-height: 0; padding: 0; display: flex; gap: 6px; background: none; border: 1.5px dashed var(--punteado); color: var(--apagado); font-weight: 600; }
  .libre:hover:not(:disabled) { color: var(--texto); border-color: var(--acento-borde); background: none; }
  .nadie { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 18px; border-radius: 14px; border: 1.5px dashed var(--punteado); color: var(--tenue); }

  .mensajes { width: 100%; display: flex; flex-direction: column; align-items: stretch; gap: 2px; padding: 8px; border-radius: 14px; background: var(--fondo); border: 1px solid var(--borde); text-align: left; font-weight: 450; }
  .mensajes:hover:not(:disabled) { background: var(--fondo); border-color: var(--borde-fuerte); }
  .m { display: grid; grid-template-columns: 36px 1fr; gap: 12px; padding: 8px; border-radius: 10px; --anillo: var(--fondo); }
  .m b { font-weight: 650; }
  .donde { display: inline-flex; align-items: center; margin-left: 8px; font-size: 12px; color: var(--apagado); }
  .m time { margin-left: 8px; font-size: 11.5px; color: var(--apagado); }
  .texto { display: block; color: color-mix(in srgb, var(--texto) 88%, transparent); overflow-wrap: anywhere; }
  .novedades summary { width: fit-content; cursor: pointer; font-size: 13px; font-weight: 600; color: var(--apagado); }
  .novedades summary:hover { color: var(--texto); }
  .novedades[open] summary { margin-bottom: 12px; }
  .novedades :global(.encabezado) { display: none; }

  .vacio { margin: 28px; display: flex; flex-direction: column; align-items: flex-start; gap: 12px; padding: 28px; border: 1px dashed var(--borde-fuerte); border-radius: var(--radio-tarjeta); }
  .vacio-icono { display: grid; place-items: center; width: 64px; height: 64px; border-radius: var(--radio-grande); background: var(--acento-suave); color: var(--acento-texto); }
  .vacio h2 { font-size: 17px; font-weight: 650; }
  .vacio p { margin: 0; color: var(--tenue); }
  .vacio .agregar { width: min(520px, 100%); }
</style>
