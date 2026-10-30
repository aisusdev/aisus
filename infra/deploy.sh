#!/usr/bin/env bash
#
# Deploys a ref of the public repository to the server that aws-up.sh made. The server builds the
# cloud's image itself; nothing is built here.
#
#   infra/deploy.sh --setup      # once, on a fresh server: Docker, swap and the clone
#   infra/deploy.sh              # origin/main
#   infra/deploy.sh v0.3.0       # any ref the public repository has
#
# Secrets live in ~/.config/aisus/secrets.env (env.example lists them). The generated ones are made
# on first use and kept there. On the first deploy, Umami's admin password is changed from its
# default and the site's Umami website is created. Without DOMAIN the site answers on <ip>.sslip.io.
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd)
state=$HOME/.config/aisus
secrets=$state/secrets.env
[[ -f $state/server.env ]] || { echo "Run infra/aws-up.sh first." >&2; exit 1; }
. "$state/server.env"
touch "$secrets"
chmod 600 "$secrets"
REPO_URL=${AISUS_REPO:-https://github.com/kerktaiheng/aisus.git}

ssh_server() {
  ssh -i "$state/aisus.pem" -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile="$state/known_hosts" -o ConnectTimeout=15 "ec2-user@$AISUS_HOST" "$@"
}

if [[ ${1:-} == --setup ]]; then
  ssh_server "sudo AISUS_REPO='$REPO_URL' bash -s" < "$here/server-setup.sh"
  exit
fi
REF=${1:-main}

# A value is read without the spaces a paste can leave around it.
setting() { grep -m1 "^$1=" "$secrets" | cut -d= -f2- | sed 's/^[[:space:]]*//; s/[[:space:]]*$//' || true; }
remember() {
  sed -i "/^$1=/d" "$secrets"
  printf '%s=%s\n' "$1" "$2" >> "$secrets"
}
for name in NEXTAUTH_SECRET METRICS_TOKEN UMAMI_APP_SECRET UMAMI_DB_PASSWORD UMAMI_ADMIN_PASSWORD GRAFANA_ADMIN_PASSWORD; do
  [[ -n "$(setting "$name")" ]] || remember "$name" "$(openssl rand -hex 24)"
done
DOMAIN=$(setting DOMAIN)
[[ -n $DOMAIN ]] || DOMAIN="${AISUS_HOST//./-}.sslip.io"
if [[ -z "$(setting GITHUB_CLIENT_ID)" ]]; then
  echo "GITHUB_CLIENT_ID is not set yet, so sign-in will not work. The rest of the site deploys." >&2
fi

# The server's .env holds exactly what compose.yaml reads. Each value is single-quoted, which Bash
# and Compose both read literally. A price such as "$10 per seat a month" therefore stays as written.
quoted() {
  [[ $2 != *"'"* ]] || { echo "$1 holds a single quote, which the server's .env cannot carry." >&2; exit 1; }
  printf "%s='%s'\n" "$1" "$2"
}
server_env() {
  local name
  quoted DOMAIN "$DOMAIN"
  for name in NEXTAUTH_SECRET GITHUB_CLIENT_ID GITHUB_CLIENT_SECRET STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET STRIPE_PRO_PRICE STRIPE_TEAM_PRICE \
    AISUS_PRO_PRICE_TEXT AISUS_TEAM_PRICE_TEXT AISUS_PAYMENTS AISUS_RELEASES_REPO UMAMI_WEBSITE_ID METRICS_TOKEN UMAMI_APP_SECRET UMAMI_DB_PASSWORD GRAFANA_ADMIN_PASSWORD; do
    quoted "$name" "$(setting "$name")"
  done
  [[ -n "$(setting GITHUB_CLIENT_ID)" ]] || printf 'GITHUB_CLIENT_ID=not-set\nGITHUB_CLIENT_SECRET=not-set\n'
}
write_env() {
  server_env | ssh_server "umask 077 && cat > aisus/infra/.env"
  setting METRICS_TOKEN | ssh_server "mkdir -p aisus/infra/secrets && umask 022 && tr -d '\n' > aisus/infra/secrets/metrics_token"
}

ssh_server "cd aisus && git fetch --quiet origin && (git checkout --quiet --detach 'origin/$REF' 2>/dev/null || git checkout --quiet --detach '$REF') && git log -1 --format='deploying %h %s'"
write_env
ssh_server bash -s <<'REMOTE'
set -euo pipefail
cd aisus/infra
docker compose config --quiet
set -a; . ./.env; set +a
docker run --rm -e DOMAIN -v "$PWD/caddy:/etc/caddy:ro" caddy:2.11.7 caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
docker run --rm --entrypoint promtool -v "$PWD/prometheus:/etc/prometheus/config:ro" -v "$PWD/secrets/metrics_token:/etc/prometheus/metrics_token:ro" prom/prometheus:v3.15.1 check config /etc/prometheus/config/prometheus.yml
docker compose up -d --build --remove-orphans
# Running services read their configuration again: Caddy reloads, and Prometheus reloads on SIGHUP.
docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
docker compose kill -s SIGHUP prometheus >/dev/null
docker image prune -f >/dev/null
REMOTE

# Umami: replace the default admin password, and create the site's website once.
website=$(ssh_server "cd aisus/infra && docker compose exec -T -e ADMIN_PASSWORD='$(setting UMAMI_ADMIN_PASSWORD)' -e SITE='$DOMAIN' umami node --input-type=module -" < "$here/umami-setup.mjs")
if [[ $website != "$(setting UMAMI_WEBSITE_ID)" ]]; then
  remember UMAMI_WEBSITE_ID "$website"
  write_env
  ssh_server "cd aisus/infra && docker compose up -d cloud"
fi

ssh_server "cd aisus/infra && docker compose ps --format 'table {{.Service}}\t{{.Status}}'"
echo "Deployed to https://$DOMAIN. Umami: https://stats.$DOMAIN (admin). Grafana: https://$DOMAIN/grafana/ (admin). Both passwords are in $secrets."
