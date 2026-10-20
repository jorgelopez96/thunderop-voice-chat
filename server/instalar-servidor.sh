#!/usr/bin/env bash
# Instala Thunderop en Ubuntu (Oracle Always Free u otro VPS): PocketBase + LiveKit + Caddy con TLS.
# Uso: sudo bash instalar-servidor.sh midominio.duckdns.org
# Al lado de este script tienen que estar pb_hooks/ y pb_migrations/. Se puede repetir: no pisa claves ni datos.
set -euo pipefail
DOMINIO=${1:?Uso: sudo bash instalar-servidor.sh midominio.duckdns.org}
PB=0.40.5
LK=1.13.10
DEST=/opt/thunderop
ENV=$DEST/thunderop.env
ORIGEN=$(cd "$(dirname "$0")" && pwd)
ARCH=$(dpkg --print-architecture) # arm64 en Oracle Ampere, amd64 en un VPS común

export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -yq unzip caddy netfilter-persistent iptables-persistent

id thunderop &>/dev/null || useradd --system --home "$DEST" --shell /usr/sbin/nologin thunderop
mkdir -p "$DEST/pb_data"
curl -fsSLo /tmp/pb.zip "https://github.com/pocketbase/pocketbase/releases/download/v$PB/pocketbase_${PB}_linux_${ARCH}.zip"
unzip -oq /tmp/pb.zip pocketbase -d "$DEST" && rm /tmp/pb.zip
curl -fsSL "https://github.com/livekit/livekit/releases/download/v$LK/livekit_${LK}_linux_${ARCH}.tar.gz" | tar -xz -C "$DEST" livekit-server
rm -rf "$DEST/pb_hooks" "$DEST/pb_migrations"
cp -r "$ORIGEN/pb_hooks" "$ORIGEN/pb_migrations" "$DEST/"

cat > "$DEST/livekit.yaml" <<YAML
port: 7880
rtc:
  tcp_port: 7881
  port_range_start: 50000
  port_range_end: 50100
  use_external_ip: true
YAML

# Las claves se generan una sola vez; el dominio se reescribe en cada corrida.
if [ -f "$ENV" ]; then . "$ENV"; else
  LIVEKIT_API_KEY=th$(openssl rand -hex 4)
  LIVEKIT_API_SECRET=$(openssl rand -hex 32)
fi
cat > "$ENV" <<VARS
LIVEKIT_KEYS="$LIVEKIT_API_KEY: $LIVEKIT_API_SECRET"
LIVEKIT_API_KEY=$LIVEKIT_API_KEY
LIVEKIT_API_SECRET=$LIVEKIT_API_SECRET
LIVEKIT_URL=wss://$DOMINIO
LIVEKIT_API_URL=http://127.0.0.1:7880
VARS
chmod 600 "$ENV"
chown -R thunderop:thunderop "$DEST"

servicio() { # nombre, comando
  cat > "/etc/systemd/system/thunderop-$1.service" <<UNIT
[Unit]
Description=Thunderop $1
After=network-online.target
Wants=network-online.target

[Service]
User=thunderop
WorkingDirectory=$DEST
EnvironmentFile=$ENV
ExecStart=$2
Restart=always

[Install]
WantedBy=multi-user.target
UNIT
}
servicio livekit "$DEST/livekit-server --config $DEST/livekit.yaml"
servicio pocketbase "$DEST/pocketbase serve --http=127.0.0.1:8090 --dir $DEST/pb_data --migrationsDir $DEST/pb_migrations --hooksDir $DEST/pb_hooks"

# Un solo dominio: la señalización de LiveKit vive en /rtc, todo lo demás es PocketBase.
cat > /etc/caddy/Caddyfile <<CADDY
$DOMINIO {
	handle /rtc* {
		reverse_proxy 127.0.0.1:7880
	}
	# Instalador y actualizaciones de la app (lo que deja npm run release en app/release/).
	handle_path /descargas/* {
		root * $DEST/descargas
		file_server
	}
	handle {
		reverse_proxy 127.0.0.1:8090
	}
}
CADDY

# Las imágenes Ubuntu de Oracle traen iptables que rechaza todo salvo SSH.
abrir() { iptables -C INPUT -p "$1" --dport "$2" -j ACCEPT 2>/dev/null || iptables -I INPUT -p "$1" --dport "$2" -j ACCEPT; }
abrir tcp 80; abrir tcp 443; abrir tcp 7881; abrir udp 50000:50100
netfilter-persistent save

systemctl daemon-reload
systemctl enable thunderop-livekit thunderop-pocketbase caddy
systemctl restart thunderop-livekit thunderop-pocketbase caddy

echo
echo "Listo. Probá en el navegador: https://$DOMINIO/api/health"
echo "(el certificado puede tardar un minuto la primera vez)"
