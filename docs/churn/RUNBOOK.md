# Churn event pipeline — runbook

## Cutover model

| Setting | Behavior |
|---------|----------|
| `churn_settings.events_cutover_at = NULL` | Webhooks **record** `stripe_event_id` in `churn_stripe_event_receipts` but write **no** business rows to `subscription_events`. Backfill **refuses** to write. |
| `events_cutover_at = T` | Backfill writes only events with `effective_at < T`. Webhooks write only events with `effective_at >= T`. |

This prevents double-counting the same period from backfill + live webhooks.

## Required run order

1. **Migrate**  
   `npm run db:migrate` (includes `0029_churn_subscription_events`).

2. **Confirm Stripe webhook events** on the platform endpoint include at least:  
   `invoice.payment_succeeded` (or `invoice.paid`), `customer.subscription.updated`, `customer.subscription.deleted`.

3. **Set cutover** (use “now” in Athens or UTC consistently; store timestamptz):

   ```sql
   UPDATE churn_settings
   SET events_cutover_at = NOW(), updated_at = NOW()
   WHERE id = 1;
   ```

   Until this is set, webhooks stay in receipt-only mode.

4. **Dry-run backfill**

   ```bash
   npx tsx scripts/backfill-subscription-events.ts --dry-run
   ```

5. **Apply backfill**

   ```bash
   npx tsx scripts/backfill-subscription-events.ts
   ```

   Clears only `source = 'backfill'` rows, then rebuilds history with `effective_at < cutover`.

6. **Read** `docs/churn/BACKFILL_REPORT.md`  
   Check: live MRR vs Stripe, ARPA, logo churn 12m sanity table, unmapped prices, duplicates, months marked **approximate**.

7. **Only then** build / enable metrics service + Churn UI (Phase 3).

## Invoice classification (live)

| `invoice.billing_reason` | Event |
|--------------------------|--------|
| `subscription_create` | `new` or `reactivation` (if any prior churn) |
| `subscription_cycle` | no event, except `payment_recovered` if sub was past_due |
| `subscription_update` | `expansion` / `contraction` from recomputed customer MRR |

Never emit `new` on a renewal.

## Deprovisioning

See [DEPROVISIONING.md](./DEPROVISIONING.md). Site teardown must not run on `cancel_at_period_end=true`.
