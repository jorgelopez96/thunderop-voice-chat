<script lang="ts">
  import { Mic, MicOff, Headphones, HeadphoneOff, ChevronDown, Monitor, AudioWaveform, Music, PhoneOff } from '@lucide/svelte';
  import { voz, alternarMute, ensordecer, cambiarSupresion, salirVoz, transmitir, dejarDeTransmitir, cambiarCalidad, dispositivos, elegirEntrada, elegirSalida } from '../voz.svelte';
  import { grupos } from '../grupos.svelte';
  import { CALIDADES, leerPrefs, type Calidad } from '../prefs';
  import { hayNativo, ventanas, type Ventana } from '../transmisorNativo';
  import Botonera from './Botonera.svelte';
  import Musica from './Musica.svelte';
  import { sesion } from '../sesion.svelte';

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
  // Con el transmisor nativo se elige acá qué compartir; sin él (navegador, o placa sin compresor) lo elige el selector de WebView2.
  const nativo = hayNativo();
  let que = $state('pantalla');
  let listaVentanas = $state<Ventana[]>([]);
  const abrirTransmision = async () => {
    calidad = leerPrefs().calidad;
    d?.showModal();
    if (nativo) { listaVentanas = await ventanas(); if (que !== 'pantalla' && !listaVentanas.some((v) => v.titulo === que)) que = 'pantalla'; }
  };
  // Con una ventana va solo el sonido de su programa; con la pantalla completa, todo menos Thunderop.
  const empezar = () => { d?.close(); transmitir(calidad, nativo ? que : undefined, listaVentanas.find((v) => v.titulo === que)?.pid); };
  const nombreCalidad = (c: Calidad) => `${CALIDADES[c].alto}p · ${CALIDADES[c].fps} fps`;

  // Menú de calidad mientras se transmite (solo con el transmisor nativo: el de WebView2 no la cambia en vivo).
  let menuCalidad = $state<HTMLElement>();
  let posCalidad = $state({ x: 0, y: 0 });
  function abrirCalidad(e: MouseEvent) {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    posCalidad = { x: r.left, y: innerHeight - r.top + 8 };
    menuCalidad?.showPopover();
  }
</script>

<footer class="dock">
  <div class="centro">
    <div class="doble" class:apagado={voz.muteado || voz.sinPermiso}>
      <button class="icono" onclick={alternarMute} disabled={voz.sinPermiso} aria-label={voz.muteado ? 'Activar micrófono' : 'Silenciarme'} title={voz.sinPermiso ? 'El dueño te silenció' : voz.muteado ? 'Activar micrófono' : 'Silenciarme'}>
        {#if voz.muteado || voz.sinPermiso}<MicOff size={20} strokeWidth={1.75} />{:else}<Mic size={20} strokeWidth={1.75} />{/if}
      </button>
      <button class="icono flecha" aria-label="Opciones del micrófono" title="Micrófono y supresión" onclick={(e) => abrirMenu(e, 'entrada')}><ChevronDown size={14} strokeWidth={1.75} /></button>
    </div>
    <div class="doble" class:apagado={voz.ensordecido}>
      <button class="icono" onclick={() => ensordecer(!voz.ensordecido)} aria-label={voz.ensordecido ? 'Activar sonido' : 'Ensordecerme'} title={voz.ensordecido ? 'Activar sonido' : 'Ensordecerme'}>
        {#if voz.ensordecido}<HeadphoneOff size={20} strokeWidth={1.75} />{:else}<Headphones size={20} strokeWidth={1.75} />{/if}
      </button>
      <button class="icono flecha" aria-label="Opciones del sonido" title="Salida de audio" onclick={(e) => abrirMenu(e, 'salida')}><ChevronDown size={14} strokeWidth={1.75} /></button>
    </div>
    <span class="separador"></span>
    {#if voz.transmitiendo}
      {#if voz.calidadEnVivo}
        <div class="doble">
          <button class="icono vivo" onclick={dejarDeTransmitir} aria-label="Dejar de transmitir" title="Dejar de transmitir"><Monitor size={20} strokeWidth={1.75} /></button>
          <button class="icono flecha" aria-label="Calidad de la transmisión" title="Cambiar la calidad" onclick={abrirCalidad}><ChevronDown size={14} strokeWidth={1.75} /></button>
        </div>
      {:else}
        <button class="icono vivo" onclick={dejarDeTransmitir} aria-label="Dejar de transmitir" title="Dejar de transmitir"><Monitor size={20} strokeWidth={1.75} /></button>
      {/if}
    {:else}
      <button class="icono cian" onclick={abrirTransmision} disabled={voz.conectando} aria-label="Transmitir" title="Transmitir pantalla"><Monitor size={20} strokeWidth={1.75} /></button>
    {/if}
    <button class="icono magenta" aria-pressed={abiertoSonidos} popovertarget="dock-sonidos" onclick={ubicarPanel} aria-label="Sonidos" title="Sonidos"><AudioWaveform size={20} strokeWidth={1.75} /></button>
    <button class="icono violeta" aria-pressed={abiertoMusica} popovertarget="dock-musica" onclick={ubicarPanel} aria-label="Música" title="Música"><Music size={20} strokeWidth={1.75} /></button>
    <span class="separador"></span>
    <button class="icono colgar" onclick={salirVoz} aria-label="Desconectarse" title="Desconectarse"><PhoneOff size={20} strokeWidth={1.75} /></button>
  </div>
</footer>

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

<dialog bind:this={d}>
  <h3>Transmitir pantalla</h3>
  {#if nativo}
    <label>Qué compartir
      <select bind:value={que}>
        <option value="pantalla">Pantalla completa</option>
        {#each listaVentanas as v (v.pid + v.titulo)}<option value={v.titulo}>{v.titulo}</option>{/each}
      </select>
    </label>
  {/if}
  <label>Calidad
    <select bind:value={calidad}>{#each Object.keys(CALIDADES) as c (c)}<option value={c}>{nombreCalidad(c as Calidad)}</option>{/each}</select>
  </label>
  <div class="fila" style="justify-content:flex-end">
    <button class="plano" onclick={() => d?.close()}>Cancelar</button>
    <button class="primario" onclick={empezar}>Empezar</button>
  </div>
</dialog>

<style>
  .dock { flex: none; height: 56px; display: flex; align-items: center; justify-content: center; gap: 16px; padding: 0 16px; background: var(--panel); border-top: 1px solid var(--borde); }
  .centro { display: flex; align-items: center; gap: 8px; }
  .doble { display: flex; border-radius: var(--radio); background: var(--hover); }
  .doble .icono { border-radius: 0; height: 40px; }
  .doble .icono:first-child { width: 44px; border-radius: var(--radio) 0 0 var(--radio); }
  .flecha { width: 20px; border-left: 1px solid var(--borde) !important; border-radius: 0 var(--radio) var(--radio) 0 !important; }
  .doble.apagado { background: var(--peligro-suave); }
  .doble.apagado .icono:first-child { color: var(--peligro); }
  .separador { width: 1px; height: 24px; background: var(--borde); margin: 0 4px; }
  .centro > .icono { width: 40px; height: 40px; }
  .cian { color: var(--cian); }
  .magenta { color: var(--magenta); }
  .violeta { color: var(--acento); }
  .vivo { background: var(--ok-suave); color: #fff; }
  .centro > .colgar { width: 56px; background: var(--peligro); color: #fff; }
  .centro > .colgar:hover { background: color-mix(in srgb, var(--peligro) 85%, #000); }
  .panel { position: fixed; inset: auto; margin: 0; padding: 16px; width: 440px; max-width: calc(100vw - 16px);
    background: var(--elevado); color: var(--texto); border: 1px solid var(--borde); border-radius: var(--radio-tarjeta); }
  .menu { position: fixed; inset: auto; margin: 0; padding: 8px; min-width: 260px; max-width: 360px; flex-direction: column; gap: 2px;
    background: var(--elevado); color: var(--texto); border: 1px solid var(--borde); border-radius: var(--radio-menu); }
  .menu:popover-open { display: flex; }
  .menu h3 { margin: 4px 8px 6px; }
  .menu button { justify-content: flex-start; text-align: left; padding: 6px 8px; }
  .menu hr { border: 0; border-top: 1px solid var(--borde); margin: 6px 0; width: 100%; }
  .menu small { padding: 4px 8px; }
  dialog { flex-direction: column; gap: 12px; min-width: 300px; }
  dialog[open] { display: flex; }
  select { font: inherit; color: var(--texto); background: var(--hondo); border: 1px solid var(--borde); border-radius: var(--radio); padding: 8px 12px; }
</style>
