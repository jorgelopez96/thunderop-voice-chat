<script lang="ts">
  import { tick } from 'svelte';
  import { Clock, Smile, Hand, PawPrint, Pizza, Gamepad2, Plane, Lightbulb, Heart, Flag, Search } from '@lucide/svelte';
  import { buscar, cargarEmojis, conTono, sinTono, mover, agregarReciente, leerRecientes, guardarRecientes, leerTono, guardarTono, TONOS, NOMBRES_TONO, type Emoji } from '../emojis';
  import { pantalla } from '../plataforma.svelte';

  // Popover con todos los emojis: recientes, categorías, buscador y tono de piel. Los datos se cargan la primera vez que se abre.
  // `menu` queda enlazado para que quien lo usa lo abra y lo ubique (con `estilo` o abrirEnPunto).
  let { elegir, menu = $bindable(), estilo = '' }: { elegir: (emoji: string) => void; menu?: HTMLElement; estilo?: string } = $props();

  const COLUMNAS = 9, ALTO_FILA = 36, ALTO_TITULO = 28;
  const PESTAÑAS = [['Recientes', Clock], ['Caras y emociones', Smile], ['Gente', Hand], ['Animales y naturaleza', PawPrint], ['Comida y bebida', Pizza],
    ['Actividades', Gamepad2], ['Viajes y lugares', Plane], ['Objetos', Lightbulb], ['Símbolos', Heart], ['Banderas', Flag]] as const;

  let usado = $state(false);
  let datos = $state.raw<Emoji[][]>();
  let consulta = $state('');
  let recientes = $state<string[]>([]);
  let tono = $state(leerTono());
  let activa = $state(0);
  let foco = $state<[number, number]>([0, 0]);
  let buscador = $state<HTMLInputElement>();
  let grilla = $state<HTMLElement>();

  const todos = $derived(datos?.flat() ?? []);
  const porEmoji = $derived(new Map(todos.map((x) => [sinTono(x.e), x])));
  const item = (x: Emoji) => ({ e: x.tono ? conTono(x.e, TONOS[tono]) : x.e, nombre: x.nombre });
  const reciente = (e: string) => ({ e, nombre: porEmoji.get(sinTono(e))?.nombre ?? e });
  const buscando = $derived(!!consulta.trim());
  const secciones = $derived.by(() => {
    if (!datos) return [];
    if (buscando) return [{ titulo: 'Resultados', pestaña: -1, items: buscar(todos, consulta).map(item) }];
    return [{ titulo: PESTAÑAS[0][0], pestaña: 0, items: recientes.map(reciente) },
      ...datos.map((c, k) => ({ titulo: PESTAÑAS[k + 1][0], pestaña: k + 1, items: c.map(item) }))].filter((s) => s.items.length);
  });

  async function alAbrir(ev: ToggleEvent) {
    if (ev.newState !== 'open') return;
    usado = true;
    recientes = leerRecientes();
    consulta = '';
    foco = [0, 0];
    activa = recientes.length ? 0 : 1;
    await tick();
    if (grilla) grilla.scrollTop = 0;
    if (!pantalla.movil) buscador?.focus(); // en el celular abriría el teclado
    datos ??= await cargarEmojis();
  }

  function elegirUno(e: string) {
    recientes = agregarReciente(leerRecientes(), e);
    guardarRecientes(recientes);
    menu?.hidePopover();
    elegir(e);
  }

  async function irA(k: number) {
    consulta = '';
    await tick();
    const el = grilla?.querySelector<HTMLElement>(`[data-pestaña="${k}"]`);
    if (grilla && el) grilla.scrollTop = el.offsetTop;
    activa = k;
    const s = secciones.findIndex((x) => x.pestaña === k);
    if (s >= 0) foco = [s, 0];
  }

  function alScrollear() {
    if (!grilla || buscando) return;
    const y = grilla.scrollTop + grilla.clientHeight >= grilla.scrollHeight - 2 ? Infinity : grilla.scrollTop + ALTO_TITULO; // abajo de todo: la última
    for (const el of grilla.querySelectorAll<HTMLElement>('[data-pestaña]')) if (el.offsetTop <= y) activa = Number(el.dataset.pestaña);
  }

  function enfocar([s, i]: [number, number]) {
    foco = [s, i];
    grilla?.querySelector<HTMLElement>(`[data-s="${s}"][data-i="${i}"]`)?.focus();
  }

  function teclaEmoji(ev: KeyboardEvent, s: number, i: number) {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(ev.key)) return;
    ev.preventDefault();
    const sig = mover(secciones.map((x) => x.items.length), [s, i], ev.key, COLUMNAS);
    if (ev.key === 'ArrowUp' && sig[0] === s && sig[1] === i) buscador?.focus(); // desde la primera fila, al buscador
    else enfocar(sig);
  }

  function teclaBuscador(ev: KeyboardEvent) {
    if (ev.key === 'ArrowDown' && secciones.length) { ev.preventDefault(); enfocar([0, 0]); }
    if (ev.key === 'Enter' && buscando && secciones.length) { ev.preventDefault(); elegirUno(secciones[0].items[0].e); }
  }

  function cambiarTono() {
    tono = (tono + 1) % TONOS.length;
    guardarTono(tono);
  }
</script>

<div popover class="menu-emojis" bind:this={menu} style={estilo} ontoggle={alAbrir} role="dialog" aria-label="Emojis">
  {#if usado}
    <div class="arriba">
      <label class="buscar"><Search size={14} strokeWidth={1.75} />
        <input bind:this={buscador} bind:value={consulta} oninput={() => { foco = [0, 0]; if (grilla) grilla.scrollTop = 0; }} onkeydown={teclaBuscador}
          placeholder="Buscar emoji" aria-label="Buscar emoji" autocomplete="off" spellcheck="false" /></label>
      <button type="button" class="plano tono" onclick={cambiarTono} title="Tono de piel: {NOMBRES_TONO[tono]}" aria-label="Tono de piel: {NOMBRES_TONO[tono]}">{conTono('✋', TONOS[tono])}</button>
    </div>
    <div class="pestañas" role="toolbar" aria-label="Categorías">
      {#each PESTAÑAS as [titulo, Icono], k (titulo)}
        {#if k || recientes.length}
          <button type="button" class="plano" title={titulo} aria-label={titulo} aria-current={!buscando && activa === k ? 'true' : undefined} onclick={() => irA(k)}><Icono size={16} strokeWidth={1.75} /></button>
        {/if}
      {/each}
    </div>
    <div class="grilla" bind:this={grilla} onscroll={alScrollear}>
      {#if !datos}<p class="aviso">Cargando…</p>
      {:else if !secciones.length}<p class="aviso">No hay emojis para “{consulta.trim()}”.</p>
      {:else}
        {#each secciones as sec, s (sec.titulo)}
          <!-- Fuera de la vista no se dibuja; el alto exacto evita saltos al ir a una categoría. -->
          <section data-pestaña={sec.pestaña} aria-label={sec.titulo} style="contain-intrinsic-block-size: auto {ALTO_TITULO + Math.ceil(sec.items.length / COLUMNAS) * ALTO_FILA}px">
            <h3>{sec.titulo}</h3>
            <div class="emojis">
              {#each sec.items as x, i (x.e)}
                <button type="button" class="plano" data-s={s} data-i={i} tabindex={foco[0] === s && foco[1] === i ? 0 : -1} title={x.nombre} aria-label={x.nombre}
                  onclick={() => elegirUno(x.e)} onkeydown={(ev) => teclaEmoji(ev, s, i)}>{x.e}</button>
              {/each}
            </div>
          </section>
        {/each}
      {/if}
    </div>
  {/if}
</div>

<style>
  .menu-emojis { position: fixed; inset: auto; margin: 0; padding: 0; width: min(352px, calc(100vw - 16px)); height: min(400px, calc(100vh - 16px)); flex-direction: column; overflow: hidden;
    background: var(--elevado); color: var(--texto); border: 1px solid var(--borde-fuerte); border-radius: var(--radio-menu); box-shadow: var(--sombra-2); }
  .menu-emojis:popover-open { display: flex; }
  .arriba { display: flex; gap: 6px; padding: 8px 8px 6px; }
  .buscar { flex: 1; position: relative; display: flex; align-items: center; }
  .buscar :global(svg) { position: absolute; left: 10px; top: 9px; color: var(--apagado); pointer-events: none; }
  .buscar input { width: 100%; height: 32px; padding: 0 10px 0 30px; }
  .tono { width: 32px; height: 32px; padding: 0; font-size: 18px; }
  .pestañas { display: flex; justify-content: space-between; padding: 0 6px; border-bottom: 1px solid var(--borde); }
  .pestañas button { padding: 7px 6px; color: var(--apagado); border-radius: var(--radio) var(--radio) 0 0; }
  .pestañas button[aria-current='true'] { color: var(--acento-texto); box-shadow: inset 0 -2px var(--acento); }
  .grilla { flex: 1; overflow-y: auto; position: relative; padding: 0 8px 8px; overscroll-behavior: contain; }
  section { content-visibility: auto; }
  h3 { margin: 0; height: 28px; line-height: 32px; padding-left: 2px; }
  .emojis { display: grid; grid-template-columns: repeat(9, 1fr); grid-auto-rows: 36px; }
  .emojis button { font-size: 22px; line-height: 1; padding: 0; height: 36px; border-radius: var(--radio); }
  .aviso { color: var(--apagado); text-align: center; padding: 24px 8px; margin: 0; font-size: 13px; }
</style>
