#!/usr/bin/env bash
#
# Sets up Stripe for the Pro and Team plans (ADR 0067) with the key in ~/.config/aisus/secrets.env,
# in test mode until that key is a live one: an "aisus Pro" product with a monthly price for one
# person, an "aisus Team" product with a monthly per-seat price, the webhook the cloud listens on,
# and a Customer Portal for a Team subscription's seats and for cancelling. It records the prices,
# their text and the webhook's signing secret in secrets.env; deploy.sh then hands them to the
# cloud. Running it again reuses each price while its amount stays the same, and replaces the
# webhook when its secret is not on record.
#
#   infra/stripe-setup.sh              # Pro US$5 a month, Team US$10 per seat a month
#   AISUS_PRO_PRICE_CENTS=700 AISUS_TEAM_PRICE_CENTS=1200 infra/stripe-setup.sh
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
pro_cents=${AISUS_PRO_PRICE_CENTS:-500}
team_cents=${AISUS_TEAM_PRICE_CENTS:-1000}

stripe() {
  local method=$1 path=$2
  shift 2
  curl -fsS -X "$method" -u "$key:" "https://api.stripe.com$path" "$@"
}
field() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const v=JSON.parse(s)$1;console.log(v??'')})"; }
dollars() { (( $1 % 100 == 0 )) && printf '$%d' $(( $1 / 100 )) || printf '$%d.%02d' $(( $1 / 100 )) $(( $1 % 100 )); }

# Sets $price to the monthly price with lookup key $1 at $2 cents, and $product to its product. A
# product named $3 with description $4 is created when no price has the key. Stripe's prices never
# change. A price at another amount hands its lookup key to a new price on the same product. Each
# price carries the plan $5 in its metadata, which the cloud reads for a price it is not configured
# with. A price found under the key is tagged too, whether it is kept or replaced.
monthly_price() {
  local amount
  price=$(stripe GET "/v1/prices?lookup_keys[]=$1" | field ".data[0]?.id")
  if [[ -n $price ]]; then
    stripe POST "/v1/prices/$price" -d "metadata[plan]=$5" >/dev/null
    product=$(stripe GET "/v1/prices/$price" | field ".product")
    amount=$(stripe GET "/v1/prices/$price" | field ".unit_amount")
    [[ $amount != "$2" ]] || return 0
  else
    product=$(stripe POST /v1/products -d name="$3" -d description="$4" | field ".id")
  fi
  price=$(stripe POST /v1/prices -d product="$product" -d currency=usd -d unit_amount="$2" -d "recurring[interval]=month" \
    -d lookup_key="$1" -d transfer_lookup_key=true -d "metadata[plan]=$5" | field ".id")
}

monthly_price aisus_pro_monthly "$pro_cents" "aisus Pro" "aisus cloud for your own repositories, public and private, with full history, pull request pages and share links." pro
pro_price=$price
monthly_price aisus_team_monthly "$team_cents" "aisus Team" "Pro for everyone in a GitHub organization, with its repositories, the team dashboard and seats." team
team_price=$price team_product=$product
remember STRIPE_PRO_PRICE "$pro_price"
remember AISUS_PRO_PRICE_TEXT "$(dollars "$pro_cents") a month"
remember STRIPE_TEAM_PRICE "$team_price"
remember AISUS_TEAM_PRICE_TEXT "$(dollars "$team_cents") per seat a month"

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

# The portal changes only a Team subscription's seats, at the current Team price, and offers no
# switch between Pro and Team. An existing configuration is updated to this.
portal=$(stripe GET "/v1/billing_portal/configurations?limit=1" | field ".data[0]?.id")
stripe POST "/v1/billing_portal/configurations${portal:+/$portal}" \
  -d "business_profile[headline]=aisus cloud billing" \
  -d "features[invoice_history][enabled]=true" -d "features[payment_method_update][enabled]=true" \
  -d "features[subscription_cancel][enabled]=true" \
  -d "features[subscription_update][enabled]=true" \
  -d "features[subscription_update][default_allowed_updates][]=quantity" \
  -d "features[subscription_update][products][0][product]=$team_product" -d "features[subscription_update][products][0][prices][]=$team_price" >/dev/null
echo "Stripe is ready: Pro $pro_price ($(setting AISUS_PRO_PRICE_TEXT)), Team $team_price ($(setting AISUS_TEAM_PRICE_TEXT)), webhook $url. Run infra/deploy.sh to hand it to the cloud."
