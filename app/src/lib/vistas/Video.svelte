<script lang="ts">
  import type { Track } from 'livekit-client';

  // <video> enganchado a una pista de LiveKit; se re-engancha solo si cambia la pista.
  let { pista, clase = '', etiqueta }: { pista: Track; clase?: string; etiqueta: string } = $props();
  let el = $state<HTMLVideoElement>();
  // Derivada: solo cambia si cambia la pista. Leyendo la prop directo, el efecto corría con cada cambio de quien la
  // calcula (la cámara sobre la pantalla sale de un objeto nuevo en cada actualización de la sala) y el video titilaba.
  const actual = $derived(pista);
  $effect(() => {
    const t = actual, v = el;
    if (!v) return;
    t.attach(v);
    return () => { t.detach(v); };
  });
</script>

<video bind:this={el} class={clase} autoplay playsinline muted aria-label={etiqueta}></video>
