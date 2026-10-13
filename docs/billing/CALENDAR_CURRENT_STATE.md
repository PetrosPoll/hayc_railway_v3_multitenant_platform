# Subscription Calendar — Current State (baseline)

Restored baseline for Calendar v2. Full audit details from the pre-v2 codebase.

**Primary UI:** `client/src/components/ui/subscription-calendar.tsx`  
**Mounted at:** Admin → Subscription Calendar

## Data sources (pre-v2)

Calendar merged three client-side sources:

1. `GET /api/admin/payment-history` — paid `transactions` + live Stripe upcoming / `sub_sched_*`
2. `GET /api/admin/custom-payments` — series configs; occurrences computed in browser
3. `GET /api/admin/payment-obligations` — outstanding debts (Stripe failures + custom)

Upcoming Stripe entries were **not** stored. Past custom dates without obligations were shown as **Paid** by date heuristic.

## Key gaps fixed by v2

- No single stored entry per expected charge
- Divergent webhook vs sync amount logic
- Settle UI ×100 bug; unused year/month query params
- `setMonth(+1)` overflow on day 29–31
- Weak Stripe status coverage; churn pipeline separate
- No nightly reconcile; `checkExpiringCards` never called

## Webhook

`POST /api/webhook` (not `/api/webhook/stripe`). Calendar-relevant: `invoice.payment_succeeded`, `invoice.payment_failed`, `invoice.marked_uncollectible`, `customer.subscription.deleted`, `charge.failed`/`refunded` (email only).

See Calendar v2 docs: `PAYMENT_STATUSES.md`, `STAGING_TEST_PLAN.md`, `RUNBOOK_CALENDAR_V2.md`.
