# Guía: subir Thunderop para que lo usen tus amigos

Son tres partes: el servidor en Oracle (una vez), el instalador de la app (cada versión nueva) y lo que hacen tus amigos.

## 1. Dominio gratis (DuckDNS, 5 min)
1. Entrá a https://www.duckdns.org con tu cuenta de Google.
2. Creá un subdominio, por ejemplo `thunderop` → queda `thunderop.duckdns.org`.
3. La IP la cargás en el paso 2.5.

Si algún día cambiás de servidor, solo cambiás la IP acá: la app de tus amigos sigue andando sin reinstalar.

## 2. Servidor en Oracle Cloud Always Free (30–60 min)
1. Creá la cuenta en https://www.oracle.com/cloud/free/. Pide tarjeta para verificar (no cobra si te quedás en lo gratis). **La región que elijas no se cambia después**: elegí la más cercana (São Paulo o Santiago).
2. *Compute → Instances → Create instance*:
   - Imagen: **Ubuntu 24.04**.
   - Shape: **VM.Standard.A1.Flex** (Ampere), 2 OCPU y 12 GB alcanzan de sobra (lo gratis llega a 4 OCPU / 24 GB).
   - Descargá la **clave SSH privada** que te ofrece y guardala (por ejemplo en `C:\Users\jorgl\.ssh\oracle.key`).
   - Si dice *Out of capacity*, probá otro "availability domain" o más tarde: es común con Ampere.
3. Anotá la **IP pública** de la instancia.
4. Abrí los puertos en Oracle: en la instancia, *Subnet → Security List → Add Ingress Rules*, origen `0.0.0.0/0`:
   - TCP `80`, TCP `443`, TCP `7881`
   - UDP `50000-50100`
5. En DuckDNS, pegá la IP pública en tu subdominio y tocá *update ip*.
6. Desde PowerShell, parado en la carpeta `server` del proyecto:
   ```powershell
   scp -i $HOME\.ssh\oracle.key -r pb_hooks pb_migrations instalar-servidor.sh ubuntu@TU_IP:thunderop/
   ssh -i $HOME\.ssh\oracle.key ubuntu@TU_IP
   ```
   Ya dentro del servidor:
   ```bash
   sudo bash thunderop/instalar-servidor.sh thunderop.duckdns.org
   ```
7. Abrí `https://thunderop.duckdns.org/api/health` en el navegador. Si responde `{"message":"API is healthy."...}`, el servidor está andando.

Opcional, para entrar al panel de PocketBase (`https://thunderop.duckdns.org/_/`):
```bash
sudo -u thunderop /opt/thunderop/pocketbase superuser upsert tu@mail.com UNA_CLAVE --dir /opt/thunderop/pb_data
```

**Ojo:** Oracle puede reclamar instancias gratis que pasan días casi sin uso. Si pasa, se arma otra y se hace la mudanza (abajo). Pasar la cuenta a *Pay As You Go* lo evita y sigue sin cobrar mientras no te pases de lo gratis.

## 3. Instalador para tus amigos (10 min, cada versión)
En la carpeta `app`:
```powershell
npm install
npm run release -- thunderop.duckdns.org
```
El instalador queda en `app\src-tauri\target\release\bundle\nsis\` (un `.exe`). Subilo a Google Drive o a un Release de GitHub y pasales el link.

## 4. Lo que hacen tus amigos
1. Bajan el `.exe` y lo abren.
2. Windows va a decir *"Windows protegió su PC"* porque la app no está firmada: *Más información → Ejecutar de todas formas*.
3. Crean su cuenta en la app y entran al grupo con el código de invitación que les pases.

## Mudanza a otro servidor
1. En el viejo: `sudo systemctl stop thunderop-pocketbase` y copiá `/opt/thunderop/pb_data` y `/opt/thunderop/thunderop.env`.
2. En el nuevo: repetí 2.2–2.6 y, antes de correr el script, poné esos dos en `/opt/thunderop/` (el script no pisa ni claves ni datos).
3. Cambiá la IP en DuckDNS. Nadie reinstala nada.

## Si algo no anda
- Ver logs: `journalctl -u thunderop-pocketbase -n 50`, `journalctl -u thunderop-livekit -n 50`, `journalctl -u caddy -n 50`.
- El chat anda pero la voz no: casi siempre son los puertos UDP `50000-50100` o TCP `7881` del paso 2.4.
