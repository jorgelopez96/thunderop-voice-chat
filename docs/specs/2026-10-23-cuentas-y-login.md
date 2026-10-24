# Cuentas y login: registro con invitación, confirmación por mail y Google/Outlook

Fecha: 2026-10-23 · Estado: diseño aprobado por Jorge en la charla, falta el plan.
Proyecto siguiente (aparte, se diseña después): moderación (denunciar, bloquear, suspender, banear).

## Por qué

Hoy cualquiera se crea una cuenta con mail y contraseña y listo: no hay confirmación del mail, ni "olvidé mi
contraseña", ni entrar con Google, y el registro del servidor está abierto a cualquiera que conozca la dirección
(el código de invitación solo protege la descarga en la página). Jorge quiere que Thunderop tenga cuentas "como
toda app": seguras, con mail confirmado, usuario único, edad mínima y términos aceptados, y que solo entre gente
invitada. Para que todo quede prolijo se borra el servidor y cada uno se registra de nuevo con el proceso nuevo.

## Lo que hay hoy (relevado en producción el 2026-10-23, solo lectura)

- PocketBase 0.40.5 en el WSL de la PC de Jorge (`/opt/thunderop`), detrás de `https://thunderop.duckdns.org`.
- `users`: solo `passwordAuth` con identidad `email`; `oauth2`, `otp` y `mfa` apagados; `createRule = ""` (abierto).
- SMTP apagado con los datos de ejemplo (`smtp.example.com`); `meta.senderAddress = support@example.com`;
  `meta.appURL = http://localhost:8090` (hay que poner la dirección pública).
- 4 usuarios, ninguno verificado. Límite de intentos activo (`*:auth` 2 cada 3 s) y token de 30 días.
- `name` es único (índice NOCASE) y es lo que se usa para pedir amistad (`/api/amigos/solicitar` busca por
  `name`). Login en `app/src/lib/sesion.svelte.ts` y `app/src/lib/vistas/Entrar.svelte`.
- La página (`D:\PROYECTOS\Thunderop-Website`, SvelteKit en Vercel) pide un código para bajar el instalador
  (hoy `Tunderopi`, hash en `src/lib/server/descarga.ts`, POST `/descargar`).
- Jorge compró **thunderop.com** en Cloudflare (cuenta personal) para los mails.

## Objetivos

1. **Invitación una sola vez.** Crear la cuenta es libre (en la página y en la app), pero una cuenta no puede
   usar nada (grupos, chat, voz, amigos) hasta que puso el código de invitación **`<código de invitación>`** una vez. Queda
   guardado en la cuenta y no se vuelve a pedir nunca, ni en la app ni en la futura versión de navegador.
   La descarga del instalador en la página sigue pidiendo el mismo código.
2. **Registro manual completo, después el código del mail.** El formulario pide: mail, usuario, apodo,
   contraseña, fecha de nacimiento y aceptar términos y privacidad. Al enviarlo llega un mail con un **código de
   6 números**; con el código la cuenta queda confirmada. Sin confirmar no se puede usar la app.
3. **Usuario único y fijo.** 3 a 20 caracteres: letras sin acentos, números, punto y guion bajo, en minúsculas.
   No se puede cambiar después. Se entra con usuario **o** mail + contraseña. Para agregar a alguien de amigo se
   usa su usuario exacto.
4. **Apodo libre.** El "nombre que se muestra" (el `name` de hoy) se puede cambiar cuando uno quiera, puede tener
   espacios y acentos, y **deja de ser único**.
5. **Contraseña segura.** Mínimo 8 caracteres, con al menos una mayúscula, un número y un carácter especial. El
   formulario muestra en vivo qué requisito falta. El servidor lo exige también (no solo la app).
6. **Edad.** Fecha de nacimiento obligatoria. Menos de 13 años: no se puede registrar. 13 a 17: cuenta
   marcada como **menor**. 18 o más: **mayor**. La fecha no la ve nadie más y no se puede cambiar.
7. **Olvidé mi contraseña** con un código de 6 números al mail y después la contraseña nueva (sin links).
8. **Entrar con Google y con Microsoft (Outlook).** La primera vez, la app hace completar lo que falta (usuario,
   fecha de nacimiento, aceptar términos, y el código de invitación si esa cuenta no lo puso). No se pide el código
   de 6 números porque Google/Microsoft ya confirmaron el mail. Un mismo mail es una sola cuenta: si alguien se
   registró con contraseña y después entra con Google con ese mail, entra a la misma cuenta.
9. **Términos y condiciones + política de privacidad** publicados en la página web. Al registrarse hay que
   tildarlos; se guarda qué versión aceptó y cuándo; si cambia la versión, la app vuelve a pedir aceptarlos. Los
   términos dicen, entre lo típico de una app de chat, que mentir con la edad u otros datos o romper las reglas
   puede terminar en suspensión o baneo de la cuenta. Claude escribe un borrador; Jorge sabe que conviene que lo
   revise un abogado antes de abrir la app a desconocidos (rige la ley argentina de datos personales 25.326).
10. **Mails en castellano** con el nombre de Thunderop, enviados desde `no-responder@thunderop.com`.
11. **Arranque limpio.** Se borra todo lo del servidor (usuarios, grupos, salas, mensajes, privados, amigos,
    sonidos, música, invitaciones) con un **backup completo antes**. La primera cuenta que se crea es la de Jorge,
    por el mismo camino que cualquiera (con el código).
12. **La página web** cambia el código de descarga a `<código de invitación>` y gana **todo el manejo de la cuenta**, igual
    que la app: crear la cuenta (mismo formulario y reglas), el código de 6 números, entrar con usuario/mail +
    contraseña o con Google/Outlook, completar el perfil (y el código de invitación si falta) y "olvidé mi
    contraseña". La cuenta es la misma del servidor PocketBase. Ya adentro, la página muestra la cuenta y la
    descarga del instalador; **no** tiene chat, voz ni transmisión (la app de PC sigue en beta y faltan Linux y
    otras plataformas). El botón "Iniciar sesión" que hoy dice "Próximamente" pasa a ser este login.

## No objetivos (por ahora)

- Entrar con Apple (cuesta US$ 99/año el programa de desarrolladores; queda preparado para más adelante).
- Verificación en dos pasos, cambiar el usuario, borrar la cuenta desde la web.
- La versión de navegador de la app: chat, voz y transmisión desde la web (la página solo maneja la cuenta y la
  descarga; queda definido que el código se pide una vez por cuenta).
- Versiones para Linux u otras plataformas.
- Moderación: es el proyecto siguiente.

## Anti-objetivos (sería un fracaso aunque funcione)

- Que el código de invitación o las reglas de contraseña/edad se puedan saltear hablándole directo a la API del
  servidor: toda regla se valida **en el servidor**; la app y la página solo ayudan.
- Que alguien sin invitación pueda ver grupos, usuarios o mandar mensajes.
- Que el código de invitación quede escrito en la app o en el HTML de la página.
- Que se pierdan datos al borrar sin el backup hecho y verificado.
- Romper "Recordar mi cuenta", la sesión de 30 días o el límite de intentos que ya existen.

## Restricciones

- Servidor: PocketBase 0.40.5 (hooks en JS, migraciones en `server/pb_migrations`), tests con vitest en
  `server/tests`. App: Tauri 2 + Svelte 5; la ventana niega ventanas nuevas, así que OAuth2 abre el navegador
  del sistema (`authWithOAuth2` con `urlCallback`, el resultado vuelve por realtime).
- Desplegar a producción (hooks, migraciones, configuración, borrar datos) es una acción que Jorge confirma; el
  modo automático de Claude Code puede bloquearla y entonces la corre Jorge.
- Publicar la página (push a main = deploy en Vercel) y la app (`npm run release`, copiar a `/opt/thunderop/descargas`)
  se confirma con Jorge.
- Sin dinero extra: envío de mails con un plan gratis; Google Cloud y Microsoft Entra para OAuth son gratis.
- No guardar en el repo claves, contraseñas de SMTP ni secretos de OAuth (van en la configuración del servidor).

## Lo que necesita a Jorge (no lo puede hacer Claude)

- Cuenta en el servicio de envío de mails y cargar sus registros DNS en Cloudflare (Claude guía paso a paso).
- Registrar la app en Google Cloud (pantalla de consentimiento + cliente OAuth) y en Microsoft Entra (registro de
  aplicación), y pasar los ids y secretos para cargarlos en el servidor. Claude guía.
- Confirmar el borrado y el despliegue.

## Decisiones que tomó Claude (Jorge puede corregirlas)

- Usuario: 3–20 caracteres `[a-z0-9._]`, minúsculas.
- La cuenta "invitada" se marca en el servidor; el código vive en la configuración del servidor (variable de
  entorno), no en el código de la app ni de la página. Cambiar el código no afecta a quien ya lo puso.
- Edad: la categoría (menor/mayor) se calcula desde la fecha; la fecha es privada (solo la ve el dueño de la cuenta).
- Términos con versión: subir la versión hace que la app pida aceptarlos de nuevo.
- Google/Microsoft no piden el código de 6 números; mismo mail = misma cuenta.
- Se mantienen "Recordar mi cuenta", sesión de 30 días y límites de intentos.
- Microsoft: solo cuentas **personales** (outlook/hotmail/live, tenant `consumers`), que es lo que pidió Jorge
  ("Outlook"). Las de trabajo o escuela no entran: su mail no siempre viene verificado.
- Unir cuentas por mail solo si la cuenta existente **ya confirmó el mail**. Si existe una cuenta con ese mail
  sin confirmar y alguien entra con Google/Microsoft, la cuenta sin confirmar se descarta y queda la de
  Google/Microsoft (evita que alguien registre el mail de otro y espere).
- Las cuentas que no confirman el mail en **24 horas** se borran solas (tarea programada del servidor), así nadie
  reserva usuarios o mails ajenos.
- El servidor exige, además de "invitado" y "confirmado", haber aceptado la **versión vigente** de los términos.
  La versión vigente vive en la configuración del servidor (variable de entorno) y la página publica el texto con
  ese mismo número; subirla es un cambio manual en los dos lugares.
- Ser **menor** por ahora solo queda guardado (y se usa en los términos); qué limita se decide en el proyecto de
  moderación.
- Cambiar el mail de la cuenta: **no entra** en este proyecto.
- Apps viejas (0.4/0.5): se publica la 0.6.0 **antes** del borrado, así el actualizador la ofrece; después del
  borrado, una app vieja no puede registrarse (el servidor rechaza el formulario viejo) y muestra el error.
- En la página, una cuenta ya invitada baja el instalador sin volver a escribir el código; sin sesión, la
  descarga sigue pidiendo el código como hoy.
- OAuth en la página y en la app usa el flujo de PocketBase (la vuelta llega a `/api/oauth2-redirect` del
  servidor y el resultado viaja por realtime), así en Google y Microsoft se registra una sola dirección de vuelta.
- Un solo código: la página valida el código de descarga preguntándole al servidor (misma variable que usa el
  registro), y se borra el hash de `src/lib/server/descarga.ts`. Cambiar el código es tocar un solo lugar.

## Lo que queda a criterio de quien lo construya

- Qué servicio de envío usar (Resend, Brevo u otro con plan gratis y dominio verificado por DNS) y el diseño de
  los mails.
- Cómo se implementa el código de 6 números (OTP de PocketBase con largo 6, o hook propio) y la expiración
  (sugerido: 10 minutos, con reenvío limitado).
- Cómo se separa el apodo del usuario en la base (campo nuevo `username` único, `name` deja de ser único) y cómo se
  adapta lo que hoy busca por `name` (amigos, presencia, menciones).
- La pantalla de "completar perfil" para Google/Outlook y para quien todavía no puso el código.
- Cómo se ordena el despliegue (backup → borrado → migraciones → configuración → app 0.6.0 → página).
