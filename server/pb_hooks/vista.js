// Ayudantes de la vista previa de links (ver vista.pb.js). Necesitan `getent` y `curl` (el servidor Linux los trae).

/** Host del link si es https al puerto 443 por nombre (sin IPs, localhost ni nombres internos); si no, "". */
function hostValido(url) {
  const m = /^https:\/\/([^\/?#:@]+)([\/?#].*)?$/i.exec(url || "");
  const host = m ? m[1].toLowerCase() : "";
  if (!host || !host.includes(".") || /^[\d.]+$/.test(host) || host === "localhost" || /\.(local|localhost|internal|lan|home|arpa)$/.test(host)) return "";
  return host;
}

/** IP interna, de loopback, link-local, CGNAT, multicast o sin especificar (v4 y v6). */
function ipPrivada(ip) {
  ip = ip.toLowerCase();
  const v4 = /^(?:::ffff:)?(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(ip);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  return ip === "::" || ip === "::1" || /^f[cd]/.test(ip) || /^fe[89ab]/.test(ip) || /^ff/.test(ip) || ip.startsWith("::ffff:");
}

/** Primera IP pública del host; si alguna de sus IPs es interna (o no resuelve), null. */
function ipPublica(host) {
  let out = "";
  try { out = toString($os.cmd("getent", "ahosts", host).output()); } catch (_) { return null; }
  const ips = [...new Set(out.split("\n").map((l) => l.trim().split(/\s+/)[0]).filter(Boolean))];
  if (!ips.length || ips.some(ipPrivada)) return null;
  return ips[0];
}

// ponytail: sin tope de tamaño (solo 4 s); si alguien abusa con páginas enormes, cortar con un proxy o leer por partes.
/** HTML de la página (lo que baje en 4 s), siguiendo hasta 3 redirecciones revisadas una por una. "" si no se pudo. */
function traer(url) {
  for (let salto = 0; salto < 4; salto++) {
    const host = hostValido(url);
    const ip = host && ipPublica(host);
    if (!ip) return "";
    const fijo = ip.includes(":") ? `[${ip}]` : ip;
    let crudo = "";
    try {
      crudo = toString($os.cmd("curl", "-s", "--max-time", "4", "--proto", "=https", "--max-redirs", "0",
        "-A", "Mozilla/5.0 (Thunderop vista previa)", "-H", "Accept: text/html", "--resolve", `${host}:443:${fijo}`,
        "-w", "\n__fin__ %{http_code} %{redirect_url}", url).output());
    } catch (_) { return ""; }
    const i = crudo.lastIndexOf("\n__fin__ ");
    if (i < 0) return "";
    const [codigo, destino] = crudo.slice(i + 9).trim().split(" ");
    if (codigo === "200") return crudo.slice(0, i);
    if (!/^30[12378]$/.test(codigo) || !destino) return "";
    url = destino;
  }
  return "";
}

module.exports = { hostValido, ipPrivada, traer };
