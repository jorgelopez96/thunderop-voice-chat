<script lang="ts">
  import { Plus, Monitor, Users } from '@lucide/svelte';
  import type { RecordModel } from 'pocketbase';
  import { pb } from '../pb';
  import { sesion, mensajeError } from '../sesion.svelte';
  import { grupos, grupoActual, crearGrupo, unirse } from '../grupos.svelte';
  import { voz, entrarVoz } from '../voz.svelte';
  import { delGrupo } from '../noLeidos.svelte';
  import { foto } from '../foto';
  import Avatar from './Avatar.svelte';
  import Novedades from './Novedades.svelte';
  import Amigos from './Amigos.svelte';

  const yaCree = $derived(grupos.lista.some((g) => g.owner === sesion.usuario?.id));

  // Quiénes están en voz en cada sala de cada grupo (presencia del servidor), refrescado cada 15 s mientras se ve la portada.
  type EnVoz = { id: string; name: string };
  let enVozDe = $state<Record<string, Record<string, EnVoz[]>>>({});
  $effect(() => {
    const cargar = () => {
      for (const g of grupos.lista) pb.send(`/api/groups/${g.id}/voz`, {}).then((r: Record<string, EnVoz[]>) => (enVozDe[g.id] = r), () => {});
    };
    cargar();
    const i = setInterval(cargar, 15_000);
    return () => clearInterval(i);
  });
  const enVoz = (g: string) => Object.values(enVozDe[g] ?? {}).flat();
  const ordenados = $derived([...grupos.lista].sort((a, b) => enVoz(b.id).length - enVoz(a.id).length));

  // Salas de voz con gente en mis grupos. El endpoint de presencia solo trae ids: el nombre se pide una vez por sala.
  let nombresSala = $state<Record<string, string>>({});
  const activas = $derived(grupos.lista.flatMap((g) => Object.entries(enVozDe[g.id] ?? {})
    .filter(([, gente]) => gente.length).map(([sala, gente]) => ({ grupo: g, sala, gente }))));
  $effect(() => {
    for (const a of activas) if (!(a.sala in nombresSala)) {
      nombresSala[a.sala] = '';
      pb.collection('rooms').getOne(a.sala, { fields: 'name' }).then((r) => (nombresSala[a.sala] = r.name), () => {});
    }
  });
  const miGrupo = $derived(grupos.lista.find((g) => g.id === voz.grupoId));
  async function unirme(a: (typeof activas)[number]) {
    await entrarVoz(a.sala, nombresSala[a.sala], a.grupo.id);
    grupoActual.id = a.grupo.id;
  }

  const miembro = (g: RecordModel, id: string) => ((g.expand?.members ?? []) as RecordModel[]).find((m) => m.id === id);
  // Degradé de un solo tono, derivado del nombre del grupo.
  const tono = (n: string) => [...n].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  const degrade = (n: string) => `linear-gradient(135deg, hsl(${tono(n)} 45% 35%), hsl(${tono(n)} 45% 25%))`;

  let agregando = $state(false); // "Crear o unirme" o el estado vacío abren crear / unirse
  let nombre = $state('');
  let codigo = $state('');
  let error = $state('');

  async function hacer(f: () => Promise<void>) {
    error = '';
    try { await f(); agregando = false; } catch (e) { error = e instanceof Error && !('status' in e) ? e.message : mensajeError(e); }
  }
</script>

{#snippet icono(g: RecordModel)}
  {#if g.foto}<img class="icono-grupo" alt="" src={pb.files.getURL(g, g.foto, { thumb: '100x100' })} />
  {:else}<span class="icono-grupo" style="background:{degrade(g.name)}">{g.name.slice(0, 1).toUpperCase()}</span>{/if}
{/snippet}

{#snippet chips(g: RecordModel, gente: { id: string; nombre: string; hablando?: boolean; transmite?: boolean }[])}
  <ul class="chips">
    {#each gente as p (p.id)}
      {@const m = miembro(g, p.id)}
      <li class="chip">{#if m}<Avatar usuario={m} tam={20} hablando={p.hablando} />{/if}{p.nombre}
        {#if p.transmite}<Monitor size={14} strokeWidth={1.75} color="var(--cian)" aria-label="Transmitiendo" />{/if}</li>
    {/each}
  </ul>
{/snippet}

{#snippet formulario()}
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
{/snippet}

<div class="inicio">
  <div class="principal">
    <header class="cabecera"><h2>¡Hola, {sesion.usuario?.name}!</h2></header>
    <div class="contenido">
      {#if grupos.cargado && !grupos.lista.length}
        <section class="vacio">
          <span class="vacio-icono"><Users size={28} strokeWidth={1.75} /></span>
          <h2>Todavía no estás en ningún grupo</h2>
          <p>Creá uno para tus amigos o entrá con el código de invitación que te pasaron.</p>
          <div class="fila"><button class="primario" onclick={() => (agregando = true)}>Crear mi grupo</button><button onclick={() => (agregando = true)}>Unirme con código</button></div>
          {#if agregando}{@render formulario()}{/if}
        </section>
      {:else}
        {#if voz.salaId && miGrupo}
          <section>
            <div class="encabezado"><h2>Ahora en voz</h2></div>
            <div class="en-voz">
              {@render icono(miGrupo)}
              <div class="info">
                <span class="kicker"><span class="punto"></span>Estás en esta sala</span>
                <strong>{voz.salaNombre} <span>en {miGrupo.name}</span></strong>
                {@render chips(miGrupo, voz.participantes)}
              </div>
              <button onclick={() => (grupoActual.id = miGrupo.id)}>Ir a la sala</button>
            </div>
          </section>
        {:else if activas.length}
          <section>
            <div class="encabezado"><h2>Ahora en voz</h2></div>
            <div class="lista-voz">
              {#each activas as a (a.sala)}
                <div class="en-voz">
                  {@render icono(a.grupo)}
                  <div class="info">
                    <span class="kicker"><span class="punto"></span>{a.gente.length === 1 ? `${a.gente[0].name} está en voz` : `${a.gente.length} personas están en voz`}</span>
                    <strong>{nombresSala[a.sala] || 'Sala de voz'} <span>en {a.grupo.name}</span></strong>
                    {@render chips(a.grupo, a.gente.map((p) => ({ id: p.id, nombre: p.name })))}
                  </div>
                  <button class="primario" onclick={() => unirme(a)}>Unirme</button>
                </div>
              {/each}
            </div>
          </section>
        {/if}

        <section>
          <div class="encabezado"><h2>Mis grupos <small class="num">{grupos.lista.length}</small></h2>
            <button onclick={() => (agregando = !agregando)}><Plus size={16} strokeWidth={1.75} /> Crear o unirme</button></div>
          {#if agregando}{@render formulario()}{/if}
          <div class="grupos">
            {#each ordenados as g (g.id)}
              {@const v = enVoz(g.id)}
              <button class="grupo" onclick={() => (grupoActual.id = g.id)}>
                <span class="banner">
                  {#if g.foto}<img alt="" src={pb.files.getURL(g, g.foto, { thumb: '480x270' })} />
                  {:else}<span class="portada" style="background:{degrade(g.name)}"></span>{/if}
                </span>
                <span class="datos">
                  <strong>{g.name}</strong>
                  {#if g.descripcion}<span class="descripcion" title={g.descripcion}>{g.descripcion}</span>{/if}
                  {#if delGrupo(g.id)}<span class="punto-nuevo" aria-label="Mensajes sin leer"></span>{/if}
                  {#if v.length}
                    <small class="verde"><span class="punto"></span><span class="num">{v.length}</span> en voz
                      <span class="pila">{#each v.slice(0, 3) as p (p.id)}{@const m = miembro(g, p.id)}
                        <span title={p.name} style="background:{m?.color || ''}"><img alt="" src={foto(m)} /></span>
                      {/each}</span></small>
                  {:else}<small class="nadie">Nadie en voz</small>{/if}
                </span>
              </button>
            {/each}
          </div>
        </section>
      {/if}
      <Novedades />
    </div>
  </div>
  <Amigos />
</div>

<style>
  .inicio { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr) 280px; }
  .principal { display: flex; flex-direction: column; min-height: 0; }
  .cabecera { display: flex; align-items: center; height: 52px; padding: 0 32px; flex: none; border-bottom: 1px solid var(--borde); }
  .cabecera h2 { font-size: 17px; font-weight: 650; }
  .contenido { flex: 1; overflow-y: auto; padding: 24px 32px 32px; display: flex; flex-direction: column; gap: 32px; }
  .verde { color: var(--ok); }
  .punto { width: 8px; height: 8px; border-radius: 50%; background: var(--ok); flex: none; }

  .lista-voz { display: flex; flex-direction: column; gap: 8px; }
  .en-voz { display: grid; grid-template-columns: 56px 1fr auto; align-items: center; gap: 16px; padding: 16px; background: var(--panel);
    border: 1px solid color-mix(in srgb, var(--ok) 28%, var(--borde)); border-radius: var(--radio-tarjeta); box-shadow: var(--luz-borde), var(--sombra-1); }
  :global([data-modo='moderno']) .en-voz { box-shadow: var(--luz-borde), var(--sombra-1), 0 0 28px -10px color-mix(in srgb, var(--ok) 45%, transparent); }
  .icono-grupo { width: 56px; height: 56px; border-radius: var(--radio-menu); display: grid; place-items: center; object-fit: cover;
    color: #fff; font-size: 22px; font-weight: 750; }
  .info { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .kicker { display: flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 600; color: var(--ok); }
  .info strong { font-size: 17px; font-weight: 650; letter-spacing: -.01em; }
  .info strong span { font-size: 14px; font-weight: 450; color: var(--tenue); letter-spacing: 0; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; --anillo: var(--superficie); }
  .chip { display: flex; align-items: center; gap: 6px; height: 26px; padding: 0 10px 0 3px; font-size: 12.5px; font-weight: 600;
    background: var(--superficie); border: 1px solid var(--borde); border-radius: var(--radio-pildora); }

  .grupos { display: grid; grid-template-columns: repeat(auto-fill, 220px); gap: 16px; }
  .grupo { position: relative; width: 220px; height: 140px; padding: 0; flex-direction: column; align-items: stretch; justify-content: flex-start; gap: 0;
    background: var(--panel); border: 1px solid var(--borde); border-radius: var(--radio-tarjeta); text-align: left; }
  .grupo:hover:not(:disabled) { background: var(--panel); border-color: var(--borde-fuerte); }
  /* Sin overflow en la tarjeta (cortaría la sombra del hover): el banner lleva sus propias esquinas. */
  .banner { height: 60px; flex: none; overflow: hidden; border-radius: calc(var(--radio-tarjeta) - 1px) calc(var(--radio-tarjeta) - 1px) 0 0; }
  .banner img, .portada { display: block; width: 100%; height: 100%; object-fit: cover; }
  .datos { position: relative; flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 2px; padding: 0 12px; min-width: 0; }
  .datos strong { font-size: 15px; font-weight: 650; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding-right: 12px; }
  .datos small { display: flex; align-items: center; gap: 6px; font-size: 12px; }
  .descripcion { font-size: 12px; color: var(--tenue); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .datos .punto { width: 6px; height: 6px; }
  .nadie { color: var(--apagado); }
  .punto-nuevo { position: absolute; top: 14px; right: 12px; width: 8px; height: 8px; border-radius: 999px; background: var(--acento); }
  .pila { display: flex; margin-left: 4px; }
  .pila span { width: 20px; height: 20px; margin-left: -6px; border-radius: 999px; border: 2px solid var(--panel); display: grid; place-items: center;
    background: var(--hover); overflow: hidden; }
  .pila span:first-child { margin-left: 0; }
  .pila img { width: 100%; height: 100%; object-fit: cover; }
  /* Modo moderno: la tarjeta sube, se enciende su borde de acento (capa pintada: se anima la opacidad) y el banner hace zoom. */
  :global([data-modo='moderno']) .grupo { transition: transform 220ms var(--curva-salida), border-color var(--dur-rapida); }
  :global([data-modo='moderno']) .grupo::after { content: ''; position: absolute; inset: -1px; border: 1px solid var(--acento-borde); border-radius: inherit;
    box-shadow: var(--sombra-2), var(--brillo); opacity: 0; pointer-events: none; transition: opacity 220ms var(--curva-salida); }
  :global([data-modo='moderno']) .grupo:hover { transform: translateY(-2px); }
  :global([data-modo='moderno']) .grupo:hover::after { opacity: 1; }
  :global([data-modo='moderno']) .banner > * { transition: transform 420ms var(--curva-salida); }
  :global([data-modo='moderno']) .grupo:hover .banner > * { transform: scale(1.05); }

  .vacio { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; padding: 28px; border: 1px dashed var(--borde-fuerte); border-radius: var(--radio-tarjeta); }
  .vacio-icono { display: grid; place-items: center; width: 64px; height: 64px; border-radius: var(--radio-grande); background: var(--acento-suave); color: var(--acento-texto); }
  .vacio h2 { font-size: 17px; font-weight: 650; }
  .vacio p { margin: 0; color: var(--tenue); }
  .agregar { margin-bottom: 16px; max-width: 520px; padding: 16px; }
  .agregar input { flex: 1; }
</style>
