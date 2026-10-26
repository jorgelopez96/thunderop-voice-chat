<script lang="ts">
  import { alTocar, estabaAbierto } from '../menu';
  import { Mic, MicOff, Headphones, HeadphoneOff, ChevronDown, Monitor, AudioWaveform, Music, PhoneOff, MessageSquare, Ellipsis } from '@lucide/svelte';
  import { voz, alternarMute, ensordecer, cambiarSupresion, salirVoz, transmitir, transmitirNavegador, dejarDeTransmitir, cambiarCalidad, dispositivos, elegirEntrada, elegirSalida } from '../voz.svelte';
  import { grupos } from '../grupos.svelte';
  import { CALIDADES, leerPrefs, type Calidad } from '../prefs';
  import Botonera from './Botonera.svelte';
  import Musica from './Musica.svelte';
  import { sesion } from '../sesion.svelte';
  import { fuentes, conNativo, type Fuente } from '../transmisorNativo';
  import { puedeTransmitir, pantalla } from '../plataforma.svelte';
  import Confirmar from './Confirmar.svelte';
  import { navMovil, conAtras } from '../navMovil.svelte';
  import { elegirFuente } from '../transmision';

  const g = $derived(grupos.lista.find((x) => x.id === voz.grupoId));

  // Panelcitos de Sonidos y Música, pegados a su botón.
  let abiertoSonidos = $state(false);
  let abiertoMusica = $state(false);
  let posPanel = $state({ x: 0, y: 0 });
  // popovertarget abre y cierra (y no se pelea con el cierre al tocar afuera); acá solo se ubica.
  function ubicarPanel(e: MouseEvent) {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    posPanel = { x: Math.max(8, Math.min(r.left + r.width / 2 - 220, innerWidth - 448)), y: innerHeight - r.top + 8 };
  }

  // Menú de dispositivos (la flechita al lado de Mic y Sonido).
  let menu = $state<HTMLElement>();
  let tipo = $state<'entrada' | 'salida'>('entrada');
  let lista = $state<MediaDeviceInfo[]>([]);
  let elegido = $state('');
  let pos = $state({ x: 0, y: 0 });
  async function abrirMenu(e: MouseEvent, t: 'entrada' | 'salida') {
    if (estabaAbierto(menu) && tipo === t) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    pos = { x: r.left, y: innerHeight - r.top + 8 };
    tipo = t;
    const d = await dispositivos();
    lista = t === 'entrada' ? d.entradas : d.salidas;
    elegido = leerPrefs()[t] ?? 'default';
    menu?.showPopover();
  }
  function elegir(id: string) {
    elegido = id;
    (tipo === 'entrada' ? elegirEntrada : elegirSalida)(id);
  }

  let d = $state<HTMLDialogElement>();
  let calidad = $state<Calidad>('1080p60');
  let fuentesLista = $state<Fuente[] | null>(null); // null: todavía no llegó el primer pedido
  let elegida = $state<Fuente | null>(null);
  let perdida = $state(false); // la elegida desapareció: hay que elegir de nuevo, no se cambia sola
  let comprobando = $state(false); // Empezar está mirando que lo elegido siga ahí
  let aviso = $state('');
  let gen = 0, pidiendo = -1; // gen cambia al abrir y al cerrar: una respuesta de otra vuelta se descarta
  let enVuelo: Promise<Fuente[] | null> = Promise.resolve(null);
  const monitores = $derived((fuentesLista ?? []).filter((x) => x.tipo === 'monitor'));
  const ventanas = $derived((fuentesLista ?? []).filter((x) => x.tipo === 'ventana'));
  // Un pedido a la vez por vuelta; quien pide mientras hay uno en vuelo recibe ese mismo. null: la vuelta cambió.
  function refrescar(): Promise<Fuente[] | null> {
    const mia = gen;
    if (pidiendo === mia) return enVuelo;
    pidiendo = mia;
    enVuelo = (async () => {
      try {
        const r = await fuentes();
        if (mia !== gen) return null;
        // Una lista vacía es "no se pudo mirar" (o no hay nada): no pisa lo que ya se veía ni da por perdida la elección.
        if (r.length || fuentesLista === null) fuentesLista = r;
        if (r.length) {
          const ant = elegida;
          elegida = perdida ? null : elegirFuente(r, ant);
          if (ant && !elegida) perdida = true;
        }
        return r;
      } finally { if (pidiendo === mia) pidiendo = -1; }
    })();
    return enVuelo;
  }
  let reloj: ReturnType<typeof setInterval> | undefined;
  let nativoUI = $state(true);
  let cortando = $state(false); // confirmar antes de dejar de transmitir (un toque sin querer cortaba todo)
  function abrirTransmision() {
    clearInterval(reloj);
    gen++;
    calidad = leerPrefs().calidad;
    fuentesLista = null; elegida = null; perdida = false; aviso = ''; comprobando = false;
    nativoUI = conNativo();
    d?.showModal();
    if (!nativoUI) return; // en el navegador, qué compartir lo elige su propio selector
    void refrescar();
    reloj = setInterval(refrescar, 3000);
  }
  function alCerrar() { gen++; clearInterval(reloj); }
  // El Dock se desmonta con el diálogo abierto (salir de la sala): no hay `close`.
  $effect(() => alCerrar);
  // Antes de empezar se vuelve a mirar: la ventana pudo cerrarse o ser otra.
  async function empezar() {
    if (!nativoUI) { d?.close(); void transmitirNavegador(calidad); return; }
    const f = elegida;
    if (!f || comprobando) return;
    comprobando = true; aviso = '';
    try {
      const r = await refrescar();
      if (!d?.open || !r) return;
      if (!r.length) { aviso = 'No se pudo comprobar. Probá de nuevo.'; return; }
      if (!elegirFuente(r, f)) { fuentesLista = r; elegida = null; perdida = true; return; }
      d.close();
      transmitir(calidad, f);
    } finally { comprobando = false; }
  }
  const nombreCalidad = (c: Calidad) => `${CALIDADES[c].alto}p · ${CALIDADES[c].fps} fps`;

  // Menú de calidad mientras se transmite.
  let menuCalidad = $state<HTMLElement>();
  let posCalidad = $state({ x: 0, y: 0 });
  function abrirCalidad(e: MouseEvent) {
    if (estabaAbierto(menuCalidad)) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    posCalidad = { x: r.left, y: innerHeight - r.top + 8 };
    menuCalidad?.showPopover();
  }
  const TEXTO_SENAL = { buena: 'Buena conexión', regular: 'Conexión inestable', mala: 'Mala conexión' };
</script>

{#if pantalla.movil}
<!-- Celular: una fila con lo esencial; sonidos y transmitir en "Más". -->
<div class="dock-movil" role="toolbar" aria-label="Llamada">
  <button class="icono" class:apagado={voz.muteado || voz.sinPermiso} onclick={alternarMute} disabled={voz.sinPermiso} aria-label={voz.muteado ? 'Activar micrófono' : 'Silenciarme'}>
    {#if voz.muteado || voz.sinPermiso}<MicOff size={22} strokeWidth={1.75} />{:else}<Mic size={22} strokeWidth={1.75} />{/if}</button>
  <button class="icono" class:apagado={voz.ensordecido} onclick={() => ensordecer(!voz.ensordecido)} aria-label={voz.ensordecido ? 'Activar sonido' : 'Ensordecerme'}>
    {#if voz.ensordecido}<HeadphoneOff size={22} strokeWidth={1.75} />{:else}<Headphones size={22} strokeWidth={1.75} />{/if}</button>
  <button class="icono violeta" popovertarget="dock-musica" onclick={ubicarPanel} aria-label="Música"><Music size={22} strokeWidth={1.75} /></button>
  <button class="icono" aria-label="Chat de la sala" onclick={() => { navMovil.chatSala = true; conAtras(() => (navMovil.chatSala = false)); }}><MessageSquare size={22} strokeWidth={1.75} /></button>
  <button class="icono" popovertarget="dock-mas" aria-label="Más opciones"><Ellipsis size={22} strokeWidth={1.75} /></button>
  <button class="icono colgar" onclick={salirVoz} aria-label="Desconectarse"><PhoneOff size={22} strokeWidth={1.75} /></button>
</div>
<div popover id="dock-mas" class="menu mas">
  <button class="plano" popovertarget="dock-sonidos" onclick={ubicarPanel}><AudioWaveform size={18} strokeWidth={1.75} /> Sonidos</button>
  {#if puedeTransmitir()}
    {#if voz.transmitiendo}<button class="plano" onclick={() => (cortando = true)}><Monitor size={18} strokeWidth={1.75} /> Dejar de transmitir</button>
    {:else}<button class="plano" onclick={abrirTransmision}><Monitor size={18} strokeWidth={1.75} /> Transmitir</button>{/if}
  {/if}
</div>
{:else}
<footer class="dock">
  <div class="estado">
    <span class="senal {voz.conectando ? 'regular' : voz.senal}" title={TEXTO_SENAL[voz.conectando ? 'regular' : voz.senal]}></span>
    <span><strong>{voz.conectando ? 'Conectando…' : 'Conectado'}</strong><small>{voz.salaNombre}{g ? ` · ${g.name}` : ''}</small></span>
  </div>
  <div class="centro">
    <div class="doble" class:apagado={voz.muteado || voz.sinPermiso}>
      <button class="icono" onclick={alternarMute} disabled={voz.sinPermiso} aria-label={voz.muteado ? 'Activar micrófono' : 'Silenciarme'} title={voz.sinPermiso ? 'El dueño te silenció' : voz.muteado ? 'Activar micrófono' : 'Silenciarme'}>
        {#key voz.muteado || voz.sinPermiso}<span class="ico pop">{#if voz.muteado || voz.sinPermiso}<MicOff size={20} strokeWidth={1.75} />{:else}<Mic size={20} strokeWidth={1.75} />{/if}</span>{/key}
      </button>
      <button class="icono flecha" aria-label="Opciones del micrófono" title="Micrófono y supresión" onpointerdown={() => alTocar(menu)} onclick={(e) => abrirMenu(e, 'entrada')}><ChevronDown size={14} strokeWidth={1.75} /></button>
    </div>
    <div class="doble" class:apagado={voz.ensordecido}>
      <button class="icono" onclick={() => ensordecer(!voz.ensordecido)} aria-label={voz.ensordecido ? 'Activar sonido' : 'Ensordecerme'} title={voz.ensordecido ? 'Activar sonido' : 'Ensordecerme'}>
        {#key voz.ensordecido}<span class="ico pop">{#if voz.ensordecido}<HeadphoneOff size={20} strokeWidth={1.75} />{:else}<Headphones size={20} strokeWidth={1.75} />{/if}</span>{/key}
      </button>
      <button class="icono flecha" aria-label="Opciones del sonido" title="Salida de audio" onpointerdown={() => alTocar(menu)} onclick={(e) => abrirMenu(e, 'salida')}><ChevronDown size={14} strokeWidth={1.75} /></button>
    </div>
    <span class="separador"></span>
    {#if voz.transmitiendo}
      <div class="doble">
        <button class="icono vivo" onclick={() => (cortando = true)} aria-label="Dejar de transmitir" title="Dejar de transmitir"><Monitor size={20} strokeWidth={1.75} /></button>
        <button class="icono flecha" aria-label="Calidad de la transmisión" title="Cambiar la calidad" onpointerdown={() => alTocar(menuCalidad)} onclick={abrirCalidad}><ChevronDown size={14} strokeWidth={1.75} /></button>
      </div>
    {:else}
    {#if puedeTransmitir()}<button class="icono cian" onclick={abrirTransmision} disabled={voz.conectando} aria-label="Transmitir" title="Transmitir pantalla"><Monitor size={20} strokeWidth={1.75} /></button>{/if}
    {/if}
    <button class="icono magenta" aria-pressed={abiertoSonidos} popovertarget="dock-sonidos" onclick={ubicarPanel} aria-label="Sonidos" title="Sonidos"><AudioWaveform size={20} strokeWidth={1.75} /></button>
    <button class="icono violeta" aria-pressed={abiertoMusica} popovertarget="dock-musica" onclick={ubicarPanel} aria-label="Música" title="Música"><Music size={20} strokeWidth={1.75} /></button>
    <span class="separador"></span>
    <button class="icono colgar" onclick={salirVoz} aria-label="Desconectarse" title="Desconectarse"><PhoneOff size={20} strokeWidth={1.75} /></button>
  </div>
  <span></span>
</footer>
{/if}

<div popover id="dock-sonidos" class="panel" style="left:{posPanel.x}px;bottom:{posPanel.y}px" ontoggle={(e) => (abiertoSonidos = e.newState === 'open')}>
  {#if g}{#key g.id}<Botonera grupoId={g.id} userId={sesion.usuario?.id} soyDueno={g.owner === sesion.usuario?.id} />{/key}{/if}
</div>
<div popover id="dock-musica" class="panel" style="left:{posPanel.x}px;bottom:{posPanel.y}px" ontoggle={(e) => (abiertoMusica = e.newState === 'open')}>
  <Musica />
</div>

<div popover bind:this={menu} class="menu" style="left:{pos.x}px;bottom:{pos.y}px">
  <h3>{tipo === 'entrada' ? 'Micrófono' : 'Salida de audio'}</h3>
  {#each lista as x (x.deviceId)}
    <button class="plano" aria-pressed={x.deviceId === elegido} onclick={() => elegir(x.deviceId)}>{x.label || 'Dispositivo sin nombre'}</button>
  {:else}<small>No se ven dispositivos (falta el permiso del micrófono).</small>{/each}
  {#if tipo === 'entrada'}
    <hr />
    <button class="plano" aria-pressed={voz.supresion} onclick={() => cambiarSupresion(!voz.supresion)}>Supresión de ruido</button>
  {/if}
</div>

<div popover bind:this={menuCalidad} class="menu" style="left:{posCalidad.x}px;bottom:{posCalidad.y}px">
  <h3>Calidad</h3>
  {#each Object.keys(CALIDADES) as c (c)}
    <button class="plano" aria-pressed={c === voz.calidadEnVivo} onclick={() => { menuCalidad?.hidePopover(); cambiarCalidad(c as Calidad); }}>{nombreCalidad(c as Calidad)}</button>
  {/each}
</div>

{#snippet grilla(titulo: string, items: Fuente[])}
  {#if items.length}
    <h4>{titulo}</h4>
    <div class="grilla">
      {#each items as f (f.tipo + f.id)}
        <button class="tarjeta" aria-pressed={elegida?.tipo === f.tipo && elegida?.id === f.id} onclick={() => { elegida = f; perdida = false; aviso = ''; }}>
          {#if f.png_base64}<img src="data:image/png;base64,{f.png_base64}" alt="" />{:else}<span class="vacio" aria-hidden="true"></span>{/if}
          <span class="nombre">
            {#if f.icono_base64}<img class="ico" src="data:image/png;base64,{f.icono_base64}" alt="" />{/if}
            <span title={f.titulo}>{f.titulo}</span>
          </span>
        </button>
      {/each}
    </div>
  {/if}
{/snippet}

{#if cortando}<Confirmar texto="¿Dejar de transmitir? Los que te están mirando dejan de verte." accion="Dejar de transmitir"
  cancelar={() => (cortando = false)} confirmar={() => { cortando = false; void dejarDeTransmitir(); }} />{/if}

<dialog bind:this={d} class="fuentes" onclose={alCerrar}>
  <h3>Transmitir pantalla</h3>
  {#if nativoUI}<div class="scroll" aria-live="polite">
    {#if fuentesLista === null}<small>Buscando pantallas y ventanas…</small>
    {:else if perdida}<small>Lo que elegiste ya no está disponible. Elegí otra opción.</small>{@render grilla('Pantallas', monitores)}{@render grilla('Ventanas', ventanas)}
    {:else if !fuentesLista.length}<small>No se encontró nada para transmitir.</small>
    {:else}{@render grilla('Pantallas', monitores)}{@render grilla('Ventanas', ventanas)}{/if}
    {#if aviso}<small role="alert">{aviso}</small>{/if}
  </div>
  {:else}<p class="tenue-web">El navegador te va a preguntar qué pantalla, ventana o pestaña compartir.</p>{/if}
  <label>Calidad
    <select bind:value={calidad}>{#each Object.keys(CALIDADES) as c (c)}<option value={c}>{nombreCalidad(c as Calidad)}</option>{/each}</select>
  </label>
  <div class="fila" style="justify-content:flex-end">
    <button class="plano" onclick={() => d?.close()}>Cancelar</button>
    <button class="primario" onclick={empezar} disabled={(nativoUI && !elegida) || comprobando}>{comprobando ? 'Comprobando…' : 'Empezar'}</button>
  </div>
</dialog>


<style>
  .dock-movil { flex: none; display: flex; justify-content: space-around; align-items: center; height: calc(62px + env(safe-area-inset-bottom));
    padding: 0 8px env(safe-area-inset-bottom); background: var(--panel); border-top: 1px solid var(--borde); }
  .dock-movil .icono { width: 48px; min-height: 48px; border-radius: var(--radio-menu); }
  .dock-movil .apagado { color: var(--peligro); background: var(--peligro-suave); }
  .dock-movil .colgar { width: 56px; background: var(--peligro); color: #fff; }
  .mas { min-width: 220px; }
  .mas:popover-open { inset: auto 8px calc(70px + env(safe-area-inset-bottom)) auto; }
  .dock { flex: none; height: 64px; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 16px; padding: 0 16px;
    background: var(--panel); border-top: 1px solid var(--borde); }
  :global([data-modo='moderno']) .dock { animation: sube 280ms var(--curva-salida); }
  @keyframes sube { from { opacity: 0; transform: translateY(100%); } }
  .estado { display: flex; align-items: center; gap: 10px; min-width: 0; }
  .estado span { display: flex; flex-direction: column; min-width: 0; line-height: 1.3; }
  .estado strong { font-weight: 650; font-size: 13.5px; }
  /* Circulito de señal: verde, naranja o rojo. En moderno respira con un neón suave (capa pintada, se anima su opacidad). */
  .senal { position: relative; flex: none; width: 10px; height: 10px; border-radius: 50%; background: var(--c); margin: 0 2px; }
  .buena { --c: var(--ok); }
  .regular { --c: #F0A04B; }
  .mala { --c: var(--peligro); }
  :global([data-modo='moderno']) .senal::after { content: ''; position: absolute; inset: -3px; border-radius: 50%;
    box-shadow: 0 0 10px 2px var(--c); opacity: .25; animation: respira 3s ease-in-out infinite; }
  @keyframes respira { 50% { opacity: .9; } }
  .estado small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
  /* La isla: botones de 40 sobre una superficie elevada. */
  .centro { display: flex; align-items: center; gap: 4px; padding: 5px; background: var(--superficie); border: 1px solid var(--borde);
    border-radius: var(--radio-grande); box-shadow: var(--luz-borde), var(--sombra-2); }
  .centro .icono { width: 40px; height: 40px; min-height: 40px; border-radius: var(--radio-menu); }
  .ico { display: grid; }
  .doble { display: flex; border-radius: var(--radio-menu); }
  .doble .icono:first-child { border-radius: var(--radio-menu) 0 0 var(--radio-menu); }
  .doble .flecha { width: 18px; min-width: 18px; border-radius: 0 var(--radio-menu) var(--radio-menu) 0; }
  .doble:hover { background: var(--hover); }
  .doble.apagado { background: var(--peligro-suave); }
  .doble.apagado .icono:first-child { color: var(--peligro); }
  .separador { width: 1px; height: 24px; background: var(--borde-fuerte); margin: 0 4px; }
  .cian { color: var(--cian); }
  .magenta { color: var(--magenta); }
  .violeta { color: var(--acento-texto); }
  .centro .vivo { background: var(--cian-suave); color: var(--cian); box-shadow: 0 0 14px -4px var(--cian); }
  .centro .colgar { width: 56px; background: var(--peligro); color: #fff; }
  .centro .colgar:hover:not(:disabled) { background: var(--peligro-hover); color: #fff; }
  /* Modo moderno: cada ícono reacciona a su manera; solo transform. */
  :global([data-modo='moderno']) .centro .icono :global(svg) { transition: transform 180ms var(--curva-resorte); }
  :global([data-modo='moderno']) .doble .icono:first-child:hover :global(svg) { transform: scale(1.1); }
  :global([data-modo='moderno']) .doble .icono:first-child:active :global(svg) { transform: scale(.88); transition-duration: 90ms; }
  :global([data-modo='moderno']) .pop { animation: pop 260ms var(--curva-resorte); }
  @keyframes pop { from { transform: scale(.6); } }
  :global([data-modo='moderno']) .cian:hover :global(svg), :global([data-modo='moderno']) .vivo:hover :global(svg) { transform: translateY(-2px); }
  :global([data-modo='moderno']) .magenta:hover :global(svg) { transform: scaleY(1.2); }
  :global([data-modo='moderno']) .violeta:hover :global(svg) { transform: rotate(-12deg) scale(1.06); }
  :global([data-modo='moderno']) .colgar { box-shadow: 0 4px 14px -4px color-mix(in srgb, var(--peligro) 70%, transparent); }
  :global([data-modo='moderno']) .colgar:hover :global(svg) { transform: rotate(-12deg); }
  .panel { position: fixed; inset: auto; margin: 0; padding: 16px; width: 440px; max-width: calc(100vw - 16px);
    background: var(--elevado); color: var(--texto); border: 1px solid var(--borde-fuerte); border-radius: var(--radio-tarjeta); box-shadow: var(--sombra-3); }
  .menu { position: fixed; inset: auto; margin: 0; padding: 8px; min-width: 260px; max-width: 360px; flex-direction: column; gap: 2px;
    background: var(--elevado); color: var(--texto); border: 1px solid var(--borde-fuerte); border-radius: var(--radio-menu); box-shadow: var(--sombra-2); }
  .menu:popover-open { display: flex; }
  .menu h3 { margin: 4px 8px 6px; }
  .menu button { justify-content: flex-start; text-align: left; padding: 6px 8px; }
  .menu button:not(.peligro) { color: var(--texto); }
  .menu hr { border: 0; border-top: 1px solid var(--borde); margin: 6px 0; width: 100%; }
  .menu small { padding: 4px 8px; }
  dialog { flex-direction: column; gap: 12px; min-width: 300px; }
  .tenue-web { margin: 0; color: var(--tenue); font-size: 13px; }
  dialog[open] { display: flex; }
  dialog.fuentes { width: min(760px, 94vw); max-width: none; max-height: 85vh; }
  .scroll { overflow-y: auto; min-height: 120px; display: flex; flex-direction: column; gap: 8px; }
  h4 { margin: 4px 0 0; font-size: 13px; }
  .grilla { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px; }
  .tarjeta { flex-direction: column; align-items: stretch; gap: 6px; padding: 6px; height: auto; border: 1px solid var(--borde); border-radius: var(--radio); background: var(--hondo); }
  .tarjeta[aria-pressed='true'] { border-color: var(--acento); box-shadow: 0 0 0 1px var(--acento); }
  .tarjeta img:not(.ico), .vacio { width: 100%; aspect-ratio: 16 / 9; object-fit: contain; background: var(--hover); border-radius: 4px; display: block; }
  .nombre { display: flex; align-items: center; gap: 6px; min-width: 0; font-size: 13px; text-align: left; }
  .nombre span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ico { width: 16px; height: 16px; flex: none; }
</style>
