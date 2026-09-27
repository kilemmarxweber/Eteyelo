#!/usr/bin/env bash
# À exécuter sur le serveur Ubuntu (klambocore) en root / sudo.
# Corrige le HTTP 413 nginx sur /api/upload/* (défaut client_max_body_size = 1m).
set -euo pipefail

SNIPPET='client_max_body_size 64m;'
CONF_DIR="${NGINX_CONF_DIR:-/etc/nginx}"
TARGET="${CONF_DIR}/conf.d/eteyelo-upload-body-size.conf"

if [[ ! -d "$CONF_DIR" ]]; then
  echo "nginx introuvable dans $CONF_DIR" >&2
  exit 1
fi

echo "$SNIPPET" | sudo tee "$TARGET" > /dev/null
sudo nginx -t
sudo systemctl reload nginx
echo "OK: $TARGET → $SNIPPET"
