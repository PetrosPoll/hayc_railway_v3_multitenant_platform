# Churn definitions (HAYC)

Short reference for the team. Full rules live in the implementation plan; this is the human-readable version.

## Logo churn

Of customers **active at the start of month M** (Europe/Athens), how many are **not active at the start of M+1**?

- New customers in M are not in the denominator.
- Cancel click ≠ churn. Churn is when access ends (`customer.subscription.deleted` / period end).
- Cancel + return in the same month → not churned.
- Multiple sites: logo churn only when **all** core plans have ended.

## MRR

Recurring amount charged, **excluding VAT**, after discounts, normalized to monthly. Setup fee €120 never in MRR.

## Event log

Append-only `subscription_events` keyed by HAYC `customer_id`. Stripe `event.id` is stored for idempotency. State at time T = latest row with `status_after` set and `effective_at < T`.

## Cancel flow

- Customer: `cancel_at_period_end` → pending cancellation → resume possible until period end.
- Admin immediate cancel: only for HAYC termination / chargebacks.
- Deprovisioning on `customer.subscription.deleted`, not on cancel click.
