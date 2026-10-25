<script lang="ts">
  // T con rayo: glifo relleno en el color del tema; `texto` suma "THUNDEROP" al lado.
  let { tam = 18, texto = true }: { tam?: number; texto?: boolean } = $props();
</script>

<span class="marca" style="font-size:{Math.round(tam * 0.72)}px">
  <svg viewBox="0 0 24 24" width={tam} height={tam} fill="currentColor" aria-hidden="true">
    <path d="M4.2 2h15.6A1.2 1.2 0 0 1 21 3.2v2.1a1.2 1.2 0 0 1-1.2 1.2h-4.6L13.4 11.2H17L10 22.6l1.4-7.6H7.8l1.4-8.5H4.2A1.2 1.2 0 0 1 3 5.3V3.2A1.2 1.2 0 0 1 4.2 2z" />
  </svg>
  {#if texto}<span class="nombre">THUNDEROP</span>{/if}
</span>

<style>
  .marca { display: inline-flex; align-items: center; gap: .45em; color: var(--acento); line-height: 1; }
  .nombre { color: var(--texto); font-weight: 750; letter-spacing: .08em; }
</style>
