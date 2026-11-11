export function extraerCodigo(entrada: string): string | null {
  const s = entrada.trim().toLowerCase();
  if (/^[a-z0-9]{10}$/.test(s)) return s;
  return s.match(/\/invite\/([a-z0-9]{10})(?:[/?#]|$)/)?.[1] ?? null;
}

export function linkInvitacion(code: string): string {
  return `thunderop://invite/${code}`;
}

/** Una invitación dentro de un mensaje (`thunderop://invite/<código>`): el código y el texto sin el link, para mostrarla
 *  como tarjeta. La primera, si hay varias. */
export function invitacionEnTexto(texto: string): { codigo: string; resto: string } | null {
  const m = texto.match(/thunderop:\/\/invite\/([a-z0-9]{10})(?![a-z0-9])/i);
  if (!m) return null;
  return { codigo: m[1].toLowerCase(), resto: texto.replace(m[0], ' ').replace(/\s+/g, ' ').trim() };
}
