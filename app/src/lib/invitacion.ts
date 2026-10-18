export function extraerCodigo(entrada: string): string | null {
  const s = entrada.trim().toLowerCase();
  if (/^[a-z0-9]{10}$/.test(s)) return s;
  return s.match(/\/invite\/([a-z0-9]{10})(?:[/?#]|$)/)?.[1] ?? null;
}

export function linkInvitacion(code: string): string {
  return `discordmejorado://invite/${code}`;
}
