---
status: accepted
date: 2026-10-24
decision-makers: owner
---

# Plans are Free, Pro and Team

## Context and Problem Statement

ADR-0063 sells one plan, Team per seat, and gives Free one private repository and 30 days of history in aisus cloud. The owner set new plans on 2026-10-24. Free has no cloud at all, and the extension, the skills, the CLI and the Action's pull request comment stay free and local. Pro, US$5 a month, is aisus cloud for one person's own repositories, public and private, with full history, pull request pages and share links. Team, US$10 per seat a month, is Pro for everyone in a GitHub organization, with its repositories, the team dashboard and seats. Enterprise stays the self-hosted plan. How does the cloud tell the plans and the accounts apart, and how does Stripe sell two plans?

## Considered Options

* Two Stripe prices, the plan decided by the account Checkout is for, and the plan carried in the session's and the subscription's metadata
* One price whose quantity decides the plan
* The buyer picks the plan freely for any account

## Decision Outcome

Chosen option: "Two Stripe prices, the plan decided by the account Checkout is for, and the plan carried in the session's and the subscription's metadata", because each plan then has its own amount and product in Stripe, and an account can only buy the plan made for it.

* `cloud/plans.ts` defines Free, Pro, Team and Enterprise by what each allows: the cloud at all, days of history, pull request pages, share links, the dashboard and an organization's repositories. Free allows none of them. Pro allows all but the dashboard and an organization's repositories. Team and Enterprise allow everything. Free's 30 days of history decide only what the daily retention job keeps of an account that stops paying.
* An account is a person's own when someone has signed in to the cloud with that GitHub login. Every other account is an organization's.
* The server refuses what the plan does not allow. The upload API answers 402 for an account on Free, with a message that names Pro and Team and ends with the upgrade address, `<site>/settings`. It answers 402 the same way for an organization's account on Pro. The map page, the pull request page, a share link's page and the gallery show no maps for such an account, and the share-link API refuses with 402. The dashboard stays with Team.
* Checkout sells Pro, quantity 1, for the signed-in user's own account, and Team, for its seats, for an organization's account, each to an owner of one of the account's repositories. GitHub confirms that ownership on every Checkout and Customer Portal request. The session's `metadata` and its `subscription_data[metadata]` carry the account and the plan.
* The webhook keeps ADR-0063's signature check. `checkout.session.completed` sets the plan in the session's metadata. While an updated subscription is active or trialing, it sets the plan of the price it bills. For a price that is neither configured one, it sets the plan in the price's metadata, or else the plan in the subscription's metadata. Otherwise it sets Free. Every subscription before Pro was Team. Team is therefore the plan when none of them says. A deleted subscription sets Free. `account_plans.plan` may now be `pro`.
* Billing is on only with `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_PRICE` and `STRIPE_TEAM_PRICE`. `AISUS_PRO_PRICE_TEXT` and `AISUS_TEAM_PRICE_TEXT` are shown on the settings page. Without billing every account is Enterprise.
* `deploy/stripe-setup.sh` creates the Pro price (500 cents a month, lookup key `aisus_pro_monthly`) and the Team price (1000 cents per seat a month, lookup key `aisus_team_monthly`). Stripe's prices never change. A price at another amount hands its lookup key to a new price with `transfer_lookup_key`. Each price carries its plan in its metadata. The Customer Portal changes a Team subscription's seats and offers no switch between Pro and Team.

### Consequences

* Good, because the extension, the skills, the CLI and the Action's pull request comment cost nothing, and a person's own repositories cost one flat price in the cloud.
* Bad, because the earlier Free accounts' maps stop showing until the account upgrades, and existing Team subscriptions stay on the old 800-cent price until they change.

### Confirmation

`cloud/test/unit/billing.test.ts` checks that Free refuses uploads with 402, that Pro keeps a person's own maps and refuses an organization's, that Checkout sells Pro with quantity 1 and Team with the seats, that Checkout and the portal refuse a user GitHub no longer confirms as an owner, and that the webhook sets Pro and Team from the price and the metadata. `cloud/test/web/cld07-billing.spec.ts` upgrades the user's own account to Pro and an organization to Team through a mocked Checkout.
