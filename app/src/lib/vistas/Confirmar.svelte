<script lang="ts">
  let { texto, confirmar, cancelar }: { texto: string; confirmar: () => void; cancelar: () => void } = $props();
  let d: HTMLDialogElement;
  $effect(() => { if (!d.open) d.showModal(); });
</script>

<dialog bind:this={d} oncancel={cancelar}>
  <p>{texto}</p>
  <button onclick={confirmar}>Confirmar</button>
  <button onclick={cancelar}>Cancelar</button>
</dialog>
