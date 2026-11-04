<script lang="ts">
  import { Play, Square } from '@lucide/svelte';
  import { moverManija, picos, formatoSegundos, MAX_SEGUNDOS, type Seleccion } from '../botoneraLogica';

  // Forma de onda con dos manijas para elegir qué pedazo del audio se sube (hasta 10 s).
  let { audio, sel = $bindable() }: { audio: AudioBuffer; sel: Seleccion } = $props();
  const dur = $derived(audio.duration);
  const forma = $derived(picos(audio.getChannelData(0), 160));
  // Normalizada al pico más alto: un audio bajito también se ve.
  const trazo = $derived.by(() => {
    const max = Math.max(0.01, ...forma);
    return forma.map((p, i) => `M${i + 0.5} ${50 - (p / max) * 46 - 1}V${50 + (p / max) * 46 + 1}`).join('');
  });
  const pct = (t: number) => `${(t / dur) * 100}%`;
  const manijas = ['inicio', 'fin'] as const;
  let pista = $state<HTMLDivElement>();

  function arrastrar(e: PointerEvent, cual: keyof Seleccion) {
    const el = e.currentTarget as HTMLElement;
    if (e.type === 'pointerdown') { el.setPointerCapture(e.pointerId); el.focus(); }
    else if (!el.hasPointerCapture(e.pointerId)) return;
    const r = pista!.getBoundingClientRect();
    sel = moverManija(sel, cual, ((e.clientX - r.left) / r.width) * dur, dur);
  }

  function tecla(e: KeyboardEvent, cual: keyof Seleccion) {
    const paso = e.shiftKey || e.key.startsWith('Page') ? 1 : 0.1;
    const t = { ArrowLeft: -paso, ArrowDown: -paso, PageDown: -paso, ArrowRight: paso, ArrowUp: paso, PageUp: paso }[e.key];
    if (t !== undefined) sel = moverManija(sel, cual, sel[cual] + t, dur);
    else if (e.key === 'Home') sel = moverManija(sel, cual, 0, dur);
    else if (e.key === 'End') sel = moverManija(sel, cual, dur, dur);
    else return;
    e.preventDefault();
  }

  let ctx: AudioContext | undefined;
  let fuente = $state<AudioBufferSourceNode>();
  function escuchar() {
    if (fuente) return fuente.stop();
    ctx ??= new AudioContext();
    const f = ctx.createBufferSource();
    f.buffer = audio;
    f.connect(ctx.destination);
    f.onended = () => { f.disconnect(); if (fuente === f) fuente = undefined; };
    f.start(0, sel.inicio, sel.fin - sel.inicio);
    fuente = f;
  }
  $effect(() => () => { ctx?.close().catch(() => {}); });
</script>

<div class="recorte">
  <div class="pista" bind:this={pista}>
    <svg viewBox="0 0 {forma.length} 100" preserveAspectRatio="none" aria-hidden="true"><path d={trazo} /></svg>
    <div class="sel" style:left={pct(sel.inicio)} style:width={pct(sel.fin - sel.inicio)}></div>
    {#each manijas as cual (cual)}
      <div class="manija" role="slider" tabindex="0" style:left={pct(sel[cual])}
        aria-label={cual === 'inicio' ? 'Inicio del recorte' : 'Fin del recorte'}
        aria-valuemin={0} aria-valuemax={Math.round(dur * 10) / 10} aria-valuenow={Math.round(sel[cual] * 10) / 10}
        aria-valuetext={formatoSegundos(sel[cual])}
        onpointerdown={(e) => arrastrar(e, cual)} onpointermove={(e) => arrastrar(e, cual)} onkeydown={(e) => tecla(e, cual)}></div>
    {/each}
  </div>
  <div class="info">
    <button type="button" class="plano" onclick={escuchar}>
      {#if fuente}<Square size={14} strokeWidth={1.75} /> Parar{:else}<Play size={14} strokeWidth={1.75} /> Escuchar recorte{/if}
    </button>
    <span aria-live="polite"><b>{formatoSegundos(sel.fin - sel.inicio)}</b> de {formatoSegundos(dur)}{#if dur > MAX_SEGUNDOS}{` · máximo ${MAX_SEGUNDOS} s`}{/if}</span>
  </div>
</div>

<style>
  .recorte { display: flex; flex-direction: column; gap: 8px; }
  .pista { position: relative; height: 72px; border: 1px solid var(--borde); border-radius: var(--radio); background: var(--hondo); overflow: hidden; touch-action: none; }
  svg { position: absolute; inset: 0; width: 100%; height: 100%; }
  path { stroke: var(--acento); stroke-width: 2px; vector-effect: non-scaling-stroke; }
  /* La sombra gigante oscurece lo que queda afuera del recorte. */
  .sel { position: absolute; top: 0; bottom: 0; background: var(--acento-suave); box-shadow: 0 0 0 9999px rgb(0 0 0 / .65); pointer-events: none; }
  .manija { position: absolute; top: 0; bottom: 0; width: 16px; margin-left: -8px; cursor: ew-resize; outline: none; }
  .manija::before { content: ''; position: absolute; top: 0; bottom: 0; left: 6px; width: 4px; border-radius: var(--radio-pildora); background: var(--acento-texto); }
  .manija:focus-visible::before { background: var(--texto); box-shadow: 0 0 0 2px var(--foco); }
  .info { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: var(--tenue); font-size: 13px; }
  .info b { color: var(--texto); font-weight: 600; }
  .info button { gap: 6px; padding-left: 0; }
</style>
