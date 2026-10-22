<script lang="ts">
  import type { Track } from 'livekit-client';

  // <video> enganchado a una pista de LiveKit; se re-engancha solo si cambia la pista.
  let { pista, clase = '', etiqueta }: { pista: Track; clase?: string; etiqueta: string } = $props();
  let el = $state<HTMLVideoElement>();
  $effect(() => {
    const t = pista, v = el;
    if (!v) return;
    t.attach(v);
    return () => { t.detach(v); };
  });
</script>

<video bind:this={el} class={clase} autoplay playsinline muted aria-label={etiqueta}></video>
