// Envío de mails y manejo de los códigos de 6 números (se guardan solo como hash).

const MSG_CODIGO = "El código no es válido o venció.";
const MAX_INTENTOS = 5;

function enviar(app, para, asunto, html) {
  if ($os.getenv("THUNDEROP_MAIL") === "log") {
    app.logger().info("mail", "para", para, "asunto", asunto, "html", html);
    return;
  }
  const meta = app.settings().meta;
  app.newMailClient().send(new MailerMessage({
    from: { address: meta.senderAddress, name: meta.senderName },
    to: [{ address: para }],
    subject: asunto,
    html,
  }));
}

function buscar(app, tabla, filtro, params) {
  try { return app.findFirstRecordByFilter(tabla, filtro, params); } catch (_) { return null; }
}

// Sin distinguir mayúsculas: el índice único del mail es COLLATE NOCASE y PocketBase lo respeta.
function buscarCuenta(app, email) {
  try { return app.findAuthRecordByEmail("users", String(email || "").trim()); } catch (_) { return null; }
}

// Valida el código y lo gasta; `aplicar(tx, user)` corre en la misma transacción, así que un
// código válido no se gasta si falla el guardado ni se canjea dos veces. El intento se cuenta
// dentro de la transacción (escrituras en serie), y el 400 se lanza afuera para no revertirlo.
function canjear(app, email, tipo, codigo, aplicar) {
  let ok = false;
  app.runInTransaction((tx) => {
    const user = buscarCuenta(tx, email);
    const reg = user && buscar(tx, "codigos", "user = {:u} && tipo = {:t}", { u: user.id, t: tipo });
    if (!reg) return;

    const vigente = reg.getDateTime("expira").time().unix() > Math.floor(Date.now() / 1000);
    const intentos = reg.getInt("intentos") + 1;
    if (vigente && $security.equal(reg.getString("hash"), $security.sha256(String(codigo || "")))) {
      tx.delete(reg);
      aplicar(tx, user);
      ok = true;
    } else {
      // un código agotado se anula pero no se borra: guarda el conteo de emisiones de /api/cuenta/codigo
      reg.set("intentos", intentos);
      if (!vigente || intentos >= MAX_INTENTOS) reg.set("hash", "");
      tx.save(reg);
    }
  });
  if (!ok) throw new BadRequestError(MSG_CODIGO);
}

module.exports = { enviar, canjear, buscarCuenta };
