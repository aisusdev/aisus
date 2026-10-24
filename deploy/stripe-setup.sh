#!/usr/bin/env bash
#
# Sets up Stripe for the Team plan with the key in ~/.config/aisus/secrets.env, in test mode until
# that key is a live one: a "Sustain Team" product with a monthly per-seat price, the webhook the
# cloud listens on, and a Customer Portal for plan changes and cancelling. It records the price and
# the webhook's signing secret in secrets.env; deploy.sh then hands them to the cloud. Running it
# again reuses the price, and replaces the webhook when its secret is not on record.
#
#   deploy/stripe-setup.sh             # US$8 per seat a month
#   AISUS_TEAM_PRICE_CENTS=1200 deploy/stripe-setup.sh
set -euo pipefail

state=$HOME/.config/aisus
secrets=$state/secrets.env
# A value is read without the spaces a paste can leave around it.
setting() { grep -m1 "^$1=" "$secrets" | cut -d= -f2- | sed 's/^[[:space:]]*//; s/[[:space:]]*$//' || true; }
remember() {
  sed -i "/^$1=/d" "$secrets"
  printf '%s=%s\n' "$1" "$2" >> "$secrets"
}
key=$(setting STRIPE_SECRET_KEY)
[[ $key == sk_test_* || $key == sk_live_* || $key == rk_* ]] || { echo "Put STRIPE_SECRET_KEY in $secrets first." >&2; exit 1; }
domain=$(setting DOMAIN)
[[ -n $domain ]] || { echo "Put DOMAIN in $secrets first; the webhook needs the site's final address." >&2; exit 1; }
cents=${AISUS_TEAM_PRICE_CENTS:-800}

stripe() {
  local method=$1 path=$2
  shift 2
  curl -fsS -X "$method" -u "$key:" "https://api.stripe.com$path" "$@"
}
field() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const v=JSON.parse(s)$1;console.log(v??'')})"; }

price=$(stripe GET "/v1/prices?lookup_keys[]=aisus_team_monthly&expand[]=data.product" | field ".data[0]?.id")
if [[ -z $price ]]; then
  product=$(stripe POST /v1/products -d name="Sustain Team" -d description="Every private repository, all history, pull request pages, the dashboard and share links." | field ".id")
  price=$(stripe POST /v1/prices -d product="$product" -d currency=usd -d unit_amount="$cents" -d "recurring[interval]=month" -d lookup_key=aisus_team_monthly | field ".id")
fi
product=$(stripe GET "/v1/prices/$price" | field ".product")
amount=$(stripe GET "/v1/prices/$price" | field ".unit_amount")
remember STRIPE_TEAM_PRICE "$price"
remember SUSTAIN_TEAM_PRICE_TEXT "\$$((amount / 100)) per seat a month"

url="https://$domain/api/stripe/webhook"
existing=$(stripe GET "/v1/webhook_endpoints?limit=100" | field ".data.find(e=>e.url==='$url')?.id")
if [[ -n $existing && -z "$(setting STRIPE_WEBHOOK_SECRET)" ]]; then
  stripe DELETE "/v1/webhook_endpoints/$existing" >/dev/null
  existing=
fi
if [[ -z $existing ]]; then
  secret=$(stripe POST /v1/webhook_endpoints -d url="$url" \
    -d "enabled_events[]=checkout.session.completed" -d "enabled_events[]=customer.subscription.updated" -d "enabled_events[]=customer.subscription.deleted" | field ".secret")
  remember STRIPE_WEBHOOK_SECRET "$secret"
fi

if [[ -z "$(stripe GET "/v1/billing_portal/configurations?limit=1" | field ".data[0]?.id")" ]]; then
  stripe POST /v1/billing_portal/configurations \
    -d "business_profile[headline]=Sustain Cloud billing" \
    -d "features[invoice_history][enabled]=true" -d "features[payment_method_update][enabled]=true" \
    -d "features[subscription_cancel][enabled]=true" \
    -d "features[subscription_update][enabled]=true" -d "features[subscription_update][default_allowed_updates][]=quantity" \
    -d "features[subscription_update][products][0][product]=$product" -d "features[subscription_update][products][0][prices][]=$price" >/dev/null
fi
echo "Stripe is ready: price $price ($(setting SUSTAIN_TEAM_PRICE_TEXT)), webhook $url. Run deploy/deploy.sh to hand it to the cloud."
