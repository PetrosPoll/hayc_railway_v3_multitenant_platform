# Deprovisioning / site suspension — audit

**Date:** 2026-10-10  
**Question:** Where is site suspension/teardown triggered? Must fire only on `customer.subscription.deleted` (and admin immediate-cancel), never on `cancel_at_period_end=true`.

## Finding

There is **no automated site suspension / teardown / S3 disable** in application code today.

| Path | File / function | What it does to the site |
|------|-----------------|--------------------------|
| Customer schedule cancel | `server/routes.ts` → `POST /api/subscriptions/:id/cancel` | Sets Stripe `cancel_at_period_end=true`, local `cancelAtPeriodEnd`, emails. **No** site teardown. |
| Customer resume | `server/routes.ts` → `POST /api/subscriptions/:id/resume` | Unsets `cancel_at_period_end`. **No** site teardown. |
| Admin immediate cancel | `server/routes.ts` → `POST /api/admin/subscriptions/:id/cancel` | `stripe.subscriptions.cancel(...)`, local status cancelled, emails (“Tasks Required”). **No** automated site teardown — ops email only. |
| Stripe deleted webhook | `server/routes.ts` → `case "customer.subscription.deleted"` (~6231) | Syncs local subscription `status` / `cancelledAt` / obligations. **No** site teardown. |
| Churn event handler | `server/services/churn-event-handlers.ts` → `onSubscriptionDeleted` | Writes churn/contraction events + clears `cancelAtPeriodEnd`. **No** site teardown. |

Operational “deprovisioning” today = **manual**, prompted by admin emails (`admin-cancellation-notice*.html`).

## Verdict

- **Correct relative to R1:** scheduling cancel does **not** tear down the site.
- **Gap vs desired future automation:** if/when automated suspension is added, implement it only in:
  1. `customer.subscription.deleted` handler (`server/routes.ts` and/or `onSubscriptionDeleted`), and
  2. optionally at the end of admin immediate-cancel (after Stripe cancel succeeds),  
  never in the customer `cancel_at_period_end` path.

## Fix applied

None required for incorrect auto-teardown (none exists). Customer cancel path already comments: do not deprovision until deleted. Documented here so Phase 3+ does not reintroduce teardown on schedule.
