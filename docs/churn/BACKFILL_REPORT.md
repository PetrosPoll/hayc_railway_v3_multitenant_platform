# Churn backfill report

**Status:** awaiting run (see [RUNBOOK.md](./RUNBOOK.md)).

## Before you run

1. Migrate (`0029` includes `churn_settings` + `churn_stripe_event_receipts`).
2. Set cutover:

```sql
UPDATE churn_settings SET events_cutover_at = NOW(), updated_at = NOW() WHERE id = 1;
```

3. Then:

```bash
npx tsx scripts/backfill-subscription-events.ts --dry-run
npx tsx scripts/backfill-subscription-events.ts
```

This file is overwritten with ARPA, logo churn 12m sanity table, approximate months, unmapped prices, duplicates, and live Stripe MRR.
